const pad = (n: number, width: number): string =>
  String(n).padStart(width, "0");

export function latLonToDmsWaypoint(lat: number, lon: number): string {
  const formatComponent = (
    value: number,
    maxDeg: number
  ): { deg: number; min: number; sec: number } => {
    const abs = Math.abs(value);
    let deg = Math.floor(abs);
    const minTotal = (abs - deg) * 60;
    let min = Math.floor(minTotal);
    let sec = Math.round((minTotal - min) * 60);
    if (sec === 60) {
      sec = 0;
      min += 1;
    }
    if (min === 60) {
      min = 0;
      deg += 1;
    }
    if (deg > maxDeg) deg = maxDeg;
    return { deg, min, sec };
  };

  const latParts = formatComponent(lat, 90);
  const lonParts = formatComponent(lon, 180);
  const latSuffix = lat < 0 ? "S" : "N";
  const lonSuffix = lon < 0 ? "W" : "E";

  return (
    pad(latParts.deg, 2) +
    pad(latParts.min, 2) +
    pad(latParts.sec, 2) +
    latSuffix +
    pad(lonParts.deg, 3) +
    pad(lonParts.min, 2) +
    pad(lonParts.sec, 2) +
    lonSuffix
  );
}

export interface BuildSkyvectorUrlInput {
  departure: string;
  arrival: string;
  operating: [number | null, number | null] | null;
}

export function buildSkyvectorUrl(input: BuildSkyvectorUrlInput): string | null {
  const dep = input.departure.trim().toUpperCase();
  const arr = input.arrival.trim().toUpperCase();
  if (!dep || !arr) return null;

  const waypoints: string[] = [dep];
  if (
    input.operating &&
    input.operating[0] !== null &&
    input.operating[1] !== null
  ) {
    waypoints.push(latLonToDmsWaypoint(input.operating[0], input.operating[1]));
  }
  waypoints.push(arr);

  return `https://skyvector.com/?fpl=${waypoints.join("%20")}`;
}
