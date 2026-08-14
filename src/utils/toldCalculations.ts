import {
  TOLDCalculationParams,
  TOLDError,
  TOLDValidationResult,
} from "@/utils/types";
import {
  trilinearInterpolate,
  bilinearInterpolate,
  TrilinearInterpolationTable,
} from "@/utils/interpolation";
import aircraftData from "@/data/aircraft.json";

/**
 * Calculate takeoff ground roll distance using trilinear interpolation
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters (weight, pressure altitude, temperature, runway length)
 * @returns The calculated ground roll distance in feet, or null if calculation fails
 */
export function calculateTakeoffGroundRoll(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  try {
    // Check for null/undefined inputs
    if (params.weight === null || params.weight === undefined) {
      return null;
    }
    if (
      params.pressureAltitude === null ||
      params.pressureAltitude === undefined
    ) {
      return null;
    }
    if (params.temperature === null || params.temperature === undefined) {
      return null;
    }

    const aircraft = aircraftData.find((a) => a.id === aircraftModel);

    if (!aircraft || !aircraft.shortFieldTakeoff) {
      return null;
    }

    const { weight, pressureAltitude, temperature } = params;
    const { weights, pressureAltitudes, temperatures, data } =
      aircraft.shortFieldTakeoff;

    // Find the weight index for the data array
    const weightIndex = findWeightIndex(weights, weight);

    if (weightIndex === -1) {
      return null;
    }

    // Create trilinear interpolation table for ground roll data

    const groundRollTable: TrilinearInterpolationTable = {
      weights: [
        weights[weightIndex],
        weights[weightIndex + 1] || weights[weightIndex],
      ],
      pressureAltitudes,
      temperatures,
      data: [
        data[weightIndex].groundRoll,
        data[weightIndex + 1]?.groundRoll || data[weightIndex].groundRoll,
      ],
    };

    const distance = trilinearInterpolate(
      groundRollTable,
      weight,
      pressureAltitude,
      temperature,
      { allowExtrapolation: true, warnOnExtrapolation: true }
    );

    if (distance === null) {
      return null;
    }

    return Math.round(distance);
  } catch (error) {
    console.error("Error calculating takeoff ground roll:", error);
    return null;
  }
}

/**
 * Calculate takeoff 50ft obstacle clearance distance using trilinear interpolation
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters (weight, pressure altitude, temperature, runway length)
 * @returns The calculated 50ft obstacle clearance distance in feet, or null if calculation fails
 */
export function calculateTakeoff50ftObstacle(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  try {
    // Check for null/undefined inputs
    if (params.weight === null || params.weight === undefined) {
      return null;
    }
    if (
      params.pressureAltitude === null ||
      params.pressureAltitude === undefined
    ) {
      return null;
    }
    if (params.temperature === null || params.temperature === undefined) {
      return null;
    }

    const aircraft = aircraftData.find((a) => a.id === aircraftModel);
    if (!aircraft || !aircraft.shortFieldTakeoff) {
      return null;
    }

    const { weight, pressureAltitude, temperature } = params;
    const { weights, pressureAltitudes, temperatures, data } =
      aircraft.shortFieldTakeoff;

    // Find the weight index for the data array
    const weightIndex = findWeightIndex(weights, weight);
    if (weightIndex === -1) {
      return null;
    }

    // Create trilinear interpolation table for 50ft obstacle clearance data
    const obstacle50ftTable: TrilinearInterpolationTable = {
      weights: [
        weights[weightIndex],
        weights[weightIndex + 1] || weights[weightIndex],
      ],
      pressureAltitudes,
      temperatures,
      data: [
        data[weightIndex].groundRoll50ft,
        data[weightIndex + 1]?.groundRoll50ft ||
          data[weightIndex].groundRoll50ft,
      ],
    };

    const distance = trilinearInterpolate(
      obstacle50ftTable,
      weight,
      pressureAltitude,
      temperature,
      { allowExtrapolation: true, warnOnExtrapolation: true }
    );

    if (distance === null) {
      return null;
    }

    return Math.round(distance);
  } catch (error) {
    console.error("Error calculating takeoff 50ft obstacle clearance:", error);
    return null;
  }
}

/**
 * Calculate landing ground roll distance using trilinear interpolation
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters (weight, pressure altitude, temperature, runway length)
 * @returns The calculated landing ground roll distance in feet, or null if calculation fails
 */
export function calculateLandingGroundRoll(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  try {
    // Check for null/undefined inputs
    if (
      params.pressureAltitude === null ||
      params.pressureAltitude === undefined
    ) {
      return null;
    }
    if (params.temperature === null || params.temperature === undefined) {
      return null;
    }

    const aircraft = aircraftData.find((a) => a.id === aircraftModel);

    if (!aircraft) {
      return null;
    }

    // Check if shortFieldLanding data is available
    if (!aircraft.shortFieldLanding) {
      console.warn(
        `Landing performance data not available for aircraft ${aircraftModel}`
      );
      return null;
    }

    const { pressureAltitude, temperature } = params;
    const { pressureAltitudes, temperatures, data } =
      aircraft.shortFieldLanding;

    // For landing data, use bilinear interpolation (pressure altitude × temperature)
    // since there's only one weight (2950 lbs)

    const distance = bilinearInterpolate(
      {
        xAxis: pressureAltitudes,
        yAxis: temperatures,
        data: data[0].groundRoll,
      },
      pressureAltitude,
      temperature,
      { allowExtrapolation: true, warnOnExtrapolation: true }
    );

    if (distance === null) {
      return null;
    }

    return Math.round(distance);
  } catch (error) {
    console.error("Error calculating landing ground roll:", error);
    return null;
  }
}

/**
 * Calculate landing 50ft obstacle clearance distance using trilinear interpolation
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters (weight, pressure altitude, temperature, runway length)
 * @returns The calculated landing 50ft obstacle clearance distance in feet, or null if calculation fails
 */
export function calculateLanding50ftObstacle(
  aircraftModel: string,
  params: TOLDCalculationParams
): number | null {
  try {
    // Check for null/undefined inputs
    if (
      params.pressureAltitude === null ||
      params.pressureAltitude === undefined
    ) {
      return null;
    }
    if (params.temperature === null || params.temperature === undefined) {
      return null;
    }

    const aircraft = aircraftData.find((a) => a.id === aircraftModel);

    if (!aircraft) {
      return null;
    }

    // Check if shortFieldLanding data is available
    if (!aircraft.shortFieldLanding) {
      console.warn(
        `Landing performance data not available for aircraft ${aircraftModel}`
      );
      return null;
    }

    const { pressureAltitude, temperature } = params;
    const { pressureAltitudes, temperatures, data } =
      aircraft.shortFieldLanding;

    // For landing data, use bilinear interpolation (pressure altitude × temperature)
    // since there's only one weight (2950 lbs)

    const distance = bilinearInterpolate(
      {
        xAxis: pressureAltitudes,
        yAxis: temperatures,
        data: data[0].groundRoll50ft,
      },
      pressureAltitude,
      temperature,
      { allowExtrapolation: true, warnOnExtrapolation: true }
    );

    if (distance === null) {
      return null;
    }

    return Math.round(distance);
  } catch (error) {
    console.error("Error calculating landing 50ft obstacle clearance:", error);
    return null;
  }
}

/**
 * Calculate available runway remaining after required distance
 * @param runwayLength The total runway length in feet (can be null)
 * @param takeoffDistance The required distance for takeoff in feet (can be null)
 * @param landingDistance The required distance for landing in feet (can be null)
 * @returns The available runway remaining in feet, or null if calculation fails
 */
export function calculateAvailableRunwayRemaining(
  runwayLength: number | null,
  takeoffDistance: number | null,
  landingDistance: number | null
): number | null {
  try {
    // If runway length is not specified, return null
    if (runwayLength === null || runwayLength === undefined) {
      return null;
    }

    // Validate inputs
    if (runwayLength <= 0) {
      console.error("Invalid runway length:", runwayLength);
      return null;
    }

    // Both takeoff and landing distances are required
    if (takeoffDistance === null || landingDistance === null) {
      return null;
    }

    // Calculate total required distance (takeoff + landing)
    const totalRequiredDistance = takeoffDistance + landingDistance;

    const remaining = runwayLength - totalRequiredDistance;

    // Return the remaining distance (can be negative if runway is too short)
    return Math.round(remaining);
  } catch (error) {
    console.error("Error calculating available runway remaining:", error);
    return null;
  }
}

/**
 * Calculate all TOLD distances for a given aircraft and parameters
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters
 * @returns Object containing all calculated distances
 */
export function calculateAllTOLDDistances(
  aircraftModel: string,
  params: TOLDCalculationParams
) {
  const takeoffGroundRoll = calculateTakeoffGroundRoll(aircraftModel, params);
  const takeoff50ftObstacle = calculateTakeoff50ftObstacle(
    aircraftModel,
    params
  );
  const landingGroundRoll = calculateLandingGroundRoll(aircraftModel, params);
  const landing50ftObstacle = calculateLanding50ftObstacle(
    aircraftModel,
    params
  );

  return {
    takeoffGroundRoll,
    takeoff50ftObstacle,
    landingGroundRoll,
    landing50ftObstacle,
    availableRunwayRemainingTakeoffGroundRoll:
      calculateAvailableRunwayRemaining(
        params.runwayLength,
        takeoffGroundRoll,
        landingGroundRoll
      ),
    availableRunwayRemainingTakeoff50ft: calculateAvailableRunwayRemaining(
      params.runwayLength,
      takeoff50ftObstacle,
      landing50ftObstacle
    ),
  };
}

/**
 * Enhanced extrapolation handling for TOLD calculations
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters
 * @returns Object with calculation results and extrapolation warnings
 */
export function calculateTOLDWithExtrapolationHandling(
  aircraftModel: string,
  params: TOLDCalculationParams
): {
  results: ReturnType<typeof calculateAllTOLDDistances>;
  extrapolationWarnings: TOLDError[];
} {
  const extrapolationWarnings: TOLDError[] = [];

  // Check for extrapolation scenarios
  const aircraft = aircraftData.find((a) => a.id === aircraftModel);
  if (!aircraft) {
    return {
      results: calculateAllTOLDDistances(aircraftModel, params),
      extrapolationWarnings: [
        {
          type: "aircraft_not_found",
          message: `Aircraft model ${aircraftModel} not found`,
          severity: "error",
        },
      ],
    };
  }

  // Check weight extrapolation
  if (
    aircraft.shortFieldTakeoff &&
    params.weight !== null &&
    params.weight !== undefined
  ) {
    const { weights } = aircraft.shortFieldTakeoff;
    if (
      params.weight < weights[0] ||
      params.weight > weights[weights.length - 1]
    ) {
      extrapolationWarnings.push({
        type: "extrapolation_warning",
        message: `Weight (${
          params.weight
        } lbs) is outside aircraft performance data range (${weights[0]}-${
          weights[weights.length - 1]
        } lbs)`,
        field: "weight",
        severity: "warning",
      });
    }
  }

  // Check pressure altitude extrapolation
  if (
    aircraft.shortFieldTakeoff &&
    params.pressureAltitude !== null &&
    params.pressureAltitude !== undefined
  ) {
    const { pressureAltitudes } = aircraft.shortFieldTakeoff;
    if (
      params.pressureAltitude < pressureAltitudes[0] ||
      params.pressureAltitude > pressureAltitudes[pressureAltitudes.length - 1]
    ) {
      extrapolationWarnings.push({
        type: "extrapolation_warning",
        message: `Pressure altitude (${
          params.pressureAltitude
        } ft) is outside performance data range (${pressureAltitudes[0]}-${
          pressureAltitudes[pressureAltitudes.length - 1]
        } ft)`,
        field: "pressureAltitude",
        severity: "warning",
      });
    }
  }

  // Check temperature extrapolation
  if (
    aircraft.shortFieldTakeoff &&
    params.temperature !== null &&
    params.temperature !== undefined
  ) {
    const { temperatures } = aircraft.shortFieldTakeoff;
    if (
      params.temperature < temperatures[0] ||
      params.temperature > temperatures[temperatures.length - 1]
    ) {
      extrapolationWarnings.push({
        type: "extrapolation_warning",
        message: `Temperature (${
          params.temperature
        }°C) is outside performance data range (${temperatures[0]}-${
          temperatures[temperatures.length - 1]
        }°C)`,
        field: "temperature",
        severity: "warning",
      });
    }
  }

  // Perform calculations with extrapolation enabled
  const results = calculateAllTOLDDistances(aircraftModel, params);

  return {
    results,
    extrapolationWarnings,
  };
}

/**
 * Safe TOLD calculation with comprehensive error handling
 * @param aircraftModel The aircraft model identifier
 * @param params Calculation parameters
 * @returns Comprehensive calculation result with validation and extrapolation info
 */
export function calculateTOLDSafe(
  aircraftModel: string,
  params: TOLDCalculationParams
): {
  success: boolean;
  results?: ReturnType<typeof calculateAllTOLDDistances>;
  validationErrors: TOLDError[];
  validationWarnings: TOLDError[];
  extrapolationWarnings: TOLDError[];
  errors: TOLDError[];
} {
  const validationErrors: TOLDError[] = [];
  const validationWarnings: TOLDError[] = [];
  const extrapolationWarnings: TOLDError[] = [];
  const errors: TOLDError[] = [];

  try {
    // Validate inputs
    const weightValidation = validateAircraftWeight(
      params.weight,
      aircraftModel
    );
    const altitudeValidation = validatePressureAltitude(
      params.pressureAltitude
    );
    const temperatureValidation = validateTemperature(params.temperature);
    const runwayValidation = validateRunwayLength(params.runwayLength);

    validationErrors.push(
      ...weightValidation.errors,
      ...altitudeValidation.errors,
      ...temperatureValidation.errors,
      ...runwayValidation.errors
    );
    validationWarnings.push(
      ...weightValidation.warnings,
      ...altitudeValidation.warnings,
      ...temperatureValidation.warnings,
      ...runwayValidation.warnings
    );

    // If there are validation errors, don't proceed with calculations
    if (validationErrors.length > 0) {
      return {
        success: false,
        validationErrors,
        validationWarnings,
        extrapolationWarnings,
        errors: validationErrors,
      };
    }

    // Perform calculations with extrapolation handling
    const { results, extrapolationWarnings: extrapWarnings } =
      calculateTOLDWithExtrapolationHandling(aircraftModel, params);
    extrapolationWarnings.push(...extrapWarnings);

    return {
      success: true,
      results,
      validationErrors,
      validationWarnings,
      extrapolationWarnings,
      errors: [],
    };
  } catch (error) {
    errors.push({
      type: "calculation_failed",
      message: `TOLD calculation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      severity: "error",
    });

    return {
      success: false,
      validationErrors,
      validationWarnings,
      extrapolationWarnings,
      errors,
    };
  }
}

/**
 * Helper function to find the appropriate weight index for interpolation
 * @param weights Array of weight values
 * @param targetWeight The target weight to find
 * @returns The index of the weight bracket, or -1 if not found
 */
function findWeightIndex(weights: number[], targetWeight: number): number {
  // Handle single weight case
  if (weights.length === 1) {
    return 0;
  }

  for (let i = 0; i < weights.length - 1; i++) {
    if (targetWeight >= weights[i] && targetWeight <= weights[i + 1]) {
      return i;
    }
  }

  // Handle extrapolation cases
  if (targetWeight < weights[0]) {
    return 0;
  } else if (targetWeight > weights[weights.length - 1]) {
    return weights.length - 2;
  }

  return -1;
}

/**
 * Validate aircraft weight against aircraft specifications
 * @param weight The aircraft weight in pounds (can be null or undefined)
 * @param aircraftModel The aircraft model identifier
 * @returns Validation result with errors and warnings
 */
export function validateAircraftWeight(
  weight: number | null | undefined,
  aircraftModel: string
): TOLDValidationResult {
  const errors: TOLDError[] = [];
  const warnings: TOLDError[] = [];

  // Handle null/undefined weight
  if (weight === null || weight === undefined) {
    errors.push({
      type: "invalid_input",
      message: "Aircraft weight is required for TOLD calculations",
      field: "weight",
      severity: "error",
    });
    return { isValid: false, errors, warnings };
  }

  const aircraft = aircraftData.find((a) => a.id === aircraftModel);
  if (!aircraft) {
    errors.push({
      type: "aircraft_not_found",
      message: `Aircraft model ${aircraftModel} not found`,
      field: "aircraftModel",
      severity: "error",
    });
    return { isValid: false, errors, warnings };
  }

  // Validate weight range
  if (weight <= 0) {
    errors.push({
      type: "invalid_input",
      message: "Weight must be greater than 0",
      field: "weight",
      severity: "error",
    });
  } else if (weight < aircraft.emptyWeight) {
    errors.push({
      type: "weight_out_of_range",
      message: `Weight (${weight} lbs) is below empty weight (${aircraft.emptyWeight} lbs)`,
      field: "weight",
      severity: "error",
    });
  } else if (weight > aircraft.maxGrossWeight) {
    errors.push({
      type: "weight_out_of_range",
      message: `Weight (${weight} lbs) exceeds maximum gross weight (${aircraft.maxGrossWeight} lbs)`,
      field: "weight",
      severity: "error",
    });
  } else if (weight > aircraft.maxGrossWeight * 0.95) {
    warnings.push({
      type: "weight_out_of_range",
      message: `Weight (${weight} lbs) is above 95% of maximum gross weight`,
      field: "weight",
      severity: "warning",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate pressure altitude against typical operating ranges
 * @param pressureAltitude The pressure altitude in feet (can be null or undefined)
 * @returns Validation result with errors and warnings
 */
export function validatePressureAltitude(
  pressureAltitude: number | null | undefined
): TOLDValidationResult {
  const errors: TOLDError[] = [];
  const warnings: TOLDError[] = [];

  // Handle null/undefined pressure altitude
  if (pressureAltitude === null || pressureAltitude === undefined) {
    errors.push({
      type: "invalid_input",
      message: "Pressure altitude is required for TOLD calculations",
      field: "pressureAltitude",
      severity: "error",
    });
    return { isValid: false, errors, warnings };
  }

  if (pressureAltitude > 15000) {
    warnings.push({
      type: "altitude_out_of_range",
      message:
        "Pressure altitude above 15,000 ft may require special considerations",
      field: "pressureAltitude",
      severity: "warning",
    });
  } else if (pressureAltitude > 10000) {
    warnings.push({
      type: "altitude_out_of_range",
      message: "High altitude operations require careful performance planning",
      field: "pressureAltitude",
      severity: "warning",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate temperature against typical operating ranges
 * @param temperature The temperature in Celsius (can be null or undefined)
 * @returns Validation result with errors and warnings
 */
export function validateTemperature(
  temperature: number | null | undefined
): TOLDValidationResult {
  const errors: TOLDError[] = [];
  const warnings: TOLDError[] = [];

  // Handle null/undefined temperature
  if (temperature === null || temperature === undefined) {
    errors.push({
      type: "invalid_input",
      message: "Temperature is required for TOLD calculations",
      field: "temperature",
      severity: "error",
    });
    return { isValid: false, errors, warnings };
  }

  if (temperature < -50) {
    errors.push({
      type: "temperature_out_of_range",
      message: "Temperature below -50°C is outside typical operating range",
      field: "temperature",
      severity: "error",
    });
  } else if (temperature > 60) {
    errors.push({
      type: "temperature_out_of_range",
      message: "Temperature above 60°C is outside typical operating range",
      field: "temperature",
      severity: "error",
    });
  } else if (temperature < -20 || temperature > 40) {
    warnings.push({
      type: "temperature_out_of_range",
      message: "Extreme temperature conditions may affect performance",
      field: "temperature",
      severity: "warning",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate runway length against typical requirements
 * @param runwayLength The runway length in feet (can be null or undefined)
 * @returns Validation result with errors and warnings
 */
export function validateRunwayLength(
  runwayLength: number | null | undefined
): TOLDValidationResult {
  const errors: TOLDError[] = [];
  const warnings: TOLDError[] = [];

  // Handle null/undefined runway length
  if (runwayLength === null || runwayLength === undefined) {
    warnings.push({
      type: "runway_length_missing",
      message:
        "Runway length not specified - calculations will not include available runway remaining",
      field: "runwayLength",
      severity: "warning",
    });
    return { isValid: true, errors, warnings };
  }

  if (runwayLength <= 0) {
    errors.push({
      type: "invalid_input",
      message: "Runway length must be greater than 0",
      field: "runwayLength",
      severity: "error",
    });
  } else if (runwayLength < 2000) {
    warnings.push({
      type: "runway_length_missing",
      message:
        "Runway length under 2,000 ft requires careful performance planning",
      field: "runwayLength",
      severity: "warning",
    });
  } else if (runwayLength < 3000) {
    warnings.push({
      type: "runway_length_missing",
      message:
        "Short runway operations require detailed performance calculations",
      field: "runwayLength",
      severity: "warning",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate TOLD calculation input parameters with enhanced null/undefined handling
 * @param params The calculation parameters to validate
 * @returns Validation result with errors and warnings
 */
export function validateTOLDInputs(
  params: TOLDCalculationParams
): TOLDValidationResult {
  const errors: TOLDError[] = [];
  const warnings: TOLDError[] = [];

  // Validate weight - handle null/undefined
  if (params.weight === null || params.weight === undefined) {
    errors.push({
      type: "invalid_input",
      message: "Aircraft weight is required for TOLD calculations",
      field: "weight",
      severity: "error",
    });
  } else if (params.weight <= 0) {
    errors.push({
      type: "invalid_input",
      message: "Weight must be greater than 0",
      field: "weight",
      severity: "error",
    });
  }

  // Validate pressure altitude - handle null/undefined
  if (
    params.pressureAltitude === null ||
    params.pressureAltitude === undefined
  ) {
    errors.push({
      type: "invalid_input",
      message: "Pressure altitude is required for TOLD calculations",
      field: "pressureAltitude",
      severity: "error",
    });
  }

  // Validate temperature - handle null/undefined
  if (params.temperature === null || params.temperature === undefined) {
    errors.push({
      type: "invalid_input",
      message: "Temperature is required for TOLD calculations",
      field: "temperature",
      severity: "error",
    });
  } else if (params.temperature < -50 || params.temperature > 60) {
    warnings.push({
      type: "temperature_out_of_range",
      message: "Temperature outside typical operating range (-50°C to 60°C)",
      field: "temperature",
      severity: "warning",
    });
  }

  // Validate runway length - handle null/undefined
  if (params.runwayLength === null || params.runwayLength === undefined) {
    warnings.push({
      type: "runway_length_missing",
      message:
        "Runway length not specified - calculations will not include available runway remaining",
      field: "runwayLength",
      severity: "warning",
    });
  } else if (params.runwayLength <= 0) {
    errors.push({
      type: "invalid_input",
      message: "Runway length must be greater than 0",
      field: "runwayLength",
      severity: "error",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate TOLD distances for multiple airports (departure and arrival)
 * @param aircraftModel The aircraft model identifier
 * @param inputs The TOLD input parameters for multiple airports
 * @returns Comprehensive calculation results for all airports
 */
export function calculateTOLDForMultipleAirports(
  aircraftModel: string,
  inputs: {
    weight: number;
    pressureAltitudes: [number | null, number | null];
    temperatures: [number | null, number | null];
    runwayLengths: [number | null, number | null];
  }
): {
  success: boolean;
  results?: {
    takeoffGroundRoll: { departure: number | null; arrival: number | null };
    takeoff50ftObstacle: { departure: number | null; arrival: number | null };
    landingGroundRoll: { departure: number | null; arrival: number | null };
    landing50ftObstacle: { departure: number | null; arrival: number | null };
    availableRunwayRemainingTakeoffGroundRoll: {
      departure: number | null;
      arrival: number | null;
    };
    availableRunwayRemainingTakeoff50ft: {
      departure: number | null;
      arrival: number | null;
    };
  };
  validationErrors: TOLDError[];
  validationWarnings: TOLDError[];
  extrapolationWarnings: TOLDError[];
  errors: TOLDError[];
} {
  const allValidationErrors: TOLDError[] = [];
  const allValidationWarnings: TOLDError[] = [];
  const allExtrapolationWarnings: TOLDError[] = [];
  const allErrors: TOLDError[] = [];

  // Calculate for departure airport when PA and temp are available
  let departureResults: ReturnType<typeof calculateAllTOLDDistances> | null =
    null;
  if (inputs.pressureAltitudes[0] !== null && inputs.temperatures[0] !== null) {
    const departureParams: TOLDCalculationParams = {
      weight: inputs.weight,
      pressureAltitude: inputs.pressureAltitudes[0],
      temperature: inputs.temperatures[0],
      runwayLength: inputs.runwayLengths[0],
    };

    const departureResult = calculateTOLDSafe(aircraftModel, departureParams);

    if (departureResult.success && departureResult.results) {
      departureResults = departureResult.results;
    }

    allValidationErrors.push(...departureResult.validationErrors);
    allValidationWarnings.push(...departureResult.validationWarnings);
    allExtrapolationWarnings.push(...departureResult.extrapolationWarnings);
    allErrors.push(...departureResult.errors);
  }

  // Calculate for arrival airport when PA and temp are available
  let arrivalResults: ReturnType<typeof calculateAllTOLDDistances> | null =
    null;
  if (inputs.pressureAltitudes[1] !== null && inputs.temperatures[1] !== null) {
    const arrivalParams: TOLDCalculationParams = {
      weight: inputs.weight,
      pressureAltitude: inputs.pressureAltitudes[1],
      temperature: inputs.temperatures[1],
      runwayLength: inputs.runwayLengths[1],
    };

    const arrivalResult = calculateTOLDSafe(aircraftModel, arrivalParams);

    if (arrivalResult.success && arrivalResult.results) {
      arrivalResults = arrivalResult.results;
    }

    allValidationErrors.push(...arrivalResult.validationErrors);
    allValidationWarnings.push(...arrivalResult.validationWarnings);
    allExtrapolationWarnings.push(...arrivalResult.extrapolationWarnings);
    allErrors.push(...arrivalResult.errors);
  }

  // Combine results into TOLDResults format
  const combinedResults = {
    takeoffGroundRoll: {
      departure: departureResults?.takeoffGroundRoll ?? null,
      arrival: arrivalResults?.takeoffGroundRoll ?? null,
    },
    takeoff50ftObstacle: {
      departure: departureResults?.takeoff50ftObstacle ?? null,
      arrival: arrivalResults?.takeoff50ftObstacle ?? null,
    },
    landingGroundRoll: {
      departure: departureResults?.landingGroundRoll ?? null,
      arrival: arrivalResults?.landingGroundRoll ?? null,
    },
    landing50ftObstacle: {
      departure: departureResults?.landing50ftObstacle ?? null,
      arrival: arrivalResults?.landing50ftObstacle ?? null,
    },
    availableRunwayRemainingTakeoffGroundRoll: {
      departure:
        departureResults?.availableRunwayRemainingTakeoffGroundRoll ?? null,
      arrival:
        arrivalResults?.availableRunwayRemainingTakeoffGroundRoll ?? null,
    },
    availableRunwayRemainingTakeoff50ft: {
      departure: departureResults?.availableRunwayRemainingTakeoff50ft ?? null,
      arrival: arrivalResults?.availableRunwayRemainingTakeoff50ft ?? null,
    },
  };

  return {
    success: allErrors.length === 0,
    results: combinedResults,
    validationErrors: allValidationErrors,
    validationWarnings: allValidationWarnings,
    extrapolationWarnings: allExtrapolationWarnings,
    errors: allErrors,
  };
}
