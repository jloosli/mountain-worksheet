export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Remove empty values from an object recursively
const removeEmpty = (obj: JsonValue): JsonValue | undefined => {
  if (Array.isArray(obj)) {
    return obj.map(removeEmpty).filter((v) => v !== undefined);
  }
  if (obj !== null && typeof obj === "object") {
    const cleaned = Object.entries(obj)
      .map(([key, value]) => [key, removeEmpty(value)])
      .filter(([, value]) => value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    return Object.keys(cleaned).length ? cleaned : undefined;
  }
  return obj === "" ? undefined : obj;
};

// Serialize state to URL-safe string
export const serializeState = (state: JsonValue): string => {
  const cleaned = removeEmpty(state);
  return cleaned ? encodeURIComponent(JSON.stringify(cleaned)) : "";
};

// Deserialize state from URL string with validation
export const deserializeState = (stateStr: string | null): JsonValue | null => {
  if (!stateStr) return null;

  try {
    const decoded = decodeURIComponent(stateStr);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Failed to parse state from URL:", e);
    return null;
  }
};
