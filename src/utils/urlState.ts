// Helper function to serialize a value to string
const serializeValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (Array.isArray(value)) {
    // Filter out empty values from arrays
    const filtered = value.filter(
      (v) => v !== null && v !== undefined && v !== ""
    );
    // Convert each value to string, handling booleans specially
    const mapped = filtered.map((v) => {
      if (typeof v === "boolean") return v ? "1" : "0";
      return String(v);
    });
    return mapped.length ? mapped.join(",") : null;
  }
  return String(value);
};

// Helper function to deserialize a string value to its proper type
const deserializeValue = (value: string | null, hint?: unknown): unknown => {
  if (value === null) return null;

  // If we have a hint that this should be an array, split by comma
  if (Array.isArray(hint)) {
    return value.split(",").map((v, i) => {
      // Try to get hint from corresponding index or first valid hint
      const typeHint =
        hint[i] ?? hint.find((h) => h !== null && h !== undefined);

      // For "mixed" type arrays, preserve the original type if possible
      if (typeof typeHint === "string") return v;
      if (typeof typeHint === "boolean") return v === "1";
      // Default to number if hinted that way or if string looks numeric
      if (typeof typeHint === "number" || !isNaN(Number(v))) return Number(v);
      return v;
    });
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
      (result as Record<string, unknown>)[key] = deserializeValue(
        value,
        initial[key]
      );
    }
  }

  return result;
};
