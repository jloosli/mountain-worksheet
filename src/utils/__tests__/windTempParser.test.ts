import { parseWindTempData, filterWindTempData } from "../windTempParser";

describe("windTempParser", () => {
  const sampleWindTempData = `000
FBUS31 KWNO 241959
FD1US1
DATA BASED ON 241800Z    
VALID 250000Z   FOR USE 2000-0300Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
SLC      9900    2605+06 2707+01 3413-11 3520-24 332240 342251 342663`;

  describe("parseWindTempData", () => {
    it("should parse windtemp data correctly", () => {
      const result = parseWindTempData(sampleWindTempData);

      expect(result.validTime).toBe("250000");
      expect(result.altitudes).toEqual([
        3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000,
      ]);
      expect(result.data).toHaveLength(5); // SLC has data for 5 altitudes
    });

    it("should parse airport data correctly", () => {
      const result = parseWindTempData(sampleWindTempData);

      const slcData = result.data.filter((item) => item.icaoId === "SLC");
      expect(slcData).toHaveLength(5); // SLC has data for 5 altitudes

      // Check first altitude data for SLC (3000ft - variable wind)
      const firstData = slcData.find((item) => item.altitude === 3000);
      expect(firstData).toEqual({
        icaoId: "SLC",
        altitude: 3000,
        wdir: 0,
        wspd: 0,
        temp: 0,
        pressure: 29.92,
      });

      // Check second altitude data for SLC (6000ft)
      const secondData = slcData.find((item) => item.altitude === 6000);
      expect(secondData).toEqual({
        icaoId: "SLC",
        altitude: 6000,
        wdir: 260,
        wspd: 5,
        temp: 6,
        pressure: 29.92,
      });
    });

    it("should handle negative temperatures", () => {
      const result = parseWindTempData(sampleWindTempData);

      const slc12000 = result.data.find(
        (item) => item.icaoId === "SLC" && item.altitude === 12000
      );
      expect(slc12000?.temp).toBe(-11);
    });

    it("should handle missing data entries", () => {
      const dataWithMissing = `000
FBUS31 KWNO 241959
FD1US1
DATA BASED ON 241800Z    
VALID 250000Z   FOR USE 2000-0300Z. TEMPS NEG ABV 24000

FT  3000    6000    9000
SLC      9900    2605+06`;

      const result = parseWindTempData(dataWithMissing);

      const slcData = result.data.filter((item) => item.icaoId === "SLC");
      expect(slcData).toHaveLength(2); // Only 2 altitudes with data
    });

    it("should throw error for invalid data format", () => {
      const invalidData = `Invalid data format`;

      expect(() => parseWindTempData(invalidData)).toThrow(
        "Could not parse altitude header from windtemp data"
      );
    });
  });

  describe("filterWindTempData", () => {
    let parsedData: ReturnType<typeof parseWindTempData>;

    beforeEach(() => {
      parsedData = parseWindTempData(sampleWindTempData);
    });

    it("should filter by airport codes", () => {
      const filtered = filterWindTempData(parsedData, ["SLC"], [3000, 6000]);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((item) => item.icaoId === "SLC")).toBe(true);
      expect(
        filtered.every((item) => [3000, 6000].includes(item.altitude))
      ).toBe(true);
    });

    it("should filter by altitudes", () => {
      const filtered = filterWindTempData(parsedData, ["SLC"], [3000]);

      expect(filtered).toHaveLength(1);
      expect(filtered.every((item) => item.altitude === 3000)).toBe(true);
      expect(filtered.map((item) => item.icaoId)).toEqual(["SLC"]);
    });

    it("should return empty array for non-matching filters", () => {
      const filtered = filterWindTempData(parsedData, ["KXYZ"], [3000]);

      expect(filtered).toHaveLength(0);
    });
  });
});
