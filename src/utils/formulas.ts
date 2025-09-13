const farenheitToCelcius = (f: number) => ((f - 32) * 5) / 9;
const celciusToFarenheit = (c: number) => (c * 9) / 5 + 32;

const pressureAltitudeToDensityAltitude = (
  pressureAltitude: number,
  temperatureC: number
) => {
  const standardTempC = 15 - pressureAltitude / 1000 * 2;
  const densityAltitude =
    pressureAltitude + (120 * (temperatureC - standardTempC));
  return densityAltitude;
}

const altitudeToPressureAltitude = (altitude: number, altimeter: number) => {
  return altitude + (29.92 - altimeter) * 1000;
}

export { farenheitToCelcius, celciusToFarenheit, pressureAltitudeToDensityAltitude, altitudeToPressureAltitude };