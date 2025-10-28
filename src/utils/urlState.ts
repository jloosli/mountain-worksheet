// Helper function to serialize a value to string
const serializeValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (Array.isArray(value)) {
    // Check if this is a nested array (2D array)
    if (value.length > 0 && Array.isArray(value[0])) {
      // Handle nested arrays by joining each sub-array with "|" and all sub-arrays with "||"
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
      return nestedSerialized.join("||");
    } else {
      // Handle simple arrays
      const filtered = value.filter(
        (v) => v !== null && v !== undefined && v !== ""
      );
      const mapped = filtered.map((v) => {
        if (typeof v === "boolean") return v ? "1" : "0";
        return String(v);
      });
      return mapped.length ? mapped.join(",") : null;
    }
  }
  return String(value);
};

// Helper function to deserialize a string value to its proper type
const deserializeValue = (value: string | null, hint?: unknown): unknown => {
  if (value === null) return null;

  // If we have a hint that this should be an array, split by comma
  if (Array.isArray(hint)) {
    // Check if this is a nested array (2D array) by looking for "||" separator
    if (value.includes("||")) {
      // Handle nested arrays
      const subArrays = value.split("||");
      return subArrays.map((subArrayStr) => {
        if (!subArrayStr) return [];
        return subArrayStr.split(",").map((v, i) => {
          // Try to get hint from corresponding index or first valid hint
          const typeHint =
            hint[i] ?? hint.find((h) => h !== null && h !== undefined);

          // For "mixed" type arrays, preserve the original type if possible
          if (typeof typeHint === "string") return v;
          if (typeof typeHint === "boolean") return v === "1";
          // Default to number if hinted that way or if string looks numeric
          if (
            typeof typeHint === "number" ||
            (typeof v === "string" &&
              v.trim() !== "" &&
              /^[+-]?\d+(\.\d+)?$/.test(v))
          ) {
            return Number(v);
          }
          return v;
        });
      });
    } else {
      // Handle simple arrays
      const simpleArray = value.split(",").map((v, i) => {
        // Try to get hint from corresponding index or first valid hint
        const typeHint =
          hint[i] ?? hint.find((h) => h !== null && h !== undefined);

        // For "mixed" type arrays, preserve the original type if possible
        if (typeof typeHint === "string") return v;
        if (typeof typeHint === "boolean") return v === "1";
        // Default to number if hinted that way or if string looks numeric
        if (
          typeof typeHint === "number" ||
          (typeof v === "string" &&
            v.trim() !== "" &&
            /^[+-]?\d+(\.\d+)?$/.test(v))
        ) {
          return Number(v);
        }
        return v;
      });

      // Check if the hint suggests this should be a nested array
      if (hint.length > 0 && Array.isArray(hint[0])) {
        // The hint suggests this should be a nested array, but we got a flat string
        // This means the data was flattened during serialization
        // Try to reconstruct the nested structure based on the hint
        const subArrayLength = hint[0].length;
        const result = [];
        for (let i = 0; i < simpleArray.length; i += subArrayLength) {
          result.push(simpleArray.slice(i, i + subArrayLength));
        }
        return result;
      }

      return simpleArray;
    }
  }

  // Use the hint to determine the type
  if (typeof hint === "boolean") {
    return value === "1";
  }
  if (typeof hint === "number") {
    return Number(value);
  }

  return value;
};

// Convert state object to URLSearchParams
export const serializeState = (
  state: Record<string, unknown>
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(state)) {
    const serialized = serializeValue(value);
    if (serialized !== null) {
      params.set(key, serialized);
    }
  }

  return params;
};

// Convert URLSearchParams to state object, using initialState as type hint
export const deserializeState = <T>(
  params: URLSearchParams | null,
  initialState: T
): T => {
  if (!params) return initialState;

  const result = { ...initialState } as T;

  for (const [key, value] of params.entries()) {
    const initial = initialState as Record<string, unknown>;
    if (key in initial) {
      const deserialized = deserializeValue(value, initial[key]);
      (result as Record<string, unknown>)[key] = deserialized;
    }
  }

  return result;
};
