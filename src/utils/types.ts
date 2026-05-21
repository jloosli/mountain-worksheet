/**
 * Consolidated worksheet data type that combines all form fields
 */
export interface WorksheetData {
  // Sortie Information
  pilot: string;
  date: string;
  time: string;
  duration: number | null;
  acType: string;
  tailN: string;
  airport: [string, string]; // [departure, arrival]
  route: string; // Area of Operations/Route
  position: [number | null, number | null]; // [lat, lon] in DD.dddd; [null, null] when unset

  // Weather Information
  wind: [(number | null)[], (number | null)[], (number | null)[]]; // [wDir, wVel, temp] arrays for each altitude
  turb: boolean;
  cielVis: boolean;
  mtnObsc: boolean;

  // Aircraft Performance
  temp: [number | null, number | null, number | null]; // [departure, operating, arrival]
  altimeter: [number | null, number | null, number | null]; // [departure, operating, arrival]
  altitude: [number | null, number | null, number | null]; // [departure, operating, arrival]
  rwy: [number | null, number | null]; // [departure, arrival] runway lengths in feet

  // Aircraft Weight
  weight: number | null;

  // Mountain Qualifications
  mtnEndorse: boolean;
  mtnCert: boolean;
}

export interface StallSpeeds {
  flaps: number[];
  Vso: number[];
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
  stallSpeeds: StallSpeeds;
  climbPerformance: {
    pressureAltitudes: number[];
    climbSpeeds: number[];
    temperatures: number[];
    data: (number | null)[][];
  };
  Vx?: {
    speeds: number[];
    altitudes: number[];
  };
  shortFieldTakeoff: {
    weights: number[];
    pressureAltitudes: number[];
    temperatures: number[];
    data: Array<{
      groundRoll: (number | null)[][];
      groundRoll50ft: (number | null)[][];
    }>;
  };
  shortFieldLanding?: {
    weights: number[];
    pressureAltitudes: number[];
    temperatures: number[];
    data: Array<{
      groundRoll: (number | null)[][];
      groundRoll50ft: (number | null)[][];
    }>;
  };
}

/**
 * TOLD (Takeoff and Landing Distance) calculation results
 */
export interface TOLDResults {
  takeoffGroundRoll: {
    departure: number | null;
    arrival: number | null;
  };
  takeoff50ftObstacle: {
    departure: number | null;
    arrival: number | null;
  };
  landingGroundRoll: {
    departure: number | null;
    arrival: number | null;
  };
  landing50ftObstacle: {
    departure: number | null;
    arrival: number | null;
  };
  availableRunwayRemainingTakeoffGroundRoll: {
    departure: number | null;
    arrival: number | null;
  };
  availableRunwayRemainingTakeoff50ft: {
    departure: number | null;
    arrival: number | null;
  };
}

/**
 * TOLD calculation input parameters
 */
export interface TOLDInputs {
  weight: number | null;
  pressureAltitudes: [number | null, number | null, number | null];
  temperatures: [number | null, number | null, number | null];
  runwayLengths: [number | null, number | null];
}

/**
 * TOLD calculation parameters for a specific airport/condition
 */
export interface TOLDCalculationParams {
  weight: number | null;
  pressureAltitude: number | null;
  temperature: number | null;
  runwayLength: number | null;
}

/**
 * TOLD calculation context - includes aircraft model and all calculation parameters
 */
export interface TOLDCalculationContext {
  aircraftModel: string;
  inputs: TOLDInputs;
}

/**
 * TOLD calculation error states
 */
export interface TOLDError {
  type:
    | "invalid_input"
    | "missing_data"
    | "extrapolation_warning"
    | "calculation_failed"
    | "aircraft_not_found"
    | "runway_length_missing"
    | "weight_out_of_range"
    | "altitude_out_of_range"
    | "temperature_out_of_range";
  message: string;
  field?: string;
  severity?: "warning" | "error" | "info";
}

/**
 * TOLD calculation result with error handling
 */
export interface TOLDCalculationResult {
  success: boolean;
  results?: TOLDResults;
  errors?: TOLDError[];
  warnings?: TOLDError[];
}

/**
 * TOLD validation result for input parameters
 */
export interface TOLDValidationResult {
  isValid: boolean;
  errors: TOLDError[];
  warnings: TOLDError[];
}

/**
 * Individual maneuvering speed data for a specific flap setting and bank angle
 */
export interface ManeuveringSpeedData {
  flapSetting: number;
  bankAngle: number;
  speed: number;
}

/**
 * Complete maneuvering speeds data for an aircraft
 * Contains speeds for all flap settings and bank angles
 */
export interface ManeuveringSpeeds {
  flapSettings: number[];
  speeds: ManeuveringSpeedData[];
}

/**
 * Minimal runway shape used by AirportCard's runway dropdown. A subset of
 * AirportResponse.runway from the AviationWeather API — only what the UI
 * needs to render the option label (id + length) and filter out helipads
 * (alignment === null).
 */
export interface RunwayOption {
  id: string;
  length: number;
  alignment: number | null;
}
