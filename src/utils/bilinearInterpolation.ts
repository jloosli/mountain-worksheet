// Type definitions
interface InterpolationTable {
  xAxis: number[];
  yAxis: number[];
  data: number[][];
}

interface FlexibleInterpolationTable {
  [key: string]: number[] | number[][];
  data: number[][];
}

interface InterpolationOptions {
  allowExtrapolation?: boolean;
  warnOnExtrapolation?: boolean;
  xAxisName?: string;
  yAxisName?: string;
}

interface InterpolationResult {
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
    warnOnExtrapolation
  });
}

// Flexible interpolation function with dynamic property names
function bilinearInterpolateFlexible(
  table: FlexibleInterpolationTable,
  xValue: number,
  yValue: number,
  options: Required<Pick<InterpolationOptions, 'xAxisName' | 'yAxisName'>> & 
           Partial<Pick<InterpolationOptions, 'allowExtrapolation' | 'warnOnExtrapolation'>>
): number {
  const { 
    xAxisName, 
    yAxisName, 
    allowExtrapolation = true, 
    warnOnExtrapolation = true 
  } = options;
  
  const xAxis = table[xAxisName] as number[];
  const yAxis = table[yAxisName] as number[];
  const { data } = table;
  
  if (!Array.isArray(xAxis) || !Array.isArray(yAxis)) {
    throw new Error(`Invalid axis data: ${xAxisName} or ${yAxisName} is not an array`);
  }
  
  return performInterpolation(xAxis, yAxis, data, xValue, yValue, {
    allowExtrapolation,
    warnOnExtrapolation
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
  
  const wasExtrapolated = xValue < xMin || xValue > xMax || yValue < yMin || yValue > yMax;
  
  const value = performInterpolation(xAxis, yAxis, data, xValue, yValue, {
    allowExtrapolation,
    warnOnExtrapolation
  });
  
  return {
    value,
    wasExtrapolated,
    bounds: { xMin, xMax, yMin, yMax }
  };
}

// Core interpolation logic (private function)
function performInterpolation(
  xAxis: number[],
  yAxis: number[],
  data: number[][],
  xValue: number,
  yValue: number,
  options: Pick<InterpolationOptions, 'allowExtrapolation' | 'warnOnExtrapolation'>
): number {
  const { allowExtrapolation = true, warnOnExtrapolation = true } = options;
  
// Validation
  if (xAxis.length === 0 || yAxis.length === 0) {
    throw new Error('Axis arrays cannot be empty');
  }
  
  if (data.length !== xAxis.length) {
    throw new Error(`Data rows (${data.length}) must match xAxis length (${xAxis.length})`);
  }
  
  if (data.some(row => row.length !== yAxis.length)) {
    throw new Error(`All data rows must have ${yAxis.length} columns to match yAxis`);
  }
  
  // Handle special cases first
  if (xAxis.length === 1 && yAxis.length === 1) {
    return data[0][0];
  }
  
  if (xAxis.length === 1) {
    // Linear interpolation along y-axis only
    if (yAxis.length < 2) {
      throw new Error('Need at least 2 y-axis values for interpolation');
    }
    return linearInterpolate(yAxis, data[0], yValue, { allowExtrapolation, warnOnExtrapolation, axisName: 'y' });
  }
  
  if (yAxis.length === 1) {
    // Linear interpolation along x-axis only
    if (xAxis.length < 2) {
      throw new Error('Need at least 2 x-axis values for interpolation');
    }
    const xData = data.map(row => row[0]);
    return linearInterpolate(xAxis, xData, xValue, { allowExtrapolation, warnOnExtrapolation, axisName: 'x' });
  }
  
  // Full bilinear interpolation (both axes have multiple values)
  // Check bounds
  const xMin = Math.min(...xAxis);
  const xMax = Math.max(...xAxis);
  const yMin = Math.min(...yAxis);
  const yMax = Math.max(...yAxis);
  
  const isExtrapolating = xValue < xMin || xValue > xMax || yValue < yMin || yValue > yMax;
  
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
  
  const q11 = data[xIndex][yIndex];         // Value at (x1, y1)
  const q12 = data[xIndex][yIndex + 1];     // Value at (x1, y2)
  const q21 = data[xIndex + 1][yIndex];     // Value at (x2, y1)
  const q22 = data[xIndex + 1][yIndex + 1]; // Value at (x2, y2)
  
  // Bilinear interpolation
  const t = (xValue - x1) / (x2 - x1);
  const u = (yValue - y1) / (y2 - y1);
  
  return (1 - t) * (1 - u) * q11 + 
         t * (1 - u) * q21 + 
         (1 - t) * u * q12 + 
         t * u * q22;
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
  options: { allowExtrapolation: boolean; warnOnExtrapolation: boolean; axisName: string }
): number {
  const { allowExtrapolation, warnOnExtrapolation, axisName } = options;
  
  // Check bounds
  const min = Math.min(...axis);
  const max = Math.max(...axis);
  const isExtrapolating = value < min || value > max;
  
  if (isExtrapolating) {
    if (!allowExtrapolation) {
      throw new Error(`${axisName}-value ${value} outside range: ${min}-${max}`);
    }
    
    if (warnOnExtrapolation) {
      console.warn(`Warning: Extrapolating ${axisName}-value ${value} outside range ${min}-${max}`);
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

// Convenience function for rate of climb
function getRateOfClimb(
  table: InterpolationTable,
  pressureAltitude: number,
  outsideAirTemp: number,
  options: InterpolationOptions = {}
): number {
  return Math.round(bilinearInterpolate(table, pressureAltitude, outsideAirTemp, options));
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
    data: dataMatrix
  };
  
  if (xAxisName && yAxisName) {
    return {
      ...baseTable,
      [xAxisName]: xAxisValues,
      [yAxisName]: yAxisValues
    } as FlexibleInterpolationTable;
  }
  
  return baseTable;
}

export {
    bilinearInterpolate,
    bilinearInterpolateFlexible,
    bilinearInterpolateDetailed,
    getRateOfClimb,
    createInterpolationTable
};
export type { FlexibleInterpolationTable };
