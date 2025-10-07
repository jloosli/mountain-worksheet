# Task List: Takeoff and Landing Distance Calculations

## Relevant Files

- `src/components/Calculations.tsx` - Main calculations component that will perform TOLD calculations and pass results to TakeoffPerformance
- `src/components/TakeoffPerformance.tsx` - Component that displays the TOLD table and will receive calculated distances as props
- `src/utils/interpolation.ts` - Existing interpolation utilities for bilinear calculations
- `src/utils/types.ts` - Type definitions that need to be extended for TOLD calculations
- `src/data/aircraft.json` - Aircraft performance data containing shortFieldTakeoff data structure
- `src/components/Calculations.test.tsx` - Unit tests for the Calculations component
- `src/components/TakeoffPerformance.test.tsx` - Unit tests for the TakeoffPerformance component
- `src/utils/interpolation.test.ts` - Unit tests for interpolation functions (already exists)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Extend Type Definitions and Data Structures

  - [x] 1.1 Add TOLD calculation result types to `src/utils/types.ts` (TOLDResults interface with takeoff/landing distances)
  - [x] 1.2 Extend Aircraft interface to include shortFieldLanding data structure (matching shortFieldTakeoff format)
  - [x] 1.3 Add TOLD calculation input parameters type (weight, pressure altitude, temperature, runway lengths)
  - [x] 1.4 Update WorksheetData interface to ensure runway length data (rwy field) is properly typed
  - [x] 1.5 Add error state types for TOLD calculation failures

- [ ] 2.0 Implement TOLD Calculation Functions

  - [ ] 2.1 Create trilinear interpolation function for weight/pressure altitude/temperature in `src/utils/interpolation.ts`
  - [ ] 2.2 Implement takeoff ground roll calculation function using shortFieldTakeoff.groundRoll data
  - [ ] 2.3 Implement takeoff 50ft obstacle clearance calculation using shortFieldTakeoff.groundRoll50ft data
  - [ ] 2.4 Implement landing ground roll calculation function (placeholder for future shortFieldLanding data)
  - [ ] 2.5 Implement landing 50ft obstacle clearance calculation (placeholder for future shortFieldLanding data)
  - [ ] 2.6 Create available runway remaining calculation function (runway length - required distance)
  - [ ] 2.7 Add input validation functions for weight, altitude, and temperature ranges
  - [ ] 2.8 Implement extrapolation handling for values outside interpolation table ranges

- [ ] 3.0 Update Calculations Component with TOLD Logic

  - [ ] 3.1 Add TOLD calculation state management to Calculations component
  - [ ] 3.2 Implement useEffect hooks to trigger TOLD calculations when inputs change
  - [ ] 3.3 Add TOLD calculation functions to Calculations component
  - [ ] 3.4 Create callback function to pass TOLD results to TakeoffPerformance component
  - [ ] 3.5 Integrate TOLD calculations with existing pressure altitude updates from Altitudes component
  - [ ] 3.6 Add error handling for TOLD calculation failures in Calculations component

- [ ] 4.0 Modify TakeoffPerformance Component to Display Calculated Values

  - [ ] 4.1 Update TakeoffPerformanceProps interface to accept TOLD calculation results
  - [ ] 4.2 Replace "TBD" values with calculated takeoff ground roll distances
  - [ ] 4.3 Replace "TBD" values with calculated takeoff 50ft obstacle clearance distances
  - [ ] 4.4 Replace "TBD" values with calculated landing ground roll distances
  - [ ] 4.5 Replace "TBD" values with calculated landing 50ft obstacle clearance distances
  - [ ] 4.6 Replace "TBD" values with calculated available runway remaining distances
  - [ ] 4.7 Add number formatting for distance display (comma separators for large numbers)
  - [ ] 4.8 Add conditional styling for error states when calculations fail

- [ ] 5.0 Add Error Handling and Edge Case Management

  - [ ] 5.1 Implement error boundaries for TOLD calculation failures
  - [ ] 5.2 Add fallback display values when aircraft data is unavailable
  - [ ] 5.3 Handle cases where weight, altitude, or temperature inputs are null/undefined
  - [ ] 5.4 Add validation for runway length data availability
  - [ ] 5.5 Implement graceful degradation when interpolation data is incomplete
  - [ ] 5.6 Add console warnings for extrapolation scenarios
  - [ ] 5.7 Create user-friendly error messages for invalid input combinations

- [ ] 6.0 Implement Unit Tests for TOLD Calculations
  - [ ] 6.1 Write unit tests for trilinear interpolation function
  - [ ] 6.2 Write unit tests for takeoff ground roll calculation function
  - [ ] 6.3 Write unit tests for takeoff 50ft obstacle clearance calculation function
  - [ ] 6.4 Write unit tests for landing distance calculation functions (when implemented)
  - [ ] 6.5 Write unit tests for available runway remaining calculation function
  - [ ] 6.6 Write unit tests for input validation functions
  - [ ] 6.7 Write unit tests for extrapolation handling
  - [ ] 6.8 Write integration tests for Calculations component TOLD functionality
  - [ ] 6.9 Write integration tests for TakeoffPerformance component with calculated values
  - [ ] 6.10 Write tests for error handling scenarios and edge cases
