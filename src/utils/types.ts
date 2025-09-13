import type { JsonValue } from "./urlState";

/**
 * Makes a type URL-serializable by ensuring all properties can be converted to JSON
 * and stored in the URL state.
 */
export type URLSerializable<T> = T & { [key: string]: JsonValue };

/**
 * Helper type for objects that need indexed access while remaining URL-serializable
 */
export type IndexedURLSerializable<T extends JsonValue> = {
  [key: string]: T;
};
