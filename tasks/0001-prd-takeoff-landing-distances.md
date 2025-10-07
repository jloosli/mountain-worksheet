# Product Requirements Document: Takeoff and Landing Distance Calculations

## Introduction/Overview

This feature will implement automatic calculation of takeoff and landing distances for Civil Air Patrol (CAP) mountain flying operations. The calculations will replace the current "TBD" (To Be Determined) values in the TakeoffPerformance component with actual computed distances based on aircraft performance data, weight, pressure altitude, temperature, and runway lengths.

The primary goal is to help CAP pilots determine if they can safely take off from and land at mountain airports with short runways, which is critical for mountain flying safety.

## Goals

1. **Safety Enhancement**: Provide accurate takeoff and landing distance calculations to help pilots make informed go/no-go decisions for mountain operations
2. **Data Integration**: Utilize existing aircraft performance data from `aircraft.json` to perform interpolated calculations
3. **Real-time Updates**: Calculate distances dynamically as pilots input weight, altitude, temperature, and weather conditions
4. **User Experience**: Replace placeholder "TBD" values with meaningful calculated distances in the existing table format

## User Stories

1. **As a CAP pilot**, I want to see calculated takeoff ground roll distances so that I can determine if I can safely depart from a mountain airport
2. **As a CAP pilot**, I want to see calculated landing ground roll distances so that I can determine if I can safely land at a mountain airport
3. **As a CAP pilot**, I want to see both short field takeoff and 50ft obstacle clearance distances so that I can plan for different departure scenarios
4. **As a CAP pilot**, I want these calculations to update automatically when I change aircraft weight, altitude, or temperature so that I get real-time performance data
5. **As a CAP pilot**, I want to see available runway remaining calculations so that I can assess safety margins

## Functional Requirements

1. **Takeoff Ground Roll Calculation**: The system must calculate takeoff ground roll distances using bilinear interpolation of the `shortFieldTakeoff.groundRoll` data from `aircraft.json`
2. **50ft Obstacle Clearance Calculation**: The system must calculate 50ft obstacle clearance distances using bilinear interpolation of the `shortFieldTakeoff.groundRoll50ft` data from `aircraft.json`
3. **Landing Ground Roll Calculation**: The system must calculate landing ground roll distances using bilinear interpolation of the `shortFieldLanding.groundRoll` data from `aircraft.json`
4. **Landing 50ft Obstacle Clearance Calculation**: The system must calculate landing 50ft obstacle clearance distances using bilinear interpolation of the `shortFieldLanding.groundRoll50ft` data from `aircraft.json`
5. **Multi-Parameter Interpolation**: The system must perform trilinear interpolation using weight, pressure altitude, and temperature as input parameters
6. **Real-time Updates**: The system must recalculate distances whenever aircraft weight, pressure altitude, or temperature values change
7. **Data Integration**: The system must integrate with existing `WorksheetData` state to access weight, temperature, and altitude information
8. **Component Integration**: The system must pass calculated distances to the `ClimbPerformance` component as props
9. **Table Population**: The system must replace all "TBD" values in the TakeoffPerformance table with calculated distances
10. **Available Runway Calculation**: The system must calculate available runway remaining by subtracting required distances from runway length
11. **Error Handling**: The system must handle cases where interpolation data is not available or inputs are invalid

## Non-Goals (Out of Scope)

1. **Safety Margins**: No additional safety factors will be applied beyond the exact calculated values
2. **Wind Correction**: Wind effects on takeoff/landing distances are not included in this initial implementation
3. **Runway Surface Conditions**: Wet/dry runway surface corrections are not included
4. **Engine Performance Variations**: Individual engine performance variations are not considered
5. **Pilot Technique Adjustments**: Pilot-specific technique adjustments are not included
6. **Multiple Aircraft Support**: Only the currently selected aircraft model will be supported
7. **Historical Data Storage**: Previous calculations will not be stored or retrieved

## Design Considerations

- **Existing Table Structure**: Maintain the current table layout in `TakeoffPerformance.tsx` with columns for departure/arrival airports and short field/50ft obstacle clearance
- **Consistent Styling**: Use the same Tailwind CSS classes and dark mode support as existing components
- **Data Format**: Display distances in feet with appropriate formatting (e.g., comma separators for large numbers)
- **Error States**: Display appropriate fallback values when calculations cannot be performed

## Technical Considerations

- **Interpolation Library**: Utilize existing `bilinearInterpolate` and `bilinearInterpolateFlexible` functions from `@/utils/interpolation`
- **Data Structure**: Work with the existing `shortFieldTakeoff` data structure in `aircraft.json` which contains:
  - `weights`: Array of weight values [2300, 2700, 3100]
  - `pressureAltitudes`: Array of altitude values [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]
  - `temperatures`: Array of temperature values [0, 10, 20, 30, 40]
  - `data`: Nested arrays containing ground roll and ground roll 50ft distances (listed in order of weights)
- **State Management**: Integrate with existing `WorksheetData` state structure
- **Component Props**: Extend `TakeoffPerformanceProps` to include necessary calculation inputs
- **Performance**: Ensure calculations are efficient and don't cause UI lag during real-time updates

## Success Metrics

1. **Functional Completeness**: All "TBD" values in the TakeoffPerformance table are replaced with calculated distances
2. **Calculation Accuracy**: Calculated distances match expected values based on aircraft performance charts
3. **Real-time Responsiveness**: Calculations update within 100ms of input changes
4. **Data Integration**: Successfully integrates with existing `WorksheetData` state and aircraft performance data
5. **User Acceptance**: CAP pilots can use the calculated distances to make informed flight planning decisions

## Open Questions

1. **Landing Distance Data**: What data source will be used for landing ground roll calculations? (The current `aircraft.json` only contains takeoff performance data)
2. **Runway Length Integration**: How will runway length data be obtained and integrated for "available runway remaining" calculations?
   - The runway length data will be obtained from the `WorksheetData` state for the departure and arrival airports
3. **Temperature Units**: Should temperature inputs be in Celsius or Fahrenheit for interpolation calculations?
   - Celsius
4. **Extrapolation Handling**: How should the system handle cases where input values fall outside the interpolation table ranges?
   - The system should handle extrapolation by using the first or last two points in the table
5. **Multiple Weight Scenarios**: Should the system calculate distances for multiple weight scenarios or only the current aircraft weight?
   - The system should calculate distances for the current aircraft weight
6. **Component Architecture**: Should calculations be performed in the `TakeoffPerformance` component or in a separate calculation service?
   - The system should perform calculations in the `Calculations` component. The `TakeoffPerformance` component should only read the necessary data from the `Calculations` component.
7. **Error Display**: How should the system display errors or invalid states when calculations cannot be performed?
   - The system should display an error message in the `TakeoffPerformance` component when calculations cannot be performed
8. **Testing Strategy**: What test cases should be implemented to verify calculation accuracy across different input combinations?
   - The system should implement unit tests for the calculation functions
