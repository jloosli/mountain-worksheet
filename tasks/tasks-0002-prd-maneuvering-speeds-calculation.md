## Relevant Files

- `src/components/Calculations.tsx` - Main component where maneuvering speed calculations will be implemented
- `src/components/ManeuveringPerformance.tsx` - Component that displays the maneuvering speeds table and needs to be updated to accept calculated speeds as props
- `src/data/aircraft.json` - Contains aircraft data including stallSpeeds structure used for calculations
- `src/utils/types.ts` - Type definitions that need to be updated to include maneuvering speed data structures
- `src/components/Calculations.test.tsx` - Unit tests for the Calculations component (to be created)
- `src/components/ManeuveringPerformance.test.tsx` - Unit tests for the ManeuveringPerformance component (to be created)
- `src/utils/__tests__/maneuveringCalculations.test.ts` - Unit tests for maneuvering speed calculation utilities (to be created)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `ManeuveringPerformance.tsx` and `ManeuveringPerformance.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- Use `npm run test` to run all tests.
- Use `npm run list` to lint completed code.

## Tasks

- [x] 1.0 Update Type Definitions for Maneuvering Speeds

  - [x] 1.1 Add `ManeuveringSpeeds` interface to define the structure for calculated speeds
  - [x] 1.2 Add `ManeuveringSpeedData` interface for individual speed calculations (flap setting, bank angle, speed)
  - [x] 1.3 Add `ManeuveringPerformanceProps` interface update to include calculated speeds parameter
  - [x] 1.4 Export new types from `src/utils/types.ts`

- [x] 2.0 Implement Maneuvering Speed Calculation Logic in Calculations Component

  - [x] 2.1 Create `calculateManeuveringSpeeds` function that takes aircraft model and returns calculated speeds
  - [x] 2.2 Implement calculation formulas: 0° bank = Vso, 45° bank = 1.2×Vso, 60° bank = 1.4×Vso
  - [x] 2.3 Add state management for maneuvering speeds in Calculations component
  - [x] 2.4 Add useEffect to recalculate speeds when aircraft model changes
  - [x] 2.5 Create callback function to pass calculated speeds to ManeuveringPerformance component
  - [x] 2.6 Update ManeuveringPerformance component call to pass calculated speeds

- [ ] 3.0 Update ManeuveringPerformance Component to Accept and Display Calculated Speeds

  - [ ] 3.1 Update `ManeuveringPerformanceProps` interface to accept `maneuveringSpeeds` parameter
  - [ ] 3.2 Replace hardcoded flap settings (0°, 30°) with dynamic values from aircraft data
  - [ ] 3.3 Update table structure to dynamically generate rows based on available flap settings
  - [ ] 3.4 Replace "TBD" values with calculated speeds from props
  - [ ] 3.5 Update "Flaps" header rowSpan to match number of flap settings dynamically
  - [ ] 3.6 Add proper TypeScript typing for the new props

- [ ] 4.0 Update Aircraft Type Definition to Include Stall Speeds

  - [ ] 4.1 Add `stallSpeeds` property to existing `Aircraft` interface in `types.ts`
  - [ ] 4.2 Define `StallSpeeds` interface with `flaps: number[]` and `Vso: number[]` properties
  - [ ] 4.3 Ensure type compatibility with existing aircraft.json data structure
  - [ ] 4.4 Update any existing type references that might be affected

- [ ] 5.0 Add Unit Tests for Maneuvering Speed Calculations
  - [ ] 5.1 Create `ManeuveringPerformance.test.tsx` with tests for component rendering and prop handling
  - [ ] 5.2 Create `Calculations.test.tsx` with tests for maneuvering speed calculation logic
  - [ ] 5.3 Create `maneuveringCalculations.test.ts` for utility function tests
  - [ ] 5.4 Test calculation formulas with known aircraft data (C182T: flaps [0,30], Vso [51,41])
  - [ ] 5.5 Test dynamic table generation with different flap settings
  - [ ] 5.6 Test component behavior when no aircraft model is selected
  - [ ] 5.7 Test component behavior when maneuvering speeds are not available
