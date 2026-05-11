import aircraftData from "@/data/aircraft.json";
import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  findInverseXgivenYandZ,
  FlexibleInterpolationTable,
} from "@/utils/interpolation";
import {
  calculateVra,
  calculateVx,
  pressureAltitudeToDensityAltitude,
} from "@/utils/formulas";
import { Aircraft } from "@/utils/types";

interface ClimbPerformanceProps {
  aircraftModel?: string;
  weight?: number | null;
  OATs?: [number | null, number | null, number | null];
  PAs?: [number | null, number | null, number | null];
  altimeters?: [number | null, number | null, number | null];
}

export default function ClimbPerformance({
  aircraftModel,
  weight,
  OATs,
  PAs,
  altimeters,
}: ClimbPerformanceProps) {
  if (!aircraftModel) return null;

  const aircraft: Aircraft | null =
    (aircraftData.find((a) => a.id === aircraftModel) as Aircraft | undefined) ?? null;

  const ratesOfClimb: [number | null, number | null, number | null] = [null, null, null];
  if (aircraft) {
    const climbTable: FlexibleInterpolationTable = aircraft.climbPerformance;
    const options = { xAxisName: "pressureAltitudes", yAxisName: "temperatures" };
    for (let i = 0; i < 3; i++) {
      const pa = PAs?.[i];
      const oat = OATs?.[i];
      if (pa != null && oat != null) {
        try {
          ratesOfClimb[i] = Math.round(
            bilinearInterpolateFlexible(climbTable, pa, oat, options)
          );
        } catch {
          ratesOfClimb[i] = null;
        }
      }
    }
  }

  const percentMGW: number | null =
    weight && aircraft?.maxGrossWeight
      ? Math.round((weight / aircraft.maxGrossWeight) * 100)
      : null;

  // Helper function to determine cell styling based on value
  const getPercentageStyle = (percent: number | null) => {
    if (percent === null) return "";
    if (percent > 100) return "text-red-500 font-bold";
    if (percent >= 90) return "text-yellow-500 font-bold";
    return "";
  };

  const actROC = (roc: number | null): number | null => {
    if (roc === null || percentMGW === null) return null;
    return Math.round(roc * (1 + (1 - percentMGW / 100)));
  };

  const Vy = (pa: number | null): number | null => {
    if (pa === null || !aircraft) return null;
    let idx = aircraft.climbPerformance.pressureAltitudes.findIndex(
      (p) => p >= pa
    );
    if (idx === -1) idx = 0;
    return aircraft.climbPerformance.climbSpeeds[idx] ?? null;
  };

  const Va = (): number | null => {
    if (!weight || !aircraft) return null;
    return Math.round(
      bilinearInterpolate(
        {
          xAxis: [1],
          yAxis: aircraft.maneuvering.weights,
          data: [aircraft.maneuvering.Va],
        },
        1,
        weight
      )
    );
  };

  const Vra = (): number | string => {
    if (!aircraft) return "N/A";
    const vraValue = calculateVra(aircraft);
    return vraValue !== null ? vraValue : "N/A";
  };

  const Vx = (pa: number | null): number | null => {
    if (pa === null || !aircraft) return null;
    return calculateVx(aircraft, pa);
  };

  const serviceCeiling = (oat: number | null): number | "exceeds_table" | null => {
    if (oat === null || !aircraft) return null;
    try {
      const alts = aircraft.climbPerformance.pressureAltitudes;
      const computed = findInverseXgivenYandZ(
        aircraft.climbPerformance.data,
        alts,
        aircraft.climbPerformance.temperatures,
        300,
        oat
      );
      return computed > alts[alts.length - 1] ? "exceeds_table" : computed;
    } catch {
      return null;
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">
        Rates of Climb, V Speeds, Ceilings ({aircraftModel})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left">Metric</th>
              <th className="py-2 px-4 text-right">Departure</th>
              <th className="py-2 px-4 text-right">Operating</th>
              <th className="py-2 px-4 text-right">Arrival</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Rate of Climb (MGW)</td>
              <td className="py-2 px-4 text-right">{ratesOfClimb[0] ?? "-"}</td>
              <td className="py-2 px-4 text-right">{ratesOfClimb[1] ?? "-"}</td>
              <td className="py-2 px-4 text-right">{ratesOfClimb[2] ?? "-"}</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Rate of Climb (Actual Wt, note 11)</td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[0]) ?? "-"}
              </td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[1]) ?? "-"}
              </td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[2]) ?? "-"}
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vx (Best Angle)</td>
              <td className="py-2 px-4 text-right">{Vx(PAs?.[0] ?? null) ?? "-"}</td>
              <td className="py-2 px-4 text-right">{Vx(PAs?.[1] ?? null) ?? "-"}</td>
              <td className="py-2 px-4 text-right">{Vx(PAs?.[2] ?? null) ?? "-"}</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vy (Best Rate)</td>
              <td className="py-2 px-4 text-right">{Vy(PAs?.[0] ?? null) ?? "-"}</td>
              <td className="py-2 px-4 text-right">{Vy(PAs?.[1] ?? null) ?? "-"}</td>
              <td className="py-2 px-4 text-right">{Vy(PAs?.[2] ?? null) ?? "-"}</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Va at Actual Weight</td>
              <td className="py-2 px-4 text-right">{Va() ?? "-"}</td>
              <td className="py-2 px-4 text-right"></td>
              <td className="py-2 px-4 text-right"></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vra (Rough Air Speed)</td>
              <td className="py-2 px-4 text-right">{Vra()}</td>
              <td className="py-2 px-4 text-right"></td>
              <td className="py-2 px-4 text-right"></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Percent of MGW</td>
              <td
                className={`py-2 px-4 text-right ${getPercentageStyle(
                  percentMGW
                )}`}
              >
                {percentMGW !== null ? `${percentMGW}%` : "-"}
              </td>
              <td className="py-2 px-4 text-right"></td>
              <td className="py-2 px-4 text-right"></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Service Ceiling (300 ft/min ROC, MSL)</td>
              {([0, 1, 2] as const).map((i) => {
                const sc = serviceCeiling(OATs?.[i] ?? null);
                if (sc === null) {
                  return <td key={i} className="py-2 px-4 text-right">-</td>;
                }
                const alts = aircraft?.climbPerformance.pressureAltitudes;
                const maxTableAlt = alts ? alts[alts.length - 1] : null;
                if (sc === "exceeds_table") {
                  return (
                    <td key={i} className="py-2 px-4 text-right">
                      {`> ${maxTableAlt?.toLocaleString()} ft`}
                    </td>
                  );
                }
                const oat = OATs?.[i] ?? null;
                const altimeter = altimeters?.[i] ?? null;
                const scPARounded = Math.round(sc);
                const scDA = oat !== null ? Math.round(pressureAltitudeToDensityAltitude(sc, oat)) : null;
                const titleText = scDA !== null
                  ? `Pressure Alt: ${scPARounded.toLocaleString()} ft\nDensity Alt: ${scDA.toLocaleString()} ft`
                  : `Pressure Alt: ${scPARounded.toLocaleString()} ft`;
                const displayValue = altimeter !== null && altimeter >= 28
                  ? `${Math.round(sc + (altimeter - 29.92) * 1000).toLocaleString()} ft`
                  : `${scPARounded.toLocaleString()} ft (PA)`;
                return (
                  <td key={i} className="py-2 px-4 text-right" title={titleText}>
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
