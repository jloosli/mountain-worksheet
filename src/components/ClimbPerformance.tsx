import { useEffect, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  findInverseXgivenYandZ,
  FlexibleInterpolationTable,
} from "@/utils/interpolation";
import { calculateVra, calculateVx } from "@/utils/formulas";
import { Aircraft } from "@/utils/types";

interface ClimbPerformanceProps {
  aircraftModel?: string;
  weight?: number | null;
  OATs?: [number | null, number | null, number | null];
  PAs?: [number | null, number | null, number | null];
}

export default function ClimbPerformance({
  aircraftModel,
  weight,
  OATs,
  PAs,
}: ClimbPerformanceProps) {
  const [ratesOfClimb, setRatesOfClimb] = useState<[number | null, number | null, number | null]>([
    null, null, null,
  ]);
  const [percentMGW, setPercentMGW] = useState<number | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);

  useEffect(() => {
    if (aircraftModel) {
      const airplane = aircraftData.find((a) => a.id === aircraftModel);
      if (airplane) {
        setAircraft(airplane);
      }
    }
  }, [aircraftModel]);

  useEffect(() => {
    if (!aircraftModel) return;
    const aircraft = aircraftData.find((a) => a.id === aircraftModel);
    if (!aircraft) return;

    const climbPerformance: FlexibleInterpolationTable = aircraft.climbPerformance;
    const options = {
      xAxisName: "pressureAltitudes",
      yAxisName: "temperatures",
    };

    const newRates: [number | null, number | null, number | null] = [null, null, null];
    for (let i = 0; i < 3; i++) {
      const pa = PAs?.[i];
      const oat = OATs?.[i];
      if (pa != null && oat != null) {
        try {
          newRates[i] = Math.round(
            bilinearInterpolateFlexible(climbPerformance, pa, oat, options)
          );
        } catch {
          newRates[i] = null;
        }
      }
    }
    setRatesOfClimb(newRates);
  }, [OATs, PAs, aircraftModel]);

  useEffect(() => {
    if (weight && aircraft?.maxGrossWeight) {
      const percent = Math.round((weight / aircraft.maxGrossWeight) * 100);
      setPercentMGW(percent);
    } else {
      setPercentMGW(null);
    }
  }, [weight, aircraft]);

  if (!aircraftModel) return null;

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

  const serviceCeiling = (oat: number | null): number | null => {
    if (oat === null || !aircraft) return null;
    try {
      return findInverseXgivenYandZ(
        aircraft.climbPerformance.data,
        aircraft.climbPerformance.pressureAltitudes,
        aircraft.climbPerformance.temperatures,
        300,
        oat
      );
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
              <td className="py-2 px-4">Service Ceiling (300 ft/min ROC)</td>
              {([0, 1, 2] as const).map((i) => {
                const sc = serviceCeiling(OATs?.[i] ?? null);
                return (
                  <td key={i} className="py-2 px-4 text-right">
                    {sc !== null ? `${Math.round(sc).toLocaleString()} ft` : "-"}
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
