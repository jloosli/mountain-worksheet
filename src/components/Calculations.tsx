"use client";

import type {
  WorksheetData,
  TOLDResults,
  TOLDError,
  ManeuveringSpeeds,
} from "@/utils/types";
import Altitudes from "@/components/Altitudes";
import ClimbPerformance from "@/components/ClimbPerformance";
import TakeoffPerformance from "@/components/TakeoffPerformance";
import ManeuveringPerformance from "@/components/ManeuveringPerformance";
import TOLDErrorBoundary from "@/components/TOLDErrorBoundary";
import { useState, useCallback, useEffect } from "react";
import { calculateTOLDForMultipleAirports } from "@/utils/toldCalculations";
import { calculateManeuveringSpeeds } from "@/utils/maneuveringCalculations";

interface CalculationsProps {
  state: WorksheetData;
}

export default function Calculations({ state }: CalculationsProps) {
  const [PAs, setPAs] = useState<[number, number, number]>([0, 0, 0]);

  // TOLD calculation state management
  const [toldResults, setToldResults] = useState<TOLDResults | null>(null);
  const [toldErrors, setToldErrors] = useState<TOLDError[]>([]);
  const [toldWarnings, setToldWarnings] = useState<TOLDError[]>([]);
  const [toldExtrapolationWarnings, setToldExtrapolationWarnings] = useState<
    TOLDError[]
  >([]);
  const [isCalculatingTOLD, setIsCalculatingTOLD] = useState(false);

  // Maneuvering speeds state management
  const [maneuveringSpeeds, setManeuveringSpeeds] = useState<ManeuveringSpeeds | null>(null);

  const handlePressureUpdate = useCallback(
    (PAs: [number | null, number | null, number | null]) => {
      const normalizedPAs = PAs.map((pa) => pa ?? 0) as [
        number,
        number,
        number
      ];
      setPAs(normalizedPAs);
    },
    []
  );


  // Enhanced TOLD calculation function with pressure altitude integration
  const performTOLDCalculation = useCallback(async () => {
    // Temporary test data for debugging
    const testParams = {
      acType: state.acType || "C182T",
      weight: state.weight || 2800,
      rwy: state.rwy || [1000, 1000],
      PAs: PAs || [8000, 8000, 8000],
    };

    if (
      !testParams.acType ||
      !testParams.weight ||
      !testParams.rwy[0] ||
      !testParams.rwy[1]
    ) {
      setToldResults(null);
      setToldErrors([]);
      setToldWarnings([]);
      setToldExtrapolationWarnings([]);
      return;
    }

    // Validate pressure altitudes are available
    if (PAs.every((pa) => pa === 0)) {
      console.warn(
        "Pressure altitudes not yet calculated, skipping TOLD calculation"
      );
      return;
    }

    setIsCalculatingTOLD(true);

    try {
      const params = {
        weight: testParams.weight,
        pressureAltitudes: [
          testParams.PAs[0],
          testParams.PAs[2],
          testParams.PAs[1],
        ] as [number, number, number], // [departure, arrival, operating]
        temperatures: [state.temp[0], state.temp[2], state.temp[1]] as [
          number,
          number,
          number
        ], // [departure, arrival, operating]
        runwayLengths: testParams.rwy,
      };

      const result = calculateTOLDForMultipleAirports(
        testParams.acType,
        params
      );

      if (result.success && result.results) {
        setToldResults(result.results);
        setToldErrors(result.validationErrors);
        setToldWarnings(result.validationWarnings);
        setToldExtrapolationWarnings(result.extrapolationWarnings);
      } else {
        setToldResults(null);
        setToldErrors(result.errors);
        setToldWarnings(result.validationWarnings);
        setToldExtrapolationWarnings(result.extrapolationWarnings);
        console.warn("TOLD calculation failed:", result.errors);
      }
    } catch (error) {
      console.error("TOLD calculation error:", error);
      setToldResults(null);
      setToldErrors([
        {
          type: "calculation_failed",
          message: `TOLD calculation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          severity: "error",
        },
      ]);
      setToldWarnings([]);
      setToldExtrapolationWarnings([]);
    } finally {
      setIsCalculatingTOLD(false);
    }
  }, [state.acType, state.weight, state.temp, state.rwy, PAs]);

  // Trigger TOLD calculations when inputs change
  useEffect(() => {
    performTOLDCalculation();
  }, [performTOLDCalculation]);

  // Trigger maneuvering speeds calculation when aircraft model changes
  useEffect(() => {
    if (state.acType) {
      const speeds = calculateManeuveringSpeeds(state.acType);
      setManeuveringSpeeds(speeds);
    } else {
      setManeuveringSpeeds(null);
    }
  }, [state.acType]);

  // Helper function to check if TOLD calculations are valid
  const isTOLDCalculationValid = useCallback(() => {
    return (
      state.acType &&
      state.weight &&
      state.rwy[0] &&
      state.rwy[1] &&
      state.temp.every((temp) => temp !== null) &&
      PAs.every((pa) => pa !== null)
    );
  }, [state.acType, state.weight, state.rwy, state.temp, PAs]);

  // Helper function to get TOLD calculation status
  const getTOLDCalculationStatus = useCallback(() => {
    if (isCalculatingTOLD) {
      return "calculating";
    }
    if (!isTOLDCalculationValid()) {
      return "invalid_inputs";
    }
    if (toldErrors.length > 0) {
      return "error";
    }
    if (toldResults) {
      return "success";
    }
    return "idle";
  }, [
    isCalculatingTOLD,
    isTOLDCalculationValid,
    toldErrors.length,
    toldResults,
  ]);

  // Helper function to format TOLD results for display
  const formatTOLDResults = useCallback(() => {
    if (!toldResults) return null;

    return {
      takeoffGroundRoll: {
        departure: toldResults.takeoffGroundRoll.departure,
        arrival: toldResults.takeoffGroundRoll.arrival,
      },
      takeoff50ftObstacle: {
        departure: toldResults.takeoff50ftObstacle.departure,
        arrival: toldResults.takeoff50ftObstacle.arrival,
      },
      landingGroundRoll: {
        departure: toldResults.landingGroundRoll.departure,
        arrival: toldResults.landingGroundRoll.arrival,
      },
      landing50ftObstacle: {
        departure: toldResults.landing50ftObstacle.departure,
        arrival: toldResults.landing50ftObstacle.arrival,
      },
      availableRunwayRemainingTakeoffGroundRoll: {
        departure:
          toldResults.availableRunwayRemainingTakeoffGroundRoll.departure,
        arrival: toldResults.availableRunwayRemainingTakeoffGroundRoll.arrival,
      },
      availableRunwayRemainingTakeoff50ft: {
        departure: toldResults.availableRunwayRemainingTakeoff50ft.departure,
        arrival: toldResults.availableRunwayRemainingTakeoff50ft.arrival,
      },
    };
  }, [toldResults]);

  // Enhanced error handling functions
  const clearTOLDErrors = useCallback(() => {
    setToldErrors([]);
    setToldWarnings([]);
    setToldExtrapolationWarnings([]);
  }, []);

  const hasTOLDErrors = useCallback(() => {
    return toldErrors.length > 0;
  }, [toldErrors.length]);

  const hasTOLDWarnings = useCallback(() => {
    return toldWarnings.length > 0 || toldExtrapolationWarnings.length > 0;
  }, [toldWarnings.length, toldExtrapolationWarnings.length]);

  const getTOLDErrorSummary = useCallback(() => {
    if (toldErrors.length === 0) return null;

    return {
      count: toldErrors.length,
      critical: toldErrors.filter((e) => e.severity === "error").length,
      warnings: toldErrors.filter((e) => e.severity === "warning").length,
      messages: toldErrors.map((e) => e.message),
    };
  }, [toldErrors]);

  const getTOLDWarningSummary = useCallback(() => {
    const allWarnings = [...toldWarnings, ...toldExtrapolationWarnings];
    if (allWarnings.length === 0) return null;

    return {
      count: allWarnings.length,
      validation: toldWarnings.length,
      extrapolation: toldExtrapolationWarnings.length,
      messages: allWarnings.map((w) => w.message),
    };
  }, [toldWarnings, toldExtrapolationWarnings]);

  // Error recovery function
  const retryTOLDCalculation = useCallback(() => {
    clearTOLDErrors();
    performTOLDCalculation();
  }, [clearTOLDErrors, performTOLDCalculation]);

  // Callback function to pass TOLD results to TakeoffPerformance component
  const handleTOLDResultsUpdate = useCallback(() => {
    return {
      results: formatTOLDResults(),
      status: getTOLDCalculationStatus(),
      errors: toldErrors,
      warnings: toldWarnings,
      extrapolationWarnings: toldExtrapolationWarnings,
      isCalculating: isCalculatingTOLD,
      errorSummary: getTOLDErrorSummary(),
      warningSummary: getTOLDWarningSummary(),
      hasErrors: hasTOLDErrors(),
      hasWarnings: hasTOLDWarnings(),
      retryCalculation: retryTOLDCalculation,
      clearErrors: clearTOLDErrors,
    };
  }, [
    formatTOLDResults,
    getTOLDCalculationStatus,
    toldErrors,
    toldWarnings,
    toldExtrapolationWarnings,
    isCalculatingTOLD,
    getTOLDErrorSummary,
    getTOLDWarningSummary,
    hasTOLDErrors,
    hasTOLDWarnings,
    retryTOLDCalculation,
    clearTOLDErrors,
  ]);

  // Callback function to pass maneuvering speeds to ManeuveringPerformance component
  const handleManeuveringSpeedsUpdate = useCallback(() => {
    return maneuveringSpeeds || undefined;
  }, [maneuveringSpeeds]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Calculations</h2>

      <div className="space-y-4">
        <Altitudes
          altitudes={state.altitude}
          altimeters={state.altimeter}
          temperatures={state.temp}
          onPressureUpdate={handlePressureUpdate}
        />
        <ClimbPerformance
          aircraftModel={state.acType}
          weight={state.weight}
          OATs={state.temp}
          PAs={PAs}
        />
        <TOLDErrorBoundary
          onError={(error, errorInfo) => {
            console.error("TOLD calculation error:", error, errorInfo);
            // Add error to TOLD errors state
            setToldErrors((prev) => [
              ...prev,
              {
                type: "calculation_failed" as const,
                message: `Unexpected error: ${error.message}`,
                severity: "error" as const,
              },
            ]);
          }}
        >
          <TakeoffPerformance
            aircraftModel={state.acType}
            airports={state.airport}
            toldData={handleTOLDResultsUpdate()}
          />
        </TOLDErrorBoundary>
        <ManeuveringPerformance 
          aircraftModel={state.acType} 
          maneuveringSpeeds={handleManeuveringSpeedsUpdate()} 
        />
      </div>
    </div>
  );
}
