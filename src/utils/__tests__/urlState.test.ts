import { serializeState, deserializeState } from "../urlState";
import qs from "qs";

describe("serializeState", () => {
  it("should serialize primitive values correctly", () => {
    const state = {
      string: "hello",
      number: 42,
      boolean: true,
      nullValue: null,
      undefined: undefined,
      emptyString: "",
    };

    const queryString = serializeState(state);
    const params = new URLSearchParams(queryString);
    expect(params.get("string")).toBe("hello");
    expect(params.get("number")).toBe("42");
    expect(params.get("boolean")).toBe("1");
    // Null, undefined, and empty string should be omitted
    expect(params.has("nullValue")).toBe(false);
    expect(params.has("undefined")).toBe(false);
    expect(params.has("emptyString")).toBe(false);
  });

  it("should serialize arrays correctly", () => {
    const state = {
      numbers: [1, 2, 3],
      strings: ["a", "b", "c"],
      mixed: [1, "b", 3],
      empty: [],
      withEmpty: [1, "", null, 2, undefined, 3],
    };

    const queryString = serializeState(state);
    const params = new URLSearchParams(queryString);
    expect(params.get("numbers")).toBe("1,2,3");
    expect(params.get("strings")).toBe("a,b,c");
    expect(params.get("mixed")).toBe("1,b,3");
    expect(params.has("empty")).toBe(false);
    // Null/empty positions are preserved as "" to maintain index positions
    expect(params.get("withEmpty")).toBe("1,,,2,,3");
  });

  it("should preserve null positions in arrays for correct round-tripping", () => {
    // Regression test for issue #40: altimeter=[30.24, null, 30.31] must not
    // collapse to [30.24, 30.31] which would shift arrival into operating position.
    const state = {
      altimeter: [30.24, null, 30.31],
      temp: [null, 5, null],
      altitude: [5344, null, 4472],
    };

    const queryString = serializeState(state);
    const params = new URLSearchParams(queryString);
    expect(params.get("altimeter")).toBe("30.24,,30.31");
    expect(params.get("temp")).toBe(",5,");
    expect(params.get("altitude")).toBe("5344,,4472");
  });

  it("should serialize nested arrays correctly", () => {
    const state = {
      nested: [
        [1, 2],
        [3, 4],
      ],
      mixed: [
        [1, "a"],
        ["b", 2],
      ],
    };

    const queryString = serializeState(state);
    const params = new URLSearchParams(queryString);
    expect(params.get("nested")).toBe("1,2||3,4");
    expect(params.get("mixed")).toBe("1,a||b,2");
  });

  it("should preserve null positions in nested arrays", () => {
    // Regression test for issue #41: null slots must be preserved as empty strings
    // so that 0 and null are distinguishable in the URL.
    const state = {
      wind: [
        [null, 255, 257],
        [null, 0, 15],
        [null, -2, -8],
      ],
    };
    const queryString = serializeState(state as Record<string, unknown>);
    const params = new URLSearchParams(queryString);
    expect(params.get("wind")).toBe(",255,257||,0,15||,-2,-8");
  });

  it("should omit nested array key when all values are null", () => {
    const state = {
      wind: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
    };
    const queryString = serializeState(state as Record<string, unknown>);
    const params = new URLSearchParams(queryString);
    expect(params.has("wind")).toBe(false);
  });

  it("should handle complex state objects", () => {
    const state = {
      pilot: "John Doe",
      date: "2025-09-21",
      altitude: [1000, 2000, 3000],
      wind: [
        [0, 90, 180],
        [5, 10, 15],
      ],
      flags: [true, false, true],
    };

    const queryString = serializeState(state);
    const params = new URLSearchParams(queryString);
    expect(params.get("pilot")).toBe("John Doe");
    expect(params.get("date")).toBe("2025-09-21");
    expect(params.get("altitude")).toBe("1000,2000,3000");
    expect(params.get("wind")).toBe("0,90,180||5,10,15");
    expect(params.get("flags")).toBe("1,0,1");
  });
});

describe("deserializeState", () => {
  it("should deserialize primitive values correctly", () => {
    const params = new URLSearchParams();
    params.set("string", "hello");
    params.set("number", "42");
    params.set("boolean", "1");

    const initialState = {
      string: "",
      number: 0,
      boolean: false,
      untouched: "original",
    };

    const result = deserializeState(params, initialState);
    expect(result).toEqual({
      string: "hello",
      number: 42,
      boolean: true,
      untouched: "original",
    });
  });

  it("should deserialize arrays correctly using type hints", () => {
    const params = new URLSearchParams();
    params.set("numbers", "1,2,3");
    params.set("strings", "a,b,c");
    params.set("mixed", "1,b,3");

    const initialState = {
      numbers: [0],
      strings: [""],
      mixed: [1, "x", 3],
      untouched: [4, 5, 6],
    };

    const result = deserializeState(params, initialState);
    expect(result).toEqual({
      numbers: [1, 2, 3],
      strings: ["a", "b", "c"],
      mixed: [1, "b", 3], // Note: Smart type inference for numbers
      untouched: [4, 5, 6],
    });
  });

  it("should handle empty or null params", () => {
    const initialState = {
      value: "original",
      array: [1, 2, 3],
    };

    expect(deserializeState(null, initialState)).toEqual(initialState);
    expect(deserializeState(new URLSearchParams(), initialState)).toEqual(
      initialState
    );
  });

  it("should ignore params not in initial state", () => {
    const params = new URLSearchParams();
    params.set("known", "value");
    params.set("unknown", "value");

    const initialState = {
      known: "",
    };

    const result = deserializeState(params, initialState);
    expect(result).toEqual({
      known: "value",
    });
    expect("unknown" in result).toBe(false);
  });

  it("should handle complex worksheet data", () => {
    const params = new URLSearchParams();
    params.set("pilot", "John Doe");
    params.set("date", "2025-09-21");
    params.set("altitude", "1000,2000,3000");
    params.set("wind", "0,90,180,5,10,15");
    params.set("turb", "1");

    const initialState = {
      pilot: "",
      date: "",
      altitude: [0, 0, 0],
      wind: [
        [0, 0, 0],
        [0, 0, 0],
      ],
      turb: false,
    };

    const result = deserializeState(params, initialState);
    expect(result).toEqual({
      pilot: "John Doe",
      date: "2025-09-21",
      altitude: [1000, 2000, 3000],
      wind: [
        [0, 90, 180],
        [5, 10, 15],
      ],
      turb: true,
    });
  });

  it("should restore null positions from empty slots in arrays", () => {
    // Regression test for issue #40: "30.24,,30.31" must restore to
    // [30.24, null, 30.31], not [30.24, 30.31] with arrival shifted to operating.
    const params = new URLSearchParams();
    params.set("altimeter", "30.24,,30.31");
    params.set("temp", ",5,");
    params.set("altitude", "5344,,4472");

    const initialState = {
      altimeter: [null, null, null] as (number | null)[],
      temp: [null, null, null] as (number | null)[],
      altitude: [null, null, null] as (number | null)[],
    };

    const result = deserializeState(params, initialState);
    expect(result.altimeter).toEqual([30.24, null, 30.31]);
    expect(result.temp).toEqual([null, 5, null]);
    expect(result.altitude).toEqual([5344, null, 4472]);
  });

  it("should round-trip arrays with null positions correctly", () => {
    // End-to-end: serialize then deserialize preserves null positions at correct indices.
    const originalState = {
      altimeter: [30.24, null, 30.31] as (number | null)[],
      temp: [null, 5, -2] as (number | null)[],
    };

    const serialized = serializeState(originalState as Record<string, unknown>);

    const initialState = {
      altimeter: [null, null, null] as (number | null)[],
      temp: [null, null, null] as (number | null)[],
    };

    const restored = deserializeState(serialized, initialState);
    expect(restored.altimeter).toEqual([30.24, null, 30.31]);
    expect(restored.temp).toEqual([null, 5, -2]);
  });

  it("should round-trip nested arrays with null and zero values", () => {
    // Regression test for issue #41: null and 0 must be distinguishable after
    // serialization and deserialization. null → empty slot, 0 → "0".
    const originalState = {
      wind: [
        [null, 255, 257, 272, 281],
        [null, 0, 15, 26, 30],
        [null, -2, -8, -12, -17],
      ] as (number | null)[][],
    };
    const serialized = serializeState(originalState as Record<string, unknown>);
    const initialState = {
      wind: [
        Array(5).fill(null),
        Array(5).fill(null),
        Array(5).fill(null),
      ] as (number | null)[][],
    };
    const restored = deserializeState(serialized, initialState);
    expect(restored.wind).toEqual(originalState.wind);
  });
});
