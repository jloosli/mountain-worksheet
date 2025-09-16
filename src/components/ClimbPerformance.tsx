import { useEffect, useState } from "react";
import aircraftData from "@/data/aircraft.json";
import {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  findInverseXgivenY,
  FlexibleInterpolationTable,
} from "@/utils/interpolation";
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
  const [ratesOfClimb, setRatesOfClimb] = useState<[number, number, number]>([
    0, 0, 0,
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
    if (
      OATs &&
      PAs &&
      aircraftModel &&
      OATs.every((temp) => temp !== null) &&
      PAs.every((pa) => pa !== null)
    ) {
      const aircraft = aircraftData.find((a) => a.id === aircraftModel);
      const options = {
        extrapolate: true,
        xAxisName: "pressureAltitudes",
        yAxisName: "temperatures",
      };
      if (aircraft) {
        const climbPerformance: FlexibleInterpolationTable =
          aircraft.climbPerformance;
        setRatesOfClimb(
          PAs.map((pa, idx) =>
            Math.round(
              bilinearInterpolateFlexible(
                climbPerformance,
                pa as number,
                OATs[idx] as number,
                options
              )
            )
          ) as [number, number, number]
        );
      }
    }
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

  // @todo Determine actual rate of climb based on weight

  const actROC = (roc: number) =>
    Math.round(roc * (1 + (1 - percentMGW! / 100)));

  const Vy = (pa: number): number => {
    let idx = aircraft?.climbPerformance.pressureAltitudes.findIndex(
      (p) => p >= pa
    );
    if (idx === -1) idx = 0;
    return aircraft?.climbPerformance.climbSpeeds[idx!] ?? 0;
  };

  const Va = () => {
    if (!weight || !aircraft) return 0;
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

  const serviceCeiling = () => {
    if (!aircraft) return 0;
    // Find the altitude where rate of climb is 300 ft/min
    const targetROC = 300;
    const altitude = findInverseXgivenY(
      aircraft.climbPerformance.data,
      aircraft.climbPerformance.pressureAltitudes,
      aircraft.climbPerformance.temperatures,
      targetROC,
      OATs![0]!
    );
    return altitude;
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
              <td className="py-2 px-4 text-right">{ratesOfClimb[0]}</td>
              <td className="py-2 px-4 text-right">{ratesOfClimb[1]}</td>
              <td className="py-2 px-4 text-right">{ratesOfClimb[2]}</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Rate of Climb (Actual Wt, note 11)</td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[0])}*
              </td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[1])}*
              </td>
              <td className="py-2 px-4 text-right">
                {actROC(ratesOfClimb[2])}*
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vx (Best Angle)</td>
              <td className="py-2 px-4 text-right">
                {Math.round(Vy(PAs![0]!) * 0.9)}*
              </td>
              <td className="py-2 px-4 text-right">
                {Math.round(Vy(PAs![1]!) * 0.9)}*
              </td>
              <td className="py-2 px-4 text-right">
                {Math.round(Vy(PAs![2]!) * 0.9)}*
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vy (Best Rate)</td>
              <td className="py-2 px-4 text-right">{Vy(PAs![0]!)}*</td>
              <td className="py-2 px-4 text-right">{Vy(PAs![1]!)}*</td>
              <td className="py-2 px-4 text-right">{Vy(PAs![2]!)}*</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Va at Actual Weight</td>
              <td className="py-2 px-4 text-right">{Va()}</td>
              <td className="py-2 px-4 text-right"></td>
              <td className="py-2 px-4 text-right"></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 px-4">Vra (Rough Air Speed)</td>
              <td className="py-2 px-4 text-right">TBD</td>
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
              <td className="py-2 px-4 text-right">{serviceCeiling()}***</td>
              <td className="py-2 px-4 text-right"></td>
              <td className="py-2 px-4 text-right"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
