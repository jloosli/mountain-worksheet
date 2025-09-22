import { serializeState, deserializeState } from "../urlState";

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

    const params = serializeState(state);
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

    const params = serializeState(state);
    expect(params.get("numbers")).toBe("1,2,3");
    expect(params.get("strings")).toBe("a,b,c");
    expect(params.get("mixed")).toBe("1,b,3");
    expect(params.has("empty")).toBe(false);
    expect(params.get("withEmpty")).toBe("1,2,3");
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

    const params = serializeState(state);
    expect(params.get("nested")).toBe("1,2,3,4");
    expect(params.get("mixed")).toBe("1,a,b,2");
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

    const params = serializeState(state);
    expect(params.get("pilot")).toBe("John Doe");
    expect(params.get("date")).toBe("2025-09-21");
    expect(params.get("altitude")).toBe("1000,2000,3000");
    expect(params.get("wind")).toBe("0,90,180,5,10,15");
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
      wind: [0, 90, 180, 5, 10, 15], // Note: Flattened array due to serialization
      turb: true,
    });
  });
});
