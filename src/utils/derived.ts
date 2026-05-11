import {
  altitudeToPressureAltitude,
  pressureAltitudeToDensityAltitude,
} from "./formulas";

type Triple = [number | null, number | null, number | null];

function isReal(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && v !== -1;
}

export function computePressureColumns(
  altitudes: Triple,
  altimeters: Triple,
  temperatures: Triple,
): { PAs: Triple; DAs: Triple } {
  const PAs: Triple = [null, null, null];
  const DAs: Triple = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const alt = altitudes[i];
    const altim = altimeters[i];
    const temp = temperatures[i];
    if (isReal(alt) && isReal(altim) && isReal(temp)) {
      const pa = altitudeToPressureAltitude(alt, altim);
      PAs[i] = pa;
      DAs[i] = pressureAltitudeToDensityAltitude(pa, temp);
    }
  }
  return { PAs, DAs };
}
