import qs from "qs";


// Custom encoder that converts spaces to '+' while keeping arrays unencoded
// This makes URLs more readable: "John Doe" -> "John+Doe" instead of "John%20Doe"
const spaceEncoder = (
  str: string | number | boolean,
  defaultEncoder: (str: string | number | boolean, defaultEncoder?: (str: string | number | boolean) => string, charset?: string) => string,
  charset: string,
  type: "key" | "value"
): string => {
  if (typeof str === "string") {
    // Only encode spaces as '+' for values (not keys, to keep them readable)
    if (type === "value") {
      return str.replace(/ /g, "+");
    }
  }
  // Use default encoder for other characters
  return defaultEncoder(str, defaultEncoder, charset);
};

// Filter function for qs.stringify to skip null, undefined, empty strings, and empty arrays
const filterEmpty = (prefix: string, value: unknown): unknown => {
  if (value === null || value === undefined || value === "") {
    return undefined; // Skip top-level null/empty values
  }
  if (Array.isArray(value)) {
    // For nested arrays (2D), we'll handle them in preprocessing
    if (value.length > 0 && Array.isArray(value[0])) {
      return value; // Keep nested arrays for special handling
    }
    // For simple arrays, preserve null/empty positions as "" so they appear as
    // ",," in the URL (e.g. [30.24, null, 30.31] → "30.24,,30.31").
    // This preserves index positions during round-trips (deserialization maps
    // "" back to null). Skip the entire array only if all values are empty.
    const mapped = value.map((v) =>
      v === null || v === undefined || v === "" ? "" : v
    );
    const hasAnyValue = mapped.some((v) => v !== "");
    return hasAnyValue ? mapped : undefined;
  }
  return value;
};

// Minimal preprocessing: only handle what qs can't do natively
// 1. Convert booleans to "1"/"0" (qs encoder doesn't apply to array elements)
// 2. Handle nested arrays with || separator (qs doesn't support custom separators)
const preprocessForQs = (state: Record<string, unknown>): Record<string, unknown> => {
  const processed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(state)) {
    // Convert booleans to "1"/"0" (qs encoder doesn't work for array elements)
    if (typeof value === "boolean") {
      processed[key] = value ? "1" : "0";
      continue;
    }
    
    // Handle nested arrays (2D arrays) - serialize them as comma-separated strings with || separator
    // This is the only custom format we need since qs doesn't support || separator natively
    // Null/undefined positions are preserved as empty slots (e.g. [null, 0, 5] → ",0,5")
    // so that index positions round-trip correctly (deserialization restores "" to null).
    if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
      const nestedSerialized = value.map((subArray) => {
        const mapped = subArray.map((v: unknown) => {
          if (v === null || v === undefined || v === "") return "";
          if (typeof v === "boolean") return v ? "1" : "0";
          return String(v);
        });
        return mapped.join(",");
      });
      // Only include the key if at least one sub-array has a non-empty value
      const hasAnyValue = nestedSerialized.some((s) => s.replace(/,/g, "") !== "");
      processed[key] = hasAnyValue ? nestedSerialized.join("||") : undefined;
      continue;
    }
    
    // For simple arrays, convert booleans within arrays
    // qs filter will handle empty value filtering and empty array skipping
    if (Array.isArray(value)) {
      const mapped = value.map((v) => {
        if (typeof v === "boolean") return v ? "1" : "0";
        return v;
      });
      processed[key] = mapped;
      continue;
    }
    
    // For primitives, pass through as-is (qs will handle them)
    processed[key] = value;
  }
  
  return processed;
};

// Shared helper function to convert a single value based on a type hint
// Used by both convertValue (for simple arrays) and postprocessState (for nested arrays)
// This handles type coercion (string -> number, "1"/"0" -> boolean, etc.)
// Exported for testing purposes
export const convertSingleValue = (v: string, typeHint: unknown): unknown => {
  // Empty string is a preserved null position (from serialization of null array
  // elements as "" to maintain index positions). Restore to null.
  if (v === "") return null;

  if (typeof typeHint === "string") return v;
  if (typeof typeHint === "boolean") return v === "1" || v === "true";
  if (
    typeof typeHint === "number" ||
    (v.trim() !== "" && /^[+-]?\d+(\.\d+)?$/.test(v))
  ) {
    return Number(v);
  }
  return v;
};

// Helper function to convert values based on type hints from initialState
// This handles type coercion (string -> number, "1"/"0" -> boolean, etc.)
const convertValue = (value: unknown, hint: unknown): unknown => {
  if (Array.isArray(hint)) {
    // Handle arrays - qs with arrayFormat: 'comma' returns them as strings
    let arrayValue: unknown[];
    if (typeof value === "string") {
      arrayValue = value.split(",");
    } else if (Array.isArray(value)) {
      arrayValue = value;
    } else {
      return value;
    }
    
    const converted = arrayValue.map((v, i) => {
      const vStr = String(v);
      const typeHint =
        (hint as unknown[])[i] ?? (hint as unknown[]).find((h) => h !== null && h !== undefined);

      return convertSingleValue(vStr, typeHint);
    });
    
    // Check if hint suggests nested array but we got flat string (backward compatibility)
    if (hint.length > 0 && Array.isArray(hint[0])) {
      const subArrayLength = (hint[0] as unknown[]).length;
      const nestedResult = [];
      for (let i = 0; i < converted.length; i += subArrayLength) {
        nestedResult.push(converted.slice(i, i + subArrayLength));
      }
      return nestedResult;
    }
    
    return converted;
  }
  
  // Handle primitives
  if (typeof hint === "boolean") {
    return value === "1" || value === true || value === "true";
  }
  if (typeof hint === "number") {
    return typeof value === "string" ? Number(value) : value;
  }

  // Null hint: auto-detect numeric strings (same logic as convertSingleValue)
  if (hint === null && typeof value === "string" && value.trim() !== "" && /^[+-]?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
};

// Postprocess parsed state - handles nested arrays and type conversion
const postprocessState = <T>(
  parsed: Record<string, unknown>,
  initialState: T
): T => {
  const result = { ...initialState } as T;
  const initial = initialState as Record<string, unknown>;

  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in initial)) {
      continue; // Ignore keys not in initial state
    }

    const hint = initial[key];

    // Handle nested arrays (our custom || separator format).
    // qs parses the comma-separated portion but leaves || inside element strings,
    // so we rejoin with commas and split on || to reconstruct sub-arrays.
    const rawStr = Array.isArray(value)
      ? (value as unknown[]).join(",")
      : typeof value === "string"
        ? value
        : null;

    if (rawStr !== null && rawStr.includes("||")) {
      const subArrays = rawStr.split("||");
      const reconstructed = subArrays.map((subArrayStr) => {
        if (!subArrayStr) return [];
        return subArrayStr.split(",").map((v, i) => {
          const typeHint = Array.isArray(hint) && hint.length > 0 && Array.isArray(hint[0])
            ? (hint[0] as unknown[])[i] ?? (hint[0] as unknown[]).find((h) => h !== null && h !== undefined)
            : hint;

          return convertSingleValue(v, typeHint);
        });
      });
      (result as Record<string, unknown>)[key] = reconstructed;
    } else {
      // Let qs handle simple arrays, we just need type conversion
      (result as Record<string, unknown>)[key] = convertValue(value, hint);
    }
  }

  return result;
};

// qs options for compact, human-readable query strings
const QS_STRINGIFY_OPTIONS: qs.IStringifyOptions = {
  arrayFormat: "comma", // Comma-separated arrays: ?arr=1,2,3
  encode: true, // Enable encoding to use custom encoder for spaces
  encoder: spaceEncoder, // Custom encoder: spaces -> '+', arrays stay unencoded
  skipNulls: true, // Skip null values automatically
  filter: filterEmpty, // Also skip undefined, empty strings, and empty arrays
  addQueryPrefix: false, // Don't add ? prefix (we add it in useUrlState)
  format: "RFC1738", // Use RFC1738 format (spaces as '+')
};

// Convert state object to query string
export const serializeState = (
  state: Record<string, unknown>
): string => {
  // Minimal preprocessing: convert booleans to "1"/"0" and handle nested arrays
  // qs handles: array formatting, null filtering, encoding
  const processed = preprocessForQs(state);
  return qs.stringify(processed, QS_STRINGIFY_OPTIONS);
};

// Convert query string to state object, using initialState as type hint
export const deserializeState = <T>(
  queryString: string | URLSearchParams | null,
  initialState: T
): T => {
  if (!queryString) return initialState;

  // Convert URLSearchParams to string if needed
  const queryStr = queryString instanceof URLSearchParams
    ? queryString.toString()
    : queryString;

  if (!queryStr) return initialState;

  const parsed = qs.parse(queryStr, {
    comma: true, // Parse comma-separated values as arrays
    // Use default decoder to handle URL-encoded values from URLSearchParams
    // Even though we use encode: false, URLSearchParams.toString() may encode values
  });

  return postprocessState(parsed as Record<string, unknown>, initialState);
};
