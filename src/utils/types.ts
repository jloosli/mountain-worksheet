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

/**
 * Consolidated worksheet data type that combines all form fields
 */
export interface WorksheetData {
  // Sortie Information
  pilot: string;
  date: string;
  time: string;
  acType: string;
  tailN: string;

  // Weather Information
  wind: [number[], number[], number[]]; // [wDir, wVel, temp] arrays for each altitude
  turb: boolean;
  cielVis: boolean;
  mtnObsc: boolean;

  // Aircraft Performance
  airport: [string, string]; // [departure, arrival]
  temp: [number, number, number]; // [departure, operating, arrival]
  altimeter: [number, number, number]; // [departure, operating, arrival]
  altitude: [number, number, number]; // [departure, operating, arrival]
  rwy: [number, number]; // [departure, arrival]

  // Aircraft Weight
  weight: number | null;

  // Mountain Qualifications
  mtnEndorse: boolean;
  mtnCert: boolean;
}

export interface Aircraft {
  id: string;
  name: string;
  emptyWeight: number;
  maxGrossWeight: number;
  fuelCapacity: number;
  fuelWeightPerGallon: number;
  serviceCeiling: number;
  maneuvering: { weights: number[]; Va: number[] };
  climbPerformance: {
    pressureAltitudes: number[];
    climbSpeeds: number[];
    temperatures: number[];
    data: number[][];
  };
}
