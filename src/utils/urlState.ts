import qs from "qs";

// Filter function for qs.stringify to skip null, undefined, empty strings, and empty arrays
const filterEmpty = (prefix: string, value: unknown): unknown => {
  if (value === null || value === undefined || value === "") {
    return undefined; // Skip these values
  }
  if (Array.isArray(value)) {
    // For nested arrays (2D), we'll handle them in preprocessing
    if (value.length > 0 && Array.isArray(value[0])) {
      return value; // Keep nested arrays for special handling
    }
    // For simple arrays, filter out empty values and skip if empty
    const filtered = value.filter(
      (v) => v !== null && v !== undefined && v !== ""
    );
    return filtered.length > 0 ? filtered : undefined;
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
    if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
      const nestedSerialized = value.map((subArray) => {
        const filtered = subArray.filter(
          (v: unknown) => v !== null && v !== undefined && v !== ""
        );
        const mapped = filtered.map((v: unknown) => {
          if (typeof v === "boolean") return v ? "1" : "0";
          return String(v);
        });
        return mapped.join(",");
      });
      processed[key] = nestedSerialized.join("||");
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
      
      if (typeof typeHint === "string") return vStr;
      if (typeof typeHint === "boolean") return vStr === "1" || vStr === "true";
      if (
        typeof typeHint === "number" ||
        (vStr.trim() !== "" && /^[+-]?\d+(\.\d+)?$/.test(vStr))
      ) {
        return Number(vStr);
      }
      return vStr;
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
    
    // Handle nested arrays (check for || separator - our custom format)
    if (typeof value === "string" && value.includes("||")) {
      const subArrays = value.split("||");
      const reconstructed = subArrays.map((subArrayStr) => {
        if (!subArrayStr) return [];
        return subArrayStr.split(",").map((v, i) => {
          const typeHint = Array.isArray(hint) && hint.length > 0 && Array.isArray(hint[0])
            ? (hint[0] as unknown[])[i] ?? (hint[0] as unknown[]).find((h) => h !== null && h !== undefined)
            : hint;
          
          return convertValue(v, typeHint);
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
  encode: false, // No URL encoding for human-readable strings
  skipNulls: true, // Skip null values automatically
  filter: filterEmpty, // Also skip undefined, empty strings, and empty arrays
  addQueryPrefix: false, // Don't add ? prefix (we add it in useUrlState)
  format: "RFC1738",
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
    decode: false, // Don't decode since we used encode: false
  });

  return postprocessState(parsed as Record<string, unknown>, initialState);
};
