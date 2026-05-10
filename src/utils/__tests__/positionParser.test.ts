import { parsePosition } from "../positionParser";

describe("parsePosition - decimal formats", () => {
  it("parses DD.dd with N/W letters", () => {
    const result = parsePosition("36.01N/75.50W");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.01);
      expect(result.lon).toBe(-75.5);
    }
  });

  it("parses DD.dd with S/E letters", () => {
    const result = parsePosition("36.01S/75.50E");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(-36.01);
      expect(result.lon).toBe(75.5);
    }
  });

  it("parses DD.dd with minus signs", () => {
    const result = parsePosition("36.01/-75.50");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.01);
      expect(result.lon).toBe(-75.5);
    }
  });

  it("accepts comma + space separator for decimal-with-minus", () => {
    const result = parsePosition("41.4321, -112.7042");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(41.4321);
      expect(result.lon).toBe(-112.7042);
    }
  });

  it("rounds to 4 decimal places", () => {
    const result = parsePosition("36.123456N/75.987654W");
    expect(result.kind).toBe("decimal");
    if (result.kind === "decimal") {
      expect(result.lat).toBe(36.1235);
      expect(result.lon).toBe(-75.9877);
    }
  });

  it("rejects out-of-range latitude", () => {
    const result = parsePosition("91.00N/75.50W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects out-of-range longitude", () => {
    const result = parsePosition("36.01N/181.00W");
    expect(result.kind).toBe("unrecognized");
  });

  it("preserves raw input on success", () => {
    const result = parsePosition("36.01N/75.50W");
    expect(result.raw).toBe("36.01N/75.50W");
  });

  it("preserves raw input on unrecognized", () => {
    const result = parsePosition("Cache Valley");
    expect(result.kind).toBe("unrecognized");
    expect(result.raw).toBe("Cache Valley");
  });
});

describe("parsePosition - DDM (degree-decimal-minutes)", () => {
  it("parses DDM with letters", () => {
    const result = parsePosition("3600.86N/07530.07W");
    expect(result.kind).toBe("ddm");
    if (result.kind === "ddm") {
      // 36 + 0.86/60 = 36.0143...
      expect(result.lat).toBe(36.0143);
      // 75 + 30.07/60 = 75.5012... (negated)
      expect(result.lon).toBe(-75.5012);
    }
  });

  it("parses DDM with minus", () => {
    const result = parsePosition("3600.86/-07530.07");
    expect(result.kind).toBe("ddm");
    if (result.kind === "ddm") {
      expect(result.lat).toBe(36.0143);
      expect(result.lon).toBe(-75.5012);
    }
  });

  it("rejects DDM with minutes >= 60", () => {
    const result = parsePosition("3660.00N/07530.07W");
    expect(result.kind).toBe("unrecognized");
  });

  it("rejects DDM with degrees out of range", () => {
    const result = parsePosition("9100.00N/07530.07W");
    expect(result.kind).toBe("unrecognized");
  });
});
