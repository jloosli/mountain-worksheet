## Relevant Files

- `src/components/ClimbPerformance.tsx` - Main component where Vra calculation and display will be implemented
- `src/components/ClimbPerformance.test.tsx` - Unit tests for the ClimbPerformance component (to be created)
- `src/utils/formulas.ts` - Utility functions for aviation calculations, where Vra calculation function will be added
- `src/utils/formulas.test.ts` - Unit tests for the formulas utility functions
- `src/data/aircraft.json` - Aircraft data containing Vso values needed for Vra calculation
- `src/utils/types.ts` - TypeScript type definitions (may need updates for Vra-related types)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `ClimbPerformance.tsx` and `ClimbPerformance.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Create Vra calculation utility function

  - [x] 1.1 Add `calculateVra` function to `src/utils/formulas.ts` that takes an Aircraft object and returns Vra value
  - [x] 1.2 Implement the formula: Vra = 1.7 × Vso (0° flap configuration) using `aircraft.stallSpeeds.Vso[0]`
  - [x] 1.3 Add proper TypeScript typing for the function parameters and return value
  - [x] 1.4 Add JSDoc documentation explaining the Vra calculation formula and usage
  - [x] 1.5 Handle edge cases where Vso data might be missing or invalid
  - [x] 1.6 Round the result to the nearest whole number (no decimal places)

- [ ] 2.0 Implement Vra calculation in ClimbPerformance component

  - [ ] 2.1 Import the `calculateVra` function from `src/utils/formulas.ts`
  - [ ] 2.2 Create a `Vra` function similar to the existing `Va()` function pattern
  - [ ] 2.3 Implement the function to call `calculateVra(aircraft)` when aircraft data is available
  - [ ] 2.4 Return 0 or null when aircraft data is not available (consistent with existing patterns)
  - [ ] 2.5 Ensure the function follows the same coding patterns as other calculation functions in the component

- [ ] 3.0 Update ClimbPerformance component to display calculated Vra value

  - [ ] 3.1 Replace the "TBD" placeholder in the Vra table row with `{Vra()}` function call
  - [ ] 3.2 Ensure the Vra value is displayed in the departure column only (consistent with current layout)
  - [ ] 3.3 Apply the same styling as other speed values (right-aligned text, no units shown)
  - [ ] 3.4 Verify the Vra row appears after the Va (Maneuvering Speed) row as specified in the PRD
  - [ ] 3.5 Test that the Vra value updates automatically when aircraft model changes

- [ ] 4.0 Add error handling for missing Vso data

  - [ ] 4.1 Modify the `Vra` function to return "N/A" when `aircraft.stallSpeeds.Vso[0]` is undefined or null
  - [ ] 4.2 Add validation to check if `aircraft.stallSpeeds` exists before accessing Vso data
  - [ ] 4.3 Ensure the error handling is consistent with other calculation functions in the component
  - [ ] 4.4 Test the error handling with aircraft data that has missing Vso information
  - [ ] 4.5 Verify that "N/A" displays properly in the table without breaking the layout

- [ ] 5.0 Create comprehensive unit tests for Vra functionality
  - [ ] 5.1 Create `src/components/ClimbPerformance.test.tsx` if it doesn't exist
  - [ ] 5.2 Add unit tests for the `calculateVra` function in `src/utils/formulas.test.ts`
  - [ ] 5.3 Test Vra calculation with valid aircraft data (Cessna 182T: 1.7 × 51 = 87)
  - [ ] 5.4 Test Vra calculation with aircraft that has missing Vso data (should return null or handle gracefully)
  - [ ] 5.5 Test Vra calculation with aircraft that has invalid Vso data (negative numbers, zero, etc.)
  - [ ] 5.6 Test the ClimbPerformance component renders Vra value correctly in the table
  - [ ] 5.7 Test that Vra updates when aircraft model changes
  - [ ] 5.8 Test that Vra displays "N/A" when Vso data is missing
  - [ ] 5.9 Verify all tests pass with `npx jest` command
