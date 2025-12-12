import qs from "qs";

// Helper function to preprocess state for qs serialization
// Handles nested arrays and boolean values specially
const preprocessState = (state: Record<string, unknown>): Record<string, unknown> => {
  const processed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(state)) {
    // Skip null, undefined, and empty strings
    if (value === null || value === undefined || value === "") {
      continue;
    }
    
    // Convert booleans to "1"/"0" for compact serialization
    if (typeof value === "boolean") {
      processed[key] = value ? "1" : "0";
      continue;
    }
    
    // Handle nested arrays (2D arrays) - serialize them as comma-separated strings with || separator
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
    } else if (Array.isArray(value)) {
      // Handle simple arrays - filter out null/undefined/empty and convert booleans
      const filtered = value.filter(
        (v) => v !== null && v !== undefined && v !== ""
      );
      if (filtered.length === 0) {
        continue; // Skip empty arrays
      }
      const mapped = filtered.map((v) => {
        if (typeof v === "boolean") return v ? "1" : "0";
        return String(v);
      });
      processed[key] = mapped;
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
};

// Helper function to postprocess parsed state from qs
// Handles type conversion and nested array reconstruction
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
    
    // Handle nested arrays (check for || separator)
    if (typeof value === "string" && value.includes("||")) {
      const subArrays = value.split("||");
      const reconstructed = subArrays.map((subArrayStr) => {
        if (!subArrayStr) return [];
        return subArrayStr.split(",").map((v, i) => {
          const typeHint = Array.isArray(hint) && hint.length > 0 && Array.isArray(hint[0])
            ? (hint[0] as unknown[])[i] ?? (hint[0] as unknown[]).find((h) => h !== null && h !== undefined)
            : hint;
          
          if (typeof typeHint === "string") return v;
          if (typeof typeHint === "boolean") return v === "1";
          if (
            typeof typeHint === "number" ||
            (typeof v === "string" && v.trim() !== "" && /^[+-]?\d+(\.\d+)?$/.test(v))
          ) {
            return Number(v);
          }
          return v;
        });
      });
      (result as Record<string, unknown>)[key] = reconstructed;
    } else if (Array.isArray(hint)) {
      // Handle simple arrays - qs with arrayFormat: 'comma' may return them as strings or arrays
      let arrayValue: unknown[];
      if (typeof value === "string") {
        arrayValue = value.split(",");
      } else if (Array.isArray(value)) {
        arrayValue = value;
      } else {
        (result as Record<string, unknown>)[key] = value;
        continue;
      }
      
      const simpleArray = arrayValue.map((v, i) => {
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
      
      // Check if hint suggests nested array but we got flat string
      if (hint.length > 0 && Array.isArray(hint[0])) {
        const subArrayLength = (hint[0] as unknown[]).length;
        const nestedResult = [];
        for (let i = 0; i < simpleArray.length; i += subArrayLength) {
          nestedResult.push(simpleArray.slice(i, i + subArrayLength));
        }
        (result as Record<string, unknown>)[key] = nestedResult;
      } else {
        (result as Record<string, unknown>)[key] = simpleArray;
      }
    } else {
      // Handle primitives
      if (typeof hint === "boolean") {
        (result as Record<string, unknown>)[key] = value === "1" || value === true || value === "true";
      } else if (typeof hint === "number") {
        (result as Record<string, unknown>)[key] = typeof value === "string" ? Number(value) : value;
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }

  return result;
};

// qs options for compact, human-readable query strings
const QS_OPTIONS: qs.IStringifyOptions = {
  arrayFormat: "comma",
  encode: false,
  skipNulls: true,
  addQueryPrefix: false,
  format: "RFC1738",
};

// Convert state object to query string
export const serializeState = (
  state: Record<string, unknown>
): string => {
  const processed = preprocessState(state);
  return qs.stringify(processed, QS_OPTIONS);
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
    decode: false, // Don't decode since we used encode: false
  });

  return postprocessState(parsed as Record<string, unknown>, initialState);
};
