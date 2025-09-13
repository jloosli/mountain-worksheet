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

// Only encode characters that absolutely must be encoded in URLs
const encodeReadable = (str: string): string => {
  return str
    .replace(/\s/g, "+") // Replace spaces with +
    .replace(/[+]/g, "%2B") // Encode + signs that were originally in the text
    .replace(/[&]/g, "%26") // Encode & to avoid breaking query params
    .replace(/[=]/g, "%3D"); // Encode = to avoid breaking query params
};

// Custom decoder that handles our readable format
const decodeReadable = (str: string): string => {
  // First decode any percent-encoded characters
  const decoded = str
    .replace(/%2B/g, "+") // Special case: decode %2B back to +
    .replace(/%26/g, "&") // Decode & back
    .replace(/%3D/g, "=") // Decode = back
    .replace(/\+/g, " "); // Finally, convert + to spaces
  return decoded;
};

// Serialize state to URL-safe string
export const serializeState = (state: JsonValue): string => {
  const cleaned = removeEmpty(state);
  if (!cleaned) return "";
  return encodeReadable(JSON.stringify(cleaned));
};

// Deserialize state from URL string with validation
export const deserializeState = (stateStr: string | null): JsonValue | null => {
  if (!stateStr) return null;

  try {
    const decoded = decodeReadable(stateStr);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Failed to parse state from URL:", e);
    return null;
  }
};
