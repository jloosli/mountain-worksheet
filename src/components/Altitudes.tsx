import { useEffect, useState } from "react";
import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "@/utils/formulas";

interface AltitudesProps {
  altitudes: number[];
  altimeters: number[];
  temperatures: number[];
  onPressureUpdate: (pressureAltitudes: [number | null, number | null, number | null]) => void;
}

export default function Altitudes({
  altitudes,
  altimeters,
  temperatures,
  onPressureUpdate
}: AltitudesProps) {
  const [pressures, setPressures] = useState<{
    departurePA: number | null;
    departureDA: number | null;
    altitudePA: number | null;
    altitudeDA: number | null;
    arrivalPA: number | null;
    arrivalDA: number | null;
  }>({
    departurePA: null,
    departureDA: null,
    altitudePA: null,
    altitudeDA: null,
    arrivalPA: null,
    arrivalDA: null,
  });

  useEffect(() => {
    const departurePressureAltitude =
      temperatures[0] !== undefined && altitudes[0] !== undefined
        ? altitudeToPressureAltitude(
            Number(altitudes[0]),
            Number(altimeters[0])
          )
        : null;
    const departureDensityAltitude =
      departurePressureAltitude !== undefined && altitudes[0] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(departurePressureAltitude),
            Number(temperatures[0])
          )
        : null;
    const operatingPressureAltitude =
      temperatures[1] !== undefined && altitudes[1] !== undefined
        ? altitudeToPressureAltitude(
            Number(altitudes[1]),
            Number(altimeters[1])
          )
        : null;
    const operatingDensityAltitude =
      operatingPressureAltitude !== undefined && altitudes[1] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(operatingPressureAltitude),
            Number(temperatures[1])
          )
        : null;
    const arrivalPressureAltitude =
      temperatures[2] !== undefined && altitudes[2] !== undefined
        ? altitudeToPressureAltitude(
            Number(altitudes[2]),
            Number(altimeters[2])
          )
        : null;
    const arrivalDensityAltitude =
      arrivalPressureAltitude !== undefined && altitudes[2] !== undefined
        ? pressureAltitudeToDensityAltitude(
            Number(arrivalPressureAltitude),
            Number(temperatures[2])
          )
        : null;
    setPressures({
      departurePA: departurePressureAltitude,
      departureDA: departureDensityAltitude,
      altitudePA: operatingPressureAltitude,
      altitudeDA: operatingDensityAltitude,
      arrivalPA: arrivalPressureAltitude,
      arrivalDA: arrivalDensityAltitude,
    });
    onPressureUpdate([departurePressureAltitude, operatingPressureAltitude, arrivalPressureAltitude]);
  }, [altitudes, altimeters, temperatures]);
  return (
    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
      <thead>
        <tr>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Altitudes
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Departure
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Operating
          </th>
          <th className="border border-gray-300 dark:border-gray-700 p-2">
            Arrival
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Actual Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudes[0] ? Math.round(altitudes[0]).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudes[1] ? Math.round(altitudes[1]).toLocaleString() : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {altitudes[2] ? Math.round(altitudes[2]).toLocaleString() : "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Pressure Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.departurePA
              ? Math.round(pressures.departurePA).toLocaleString()
              : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.altitudePA
              ? Math.round(pressures.altitudePA).toLocaleString()
              : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.arrivalPA
              ? Math.round(pressures.arrivalPA).toLocaleString()
              : "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-gray-300 dark:border-gray-700 p-2">
            Density Altitude (feet)
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.departureDA
              ? Math.round(pressures.departureDA).toLocaleString()
              : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.altitudeDA
              ? Math.round(pressures.altitudeDA).toLocaleString()
              : "-"}
          </td>
          <td className="border border-gray-300 dark:border-gray-700 p-2 text-right">
            {pressures.arrivalDA
              ? Math.round(pressures.arrivalDA).toLocaleString()
              : "-"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
