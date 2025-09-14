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
  sDate: string;
  sTime: string;
  acft: string;
  tailN: string;

  // Weather Information
  wind: [number[], number[], number[]]; // [wDir, wVel, temp] arrays for each altitude
  turb: boolean;
  cielVis: boolean;
  mtnObsc: boolean;

  // Aircraft Performance
  apt: [string, string]; // [departure, arrival]
  temp: [number, number, number]; // [departure, operating, arrival]
  altr: [number, number, number]; // [departure, operating, arrival]
  alttd: [number, number, number]; // [departure, operating, arrival]
  rwy: [number, number]; // [departure, arrival]

  // Aircraft Weight
  wgt: number | null;

  // Mountain Qualifications
  mtnEndorse: boolean;
  mtnCert: boolean;
}
