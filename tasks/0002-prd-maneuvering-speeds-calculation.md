# PRD: Maneuvering Speeds Calculation

## Introduction/Overview

This feature will calculate and display maneuvering speeds for mountain flying operations in the ManeuveringPerformance component. Currently, the component shows "TBD" (To Be Determined) values for all maneuvering speeds. This feature will replace these placeholder values with calculated speeds based on the aircraft's stall speeds and standard maneuvering speed formulas.

The goal is to automatically calculate and display safe maneuvering speeds for different bank angles (0°, 45°, 60°) and flap settings (typically 0° and 30°, but more may be found in the aircraft data) to help CAP pilots plan safe mountain flying operations.

## Goals

1. Replace all "TBD" values in the ManeuveringPerformance component with calculated maneuvering speeds
2. Automatically calculate speeds when aircraft model changes
3. Use aircraft-specific stall speed data from aircraft.json
4. Apply standard maneuvering speed formulas (0° bank = Vso, 45° bank = 1.2×Vso, 60° bank = 1.4×Vso)
5. Support flap settings (stallSpeeds.flaps in `aircraft.json`) for each aircraft
6. Replace current hard coded flap values with values from the aircraft data

## User Stories

1. **As a CAP pilot**, I want to see calculated maneuvering speeds for my selected aircraft so that I can plan safe mountain flying operations.

2. **As a CAP pilot**, I want the maneuvering speeds to update automatically when I change aircraft models so that I don't have to manually look up or calculate these values.

3. **As a CAP pilot**, I want to see maneuvering speeds for different bank angles (0°, 45°, 60°) so that I can understand the performance envelope for different flight conditions.

4. **As a CAP pilot**, I want to see maneuvering speeds for different flap settings (stallSpeeds.flaps in `aircraft.json`) so that I can plan for different flying conditions.

## Functional Requirements

1. The system must calculate maneuvering speeds in the Calculations component using aircraft stall speed data from aircraft.json.

2. The system must apply the following calculation formulas:

   - 0° bank angle: Use Vso directly from aircraft data
   - 45° bank angle: Vso × 1.2
   - 60° bank angle: Vso × 1.4

3. The system must calculate speeds for both flap settings available in the aircraft data (0° and 30° flaps).

4. The system must pass calculated maneuvering speeds as parameters to the ManeuveringPerformance component.

5. The system must automatically recalculate speeds when the aircraft model changes.

6. The system must display calculated speeds in the existing table format, replacing all "TBD" values.

7. The system must use the aircraft's stall speed data structure:

   - `stallSpeeds.flaps: [0, 30]` for flap settings
   - `stallSpeeds.Vso: [51, 41]` for corresponding stall speeds

8. The system must handle the case where aircraft data contains the required stall speed information.

## Non-Goals (Out of Scope)

1. This feature will not modify the aircraft.json data structure.
2. This feature will not add error handling for missing aircraft data.
3. This feature will not add loading indicators or success messages.
4. This feature will not integrate with other performance calculations.
5. This feature will not support additional flap settings beyond what's available in the aircraft data.
6. This feature will not support weight-dependent maneuvering speed calculations.
7. This feature will not add user interaction for manual speed calculations.

## Design Considerations

The feature will use the existing table structure in ManeuveringPerformance.tsx:

- Maintain the current table layout with bank angle columns (0°, 45°, 60°)
- Flap setting rows will be dynamic based on the aircraft data
- The "Flaps" header row span should be equal to the number of flap settings in the aircraft data
- Replace "TBD" text with calculated numeric values
- Preserve existing styling and responsive design

## Technical Considerations

1. **Data Flow**: Calculations component → ManeuveringPerformance component via props
2. **Data Source**: Use existing aircraft.json structure with `stallSpeeds` data
3. **Calculation Location**: Implement calculation logic in Calculations.tsx
4. **Props Interface**: Extend ManeuveringPerformance props to accept calculated speeds
5. **Automatic Updates**: Leverage existing aircraft model change detection in Calculations component

## Success Metrics

1. All "TBD" values in the ManeuveringPerformance table are replaced with calculated speeds
2. Speeds update automatically when aircraft model changes
3. Calculated speeds match expected formulas (Vso, 1.2×Vso, 1.4×Vso)
4. Flap settings match values in `stallSpeeds.flaps` in `aircraft.json` and display calculated speeds
5. No regression in existing functionality

## Open Questions

None - all requirements have been clarified through the initial questions and answers.
