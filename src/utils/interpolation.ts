// Type definitions
export interface InterpolationTable {
  xAxis: number[];
  yAxis: number[];
  data: number[][];
}

export interface FlexibleInterpolationTable {
  [key: string]: number[] | number[][];
  data: number[][];
}

export interface InterpolationOptions {
  allowExtrapolation?: boolean;
  warnOnExtrapolation?: boolean;
  xAxisName?: string;
  yAxisName?: string;
}

export interface InterpolationResult {
  value: number;
  wasExtrapolated: boolean;
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

// Main bilinear interpolation function with standard table structure
function bilinearInterpolate(
  table: InterpolationTable,
  xValue: number,
  yValue: number,
  options: InterpolationOptions = {}
): number {
  const { allowExtrapolation = true, warnOnExtrapolation = true } = options;
  const { xAxis, yAxis, data } = table;

  return performInterpolation(xAxis, yAxis, data, xValue, yValue, {
    allowExtrapolation,
    warnOnExtrapolation,
  });
}

// Flexible interpolation function with dynamic property names
function bilinearInterpolateFlexible(
  table: FlexibleInterpolationTable,
  xValue: number,
  yValue: number,
  options: Required<Pick<InterpolationOptions, "xAxisName" | "yAxisName">> &
    Partial<
      Pick<InterpolationOptions, "allowExtrapolation" | "warnOnExtrapolation">
    >
): number {
  const {
    xAxisName,
    yAxisName,
    allowExtrapolation = true,
    warnOnExtrapolation = true,
  } = options;

  const xAxis = table[xAxisName] as number[];
  const yAxis = table[yAxisName] as number[];
  const { data } = table;

  if (!Array.isArray(xAxis) || !Array.isArray(yAxis)) {
    throw new Error(
      `Invalid axis data: ${xAxisName} or ${yAxisName} is not an array`
    );
  }

  return performInterpolation(xAxis, yAxis, data, xValue, yValue, {
    allowExtrapolation,
    warnOnExtrapolation,
  });
}

// Enhanced version that returns detailed results
function bilinearInterpolateDetailed(
  table: InterpolationTable,
  xValue: number,
  yValue: number,
  options: InterpolationOptions = {}
): InterpolationResult {
  const { allowExtrapolation = true, warnOnExtrapolation = true } = options;
  const { xAxis, yAxis, data } = table;

  const xMin = Math.min(...xAxis);
  const xMax = Math.max(...xAxis);
  const yMin = Math.min(...yAxis);
  const yMax = Math.max(...yAxis);

  const wasExtrapolated =
    xValue < xMin || xValue > xMax || yValue < yMin || yValue > yMax;

  const value = performInterpolation(xAxis, yAxis, data, xValue, yValue, {
    allowExtrapolation,
    warnOnExtrapolation,
  });

  return {
    value,
    wasExtrapolated,
    bounds: { xMin, xMax, yMin, yMax },
  };
}

// Core interpolation logic (private function)
function performInterpolation(
  xAxis: number[],
  yAxis: number[],
  data: number[][],
  xValue: number,
  yValue: number,
  options: Pick<
    InterpolationOptions,
    "allowExtrapolation" | "warnOnExtrapolation"
  >
): number {
  const { allowExtrapolation = true, warnOnExtrapolation = true } = options;

  // Validation
  if (xAxis.length === 0 || yAxis.length === 0) {
    throw new Error("Axis arrays cannot be empty");
  }

  if (data.some((row) => row.length !== yAxis.length)) {
    throw new Error(
      `All data rows must have ${yAxis.length} columns to match yAxis`
    );
  }

  if (data.length !== xAxis.length) {
    throw new Error(
      `Data rows (${data.length}) must match xAxis length (${xAxis.length})`
    );
  }

  // Handle special cases first
  if (xAxis.length === 1 && yAxis.length === 1) {
    return data[0][0];
  }

  if (xAxis.length === 1) {
    // Linear interpolation along y-axis only
    if (yAxis.length < 2) {
      throw new Error("Need at least 2 y-axis values for interpolation");
    }
    return linearInterpolate(yAxis, data[0], yValue, {
      allowExtrapolation,
      warnOnExtrapolation,
      axisName: "y",
    });
  }

  if (yAxis.length === 1) {
    // Linear interpolation along x-axis only
    if (xAxis.length < 2) {
      throw new Error("Need at least 2 x-axis values for interpolation");
    }
    const xData = data.map((row) => row[0]);
    return linearInterpolate(xAxis, xData, xValue, {
      allowExtrapolation,
      warnOnExtrapolation,
      axisName: "x",
    });
  }

  // Full bilinear interpolation (both axes have multiple values)
  // Check bounds
  const xMin = Math.min(...xAxis);
  const xMax = Math.max(...xAxis);
  const yMin = Math.min(...yAxis);
  const yMax = Math.max(...yAxis);

  const isExtrapolating =
    xValue < xMin || xValue > xMax || yValue < yMin || yValue > yMax;

  if (isExtrapolating) {
    if (!allowExtrapolation) {
      throw new Error(
        `Values outside table range: x=${xValue} (range: ${xMin}-${xMax}), ` +
          `y=${yValue} (range: ${yMin}-${yMax})`
      );
    }

    if (warnOnExtrapolation) {
      console.warn(
        `Warning: Extrapolating outside table bounds. ` +
          `x=${xValue} (table: ${xMin}-${xMax}), y=${yValue} (table: ${yMin}-${yMax}). ` +
          `Results may be unreliable.`
      );
    }
  }

  // Find surrounding indices
  const xIndex = findSurroundingIndex(xAxis, xValue);
  const yIndex = findSurroundingIndex(yAxis, yValue);

  // Get corner values
  const x1 = xAxis[xIndex];
  const x2 = xAxis[xIndex + 1];
  const y1 = yAxis[yIndex];
  const y2 = yAxis[yIndex + 1];

  const q11 = data[xIndex][yIndex]; // Value at (x1, y1)
  const q12 = data[xIndex][yIndex + 1]; // Value at (x1, y2)
  const q21 = data[xIndex + 1][yIndex]; // Value at (x2, y1)
  const q22 = data[xIndex + 1][yIndex + 1]; // Value at (x2, y2)

  // Bilinear interpolation
  const t = (xValue - x1) / (x2 - x1);
  const u = (yValue - y1) / (y2 - y1);

  return (
    (1 - t) * (1 - u) * q11 +
    t * (1 - u) * q21 +
    (1 - t) * u * q12 +
    t * u * q22
  );
}

// Helper function to find surrounding index
function findSurroundingIndex(axis: number[], value: number): number {
  // Handle single-value axis (no interpolation needed)
  if (axis.length === 1) {
    return 0;
  }

  // Handle two-value axis
  if (axis.length === 2) {
    return 0; // Always use indices 0 and 1
  }

  // Find surrounding indices for multi-value axis
  for (let i = 0; i < axis.length - 1; i++) {
    if (value >= axis[i] && value <= axis[i + 1]) {
      return i;
    }
  }

  // Handle extrapolation
  if (value < axis[0]) {
    return 0;
  } else {
    return axis.length - 2;
  }
}

// Helper function for linear interpolation
function linearInterpolate(
  axis: number[],
  data: number[],
  value: number,
  options: {
    allowExtrapolation: boolean;
    warnOnExtrapolation: boolean;
    axisName: string;
  }
): number {
  const { allowExtrapolation, warnOnExtrapolation, axisName } = options;

  // Check bounds
  const min = Math.min(...axis);
  const max = Math.max(...axis);
  const isExtrapolating = value < min || value > max;

  if (isExtrapolating) {
    if (!allowExtrapolation) {
      throw new Error(
        `${axisName}-value ${value} outside range: ${min}-${max}`
      );
    }

    if (warnOnExtrapolation) {
      console.warn(
        `Warning: Extrapolating ${axisName}-value ${value} outside range ${min}-${max}`
      );
    }
  }

  // Find surrounding indices
  const index = findSurroundingIndex(axis, value);

  // Linear interpolation
  const v1 = axis[index];
  const v2 = axis[index + 1];
  const d1 = data[index];
  const d2 = data[index + 1];

  const t = (value - v1) / (v2 - v1);
  return d1 + t * (d2 - d1);
}

// Generic table creator function
function createInterpolationTable<T extends string>(
  xAxisValues: number[],
  yAxisValues: number[],
  dataMatrix: number[][],
  xAxisName?: T,
  yAxisName?: T
): InterpolationTable | FlexibleInterpolationTable {
  const baseTable = {
    xAxis: xAxisValues,
    yAxis: yAxisValues,
    data: dataMatrix,
  };

  if (xAxisName && yAxisName) {
    return {
      ...baseTable,
      [xAxisName]: xAxisValues,
      [yAxisName]: yAxisValues,
    } as FlexibleInterpolationTable;
  }

  return baseTable;
}

/**
 * Find the X value that produces a target Z value at a given Y value.
 * For example: find the altitude (X) where climb rate (Z) is 300 fpm at 30°C (Y)
 * @param data 2D array of Z values indexed by [x][y]
 * @param xAxis Array of X values (e.g., pressure altitudes)
 * @param yAxis Array of Y values (e.g., temperatures)
 * @param targetZ The Z value to find (e.g., target climb rate)
 * @param yVal The Y value to use (e.g., temperature)
 * @returns The X value that produces targetZ at yVal
 */
function findInverseXgivenYandZ(
  data: number[][],
  xAxis: number[],
  yAxis: number[],
  targetZ: number,
  yVal: number
): number {
  // Upfront validation
  if (data.length !== xAxis.length) {
    throw new Error(`Data row count (${data.length}) does not match xAxis length (${xAxis.length}).`);
  }
  for (let i = 0; i < data.length; i++) {
    if (data[i].length !== yAxis.length) {
      throw new Error(`Data row ${i} length (${data[i].length}) does not match yAxis length (${yAxis.length}).`);
    }
  }
  // Check monotonicity of xAxis
  for (let i = 1; i < xAxis.length; i++) {
    if (xAxis[i] <= xAxis[i - 1]) {
      throw new Error(`xAxis must be strictly increasing. Found xAxis[${i - 1}] = ${xAxis[i - 1]}, xAxis[${i}] = ${xAxis[i]}.`);
    }
  }
  // Check monotonicity of yAxis
  for (let i = 1; i < yAxis.length; i++) {
    if (yAxis[i] <= yAxis[i - 1]) {
      throw new Error(`yAxis must be strictly increasing. Found yAxis[${i - 1}] = ${yAxis[i - 1]}, yAxis[${i}] = ${yAxis[i]}.`);
    }
  }
  // First interpolate values at our y-value (temperature) for each x (altitude)
  const zValuesAtY: number[] = [];

  // For each altitude (x value), find the climb rate at our temperature
  for (let i = 0; i < xAxis.length; i++) {
    let zAtY: number;

    // Check if y-value (temperature) is exactly in the table
    const yIndex = yAxis.indexOf(yVal);
    if (yIndex !== -1) {
      // Exact match - use the value directly
      zAtY = data[i][yIndex];
    } else {
      // Find surrounding y indices
      const yIdx = findSurroundingIndex(yAxis, yVal);
      const y1 = yAxis[yIdx];
      const y2 = yAxis[yIdx + 1];
      const z1 = data[i][yIdx]; // Climb rate at lower temperature
      const z2 = data[i][yIdx + 1]; // Climb rate at higher temperature

      // Linear interpolation for temperature
      const t = (yVal - y1) / (y2 - y1);
      zAtY = z1 + t * (z2 - z1);
    }
    zValuesAtY.push(zAtY);
  }

  // Now find where these interpolated values match our target
  for (let i = 0; i < xAxis.length - 1; i++) {
    const z1 = zValuesAtY[i];
    const z2 = zValuesAtY[i + 1];

    // Check if target is between these points
    if ((targetZ >= z1 && targetZ <= z2) || (targetZ >= z2 && targetZ <= z1)) {
      const x1 = xAxis[i];
      const x2 = xAxis[i + 1];
      // Linear interpolation to find exact x
      const t = (targetZ - z1) / (z2 - z1);
      return x1 + t * (x2 - x1);
    }
  }

  // Handle extrapolation
  const firstZ = zValuesAtY[0];
  const lastZ = zValuesAtY[zValuesAtY.length - 1];

  if (
    (targetZ < Math.min(firstZ, lastZ))
  ) {
    // Target is below the data range, extrapolate using first two points
    const t = (targetZ - zValuesAtY[0]) / (zValuesAtY[1] - zValuesAtY[0]);
    return xAxis[0] + t * (xAxis[1] - xAxis[0]);
  } else if (
    (targetZ > Math.max(firstZ, lastZ))
  ) {
    // Target is above the data range, extrapolate using last two points
    const last = xAxis.length - 1;
    const t =
      (targetZ - zValuesAtY[last - 1]) /
      (zValuesAtY[last] - zValuesAtY[last - 1]);
    return xAxis[last - 1] + t * (xAxis[last] - xAxis[last - 1]);
  }
  }

  // This should never happen if the data is properly sorted
  throw new Error("Could not find matching climb rate");
}

// Helper function for inverse linear interpolation
function linearInterpolateInverse(
  yValues: number[],
  xValues: number[],
  targetY: number
): number {
  for (let i = 0; i < yValues.length - 1; i++) {
    const y1 = yValues[i];
    const y2 = yValues[i + 1];

    // Check if target is between these two points
    if ((targetY >= y1 && targetY <= y2) || (targetY >= y2 && targetY <= y1)) {
      const x1 = xValues[i];
      const x2 = xValues[i + 1];

      // Linear interpolation: solve for x given y
      const t = (targetY - y1) / (y2 - y1);
      return x1 + t * (x2 - x1);
    }
  }

  // Extrapolation
  if (targetY < Math.min(...yValues)) {
    const t = (targetY - yValues[0]) / (yValues[1] - yValues[0]);
    return xValues[0] + t * (xValues[1] - xValues[0]);
  } else {
    const lastIdx = yValues.length - 1;
    const t =
      (targetY - yValues[lastIdx - 1]) /
      (yValues[lastIdx] - yValues[lastIdx - 1]);
    return xValues[lastIdx - 1] + t * (xValues[lastIdx] - xValues[lastIdx - 1]);
  }
}

export {
  bilinearInterpolate,
  bilinearInterpolateFlexible,
  bilinearInterpolateDetailed,
  createInterpolationTable,
  findInverseXgivenYandZ,
};
