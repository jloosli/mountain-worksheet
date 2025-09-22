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

// Helper function to find surrounding index for interpolation
function findSurroundingIndex(array: number[], value: number): number {
  for (let i = 0; i < array.length - 1; i++) {
    if (value >= array[i] && value <= array[i + 1]) {
      return i;
    }
  }
  return value < array[0] ? 0 : array.length - 2;
}

// Core interpolation function used by both main functions
function performInterpolation(
  xAxis: number[],
  yAxis: number[],
  data: number[][],
  xValue: number,
  yValue: number,
  options: Required<
    Pick<InterpolationOptions, "allowExtrapolation" | "warnOnExtrapolation">
  >
): number {
  // Validate input dimensions
  if (xAxis.length === 0 || yAxis.length === 0) {
    throw new Error("Axis arrays cannot be empty");
  }

  // Validate row lengths first
  for (const row of data) {
    if (row.length !== yAxis.length) {
      throw new Error(
        `All data rows must have ${yAxis.length} columns to match yAxis`
      );
    }
  }

  if (data.length !== xAxis.length) {
    throw new Error(
      `Data rows (${data.length}) must match xAxis length (${xAxis.length})`
    );
  }

  // Handle single axis tables
  if (xAxis.length === 1) {
    // For single x value, just do 1D interpolation along y
    const yIndex = findSurroundingIndex(yAxis, yValue);
    if (yAxis.length === 1) return data[0][0];
    const y1 = yAxis[yIndex];
    const y2 = yAxis[yIndex + 1];
    const z1 = data[0][yIndex];
    const z2 = data[0][yIndex + 1];
    const t = (yValue - y1) / (y2 - y1);
    return z1 + t * (z2 - z1);
  }
  if (yAxis.length === 1) {
    // For single y value, just do 1D interpolation along x
    const xIndex = findSurroundingIndex(xAxis, xValue);
    const x1 = xAxis[xIndex];
    const x2 = xAxis[xIndex + 1];
    const z1 = data[xIndex][0];
    const z2 = data[xIndex + 1][0];
    const t = (xValue - x1) / (x2 - x1);
    return z1 + t * (z2 - z1);
  }

  // Check for extrapolation
  const isExtrapolatingX =
    xValue < xAxis[0] || xValue > xAxis[xAxis.length - 1];
  const isExtrapolatingY =
    yValue < yAxis[0] || yValue > yAxis[yAxis.length - 1];

  if ((isExtrapolatingX || isExtrapolatingY) && !options.allowExtrapolation) {
    throw new Error("Values outside table range and extrapolation is disabled");
  }

  if ((isExtrapolatingX || isExtrapolatingY) && options.warnOnExtrapolation) {
    console.warn("Extrapolating outside table bounds");
  }

  // Find surrounding indices
  const xIndex = findSurroundingIndex(xAxis, xValue);
  const yIndex = findSurroundingIndex(yAxis, yValue);

  // Get surrounding points
  const x1 = xAxis[xIndex];
  const x2 = xAxis[xIndex + 1];
  const y1 = yAxis[yIndex];
  const y2 = yAxis[yIndex + 1];

  const q11 = data[xIndex][yIndex];
  const q12 = data[xIndex][yIndex + 1];
  const q21 = data[xIndex + 1][yIndex];
  const q22 = data[xIndex + 1][yIndex + 1];

  // Interpolate
  const fx = (xValue - x1) / (x2 - x1);
  const fy = (yValue - y1) / (y2 - y1);

  const r1 = q11 * (1 - fx) + q21 * fx;
  const r2 = q12 * (1 - fx) + q22 * fx;

  return r1 * (1 - fy) + r2 * fy;
}

// Main bilinear interpolation function with standard table structure
export function bilinearInterpolate(
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
export function bilinearInterpolateFlexible(
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
export function bilinearInterpolateDetailed(
  table: InterpolationTable,
  xValue: number,
  yValue: number,
  options: InterpolationOptions = {}
): InterpolationResult {
  const { xAxis, yAxis } = table;
  const isExtrapolatingX =
    xValue < xAxis[0] || xValue > xAxis[xAxis.length - 1];
  const isExtrapolatingY =
    yValue < yAxis[0] || yValue > yAxis[yAxis.length - 1];

  return {
    value: bilinearInterpolate(table, xValue, yValue, options),
    wasExtrapolated: isExtrapolatingX || isExtrapolatingY,
    bounds: {
      xMin: xAxis[0],
      xMax: xAxis[xAxis.length - 1],
      yMin: yAxis[0],
      yMax: yAxis[yAxis.length - 1],
    },
  };
}

// Generic table creator function
export function createInterpolationTable<T extends string>(
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
export function findInverseXgivenYandZ(
  data: number[][],
  xAxis: number[],
  yAxis: number[],
  targetZ: number,
  yVal: number
): number {
  // Upfront validation
  if (data.length !== xAxis.length) {
    throw new Error(
      `Data row count (${data.length}) does not match xAxis length (${xAxis.length}).`
    );
  }
  for (let i = 0; i < data.length; i++) {
    if (data[i].length !== yAxis.length) {
      throw new Error(
        `Data row ${i} length (${data[i].length}) does not match yAxis length (${yAxis.length}).`
      );
    }
  }
  // Check monotonicity of xAxis
  for (let i = 1; i < xAxis.length; i++) {
    if (xAxis[i] <= xAxis[i - 1]) {
      throw new Error(
        `xAxis must be strictly increasing. Found xAxis[${i - 1}] = ${
          xAxis[i - 1]
        }, xAxis[${i}] = ${xAxis[i]}.`
      );
    }
  }
  // Check monotonicity of yAxis
  for (let i = 1; i < yAxis.length; i++) {
    if (yAxis[i] <= yAxis[i - 1]) {
      throw new Error(
        `yAxis must be strictly increasing. Found yAxis[${i - 1}] = ${
          yAxis[i - 1]
        }, yAxis[${i}] = ${yAxis[i]}.`
      );
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

  if (targetZ < Math.min(firstZ, lastZ)) {
    // Target is below the data range, extrapolate using first two points
    const t = (targetZ - zValuesAtY[0]) / (zValuesAtY[1] - zValuesAtY[0]);
    return xAxis[0] + t * (xAxis[1] - xAxis[0]);
  } else if (targetZ > Math.max(firstZ, lastZ)) {
    // Target is above the data range, extrapolate using last two points
    const last = xAxis.length - 1;
    const t =
      (targetZ - zValuesAtY[last - 1]) /
      (zValuesAtY[last] - zValuesAtY[last - 1]);
    return xAxis[last - 1] + t * (xAxis[last] - xAxis[last - 1]);
  }

  // This should never happen if the data is properly sorted
  throw new Error("Could not find matching climb rate");
}
