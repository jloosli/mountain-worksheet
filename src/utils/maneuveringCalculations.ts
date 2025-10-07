import type { ManeuveringSpeeds, ManeuveringSpeedData } from "./types";
import aircraftData from "../data/aircraft.json";

/**
 * Calculate maneuvering speeds based on aircraft stall speeds
 * @param aircraftModel The aircraft model identifier
 * @returns ManeuveringSpeeds object with calculated speeds, or null if aircraft not found
 */
export function calculateManeuveringSpeeds(aircraftModel: string): ManeuveringSpeeds | null {
  if (!aircraftModel) return null;

  const aircraft = aircraftData.find((a) => a.id === aircraftModel);
  if (!aircraft || !aircraft.stallSpeeds) return null;

  const { flaps, Vso } = aircraft.stallSpeeds;
  const bankAngles = [0, 45, 60]; // Standard bank angles for maneuvering speeds
  const speeds: ManeuveringSpeedData[] = [];

  // Calculate speeds for each flap setting and bank angle combination
  flaps.forEach((flapSetting, index) => {
    const vso = Vso[index];
    bankAngles.forEach((bankAngle) => {
      let speed: number;
      if (bankAngle === 0) {
        speed = vso; // 0° bank = Vso directly
      } else if (bankAngle === 45) {
        speed = vso * 1.2; // 45° bank = 1.2 × Vso
      } else if (bankAngle === 60) {
        speed = vso * 1.4; // 60° bank = 1.4 × Vso
      } else {
        speed = vso; // Fallback to Vso for any other bank angle
      }

      speeds.push({
        flapSetting,
        bankAngle,
        speed: Math.round(speed),
      });
    });
  });

  return {
    flapSettings: flaps,
    speeds,
  };
}

/**
 * Get speed for a specific flap setting and bank angle from maneuvering speeds data
 * @param maneuveringSpeeds The maneuvering speeds data
 * @param flapSetting The flap setting
 * @param bankAngle The bank angle
 * @returns The calculated speed, or null if not found
 */
export function getManeuveringSpeed(
  maneuveringSpeeds: ManeuveringSpeeds | null,
  flapSetting: number,
  bankAngle: number
): number | null {
  if (!maneuveringSpeeds) return null;
  
  const speedData = maneuveringSpeeds.speeds.find(
    (s) => s.flapSetting === flapSetting && s.bankAngle === bankAngle
  );
  
  return speedData ? speedData.speed : null;
}
