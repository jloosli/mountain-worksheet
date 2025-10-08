# Product Requirements Document: Vra (Rough Air Speed) Calculation

## Introduction/Overview

This feature implements the calculation and display of Vra (Rough Air Speed) for CAP pilots planning mountain flights. Vra is a critical safety speed that provides structural protection during turbulent air conditions, calculated as 1.7 times the 0° flap Vso (stall speed in flaps up configuration). This feature replaces the current "TBD" placeholder in the ClimbPerformance component with the actual calculated Vra value.

## Goals

1. Calculate Vra for the current aircraft selected
2. Display the calculated Vra value in the ClimbPerformance table
3. Ensure structural safety guidance for CAP pilots during mountain flying operations
4. Provide consistent Vra calculation across all supported aircraft types

## User Stories

- **As a CAP pilot**, I want to see the calculated Vra speed for my selected aircraft so that I can plan safe flight operations in turbulent mountain air conditions.
- **As a CAP pilot**, I want Vra to be automatically calculated based on the aircraft's stall speed data so that I don't have to manually perform the calculation.
- **As a CAP pilot**, I want to see "N/A" when Vra cannot be calculated due to missing data so that I understand when this safety information is not available.

## Functional Requirements

1. The system must calculate Vra as 1.7 × Vso (0° flap configuration) for the current aircraft selected
2. The system must display the calculated Vra value in the "Vra (Rough Air Speed)" row of the ClimbPerformance table
3. The system must replace the current "TBD" placeholder with the calculated Vra value
4. The system must display "N/A" when Vso data is not available for an aircraft
5. The system must calculate Vra automatically when aircraft model changes
6. The system must display Vra in the same format as other speed values (whole numbers, no decimal places)
7. The system must show Vra only in the departure column (consistent with current table layout)

## Non-Goals (Out of Scope)

- Calculating Vra for different flap configurations (only 0° flap Vso is used)
- Displaying Vra in operating or arrival columns
- Providing Vra calculation history or logging
- Adding validation warnings for Vra values
- Modifying the aircraft data structure for Vra storage

## Design Considerations

- Vra value should be displayed in the existing table format with right-aligned text
- Maintain consistency with other speed values in the table (no units shown, as they're implied)
- Use the same styling as other calculated values in the table
- Position Vra row after Va (Maneuvering Speed) as shown in current layout

## Technical Considerations

- Vra calculation should be implemented in the ClimbPerformance component
- Use existing aircraft data structure from `aircraft.json`
- Access Vso data via `aircraft.stallSpeeds.Vso[0]` (0° flap configuration)
- Calculation should be performed in a useEffect hook that triggers on aircraft model changes
- Follow existing code patterns for similar calculations in the component

## Success Metrics

- Vra values are correctly calculated for all aircraft with Vso data
- "TBD" placeholder is completely replaced with calculated values
- "N/A" is displayed appropriately for aircraft without Vso data
- No performance impact on component rendering
- Calculation accuracy verified against manual calculations

## Open Questions

- Should Vra calculation be moved to a utility function for reusability across components?
  - Yes, the calculation should be moved to a utility function for reusability across components.
- Are there any specific aircraft types that might need different Vra calculation formulas?
  - No, the Vra calculation should be the same for all aircraft.
- Should the Vra calculation be cached to avoid recalculation on every render?
  - No, the Vra calculation should be recalculated on every render.

## Implementation Notes

The Vra calculation follows the standard aviation formula: Vra = 1.7 × Vso (0° flap). For the Cessna 182T example, this would be 1.7 × 51 = 86.7 knots (rounded to 87 knots). The calculation should be implemented as a simple function within the ClimbPerformance component, similar to the existing Va() function.
