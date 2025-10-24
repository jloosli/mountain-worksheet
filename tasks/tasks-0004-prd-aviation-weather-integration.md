# Tasks: Aviation Weather Integration

## Relevant Files

- `src/components/AppInputs.tsx` - Main form component where the "Check AviationWeather" button will be added
- `src/components/AppInputs.test.tsx` - Unit tests for AppInputs component
- `src/components/WeatherInfo.tsx` - Weather data display component that needs API population integration
- `src/components/WeatherInfo.test.tsx` - Unit tests for WeatherInfo component
- `src/components/AircraftPerformance.tsx` - Aircraft performance component that needs runway data population
- `src/components/AircraftPerformance.test.tsx` - Unit tests for AircraftPerformance component
- `src/components/WeatherModal.tsx` - New modal component for error handling and loading states
- `src/components/WeatherModal.test.tsx` - Unit tests for WeatherModal component
- `src/utils/aviationWeatherApi.ts` - New utility for AviationWeather.gov API integration
- `src/utils/aviationWeatherApi.test.ts` - Unit tests for aviation weather API utilities
- `src/utils/weatherDataMapper.ts` - New utility for mapping API responses to WorksheetData format
- `src/utils/weatherDataMapper.test.ts` - Unit tests for weather data mapping utilities
- `src/utils/types.ts` - Type definitions that may need updates for weather data tracking
- `src/utils/types.test.ts` - Unit tests for type utilities

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- See https://aviationweather.gov/data/api/#schema and https://aviationweather.gov/data/schema/openapi.yaml for the API schema.
- Use icons from already imported `@heroicons/react` library.

## Tasks

- [x] 1.0 Create Aviation Weather API Integration Infrastructure
  - [x] 1.1 Create `src/utils/aviationWeatherApi.ts` with API client functions for METAR, TAF, airport, and wind/temp endpoints
  - [x] 1.3 Add error handling for HTTP status codes (400, 404, 429, 500) with retry logic
  - [x] 1.4 Implement request batching and debouncing to respect rate limits (100 requests/minute)
  - [x] 1.5 Add TypeScript interfaces for API response types (METAR, TAF, Airport, WindTemp)
  - [x] 1.6 Write comprehensive unit tests in `src/utils/aviationWeatherApi.test.ts` covering all API functions, error cases, and retry logic
- [x] 3.0 Build Weather Data Mapping and Validation
  - [x] 3.1 Create `src/utils/weatherDataMapper.ts` to convert API responses to WorksheetData format
  - [x] 3.2 Implement wind data mapping for altitudes 3k, 6k, 9k, 12k, 15k (leave blank if not available)
  - [x] 3.3 Add temperature and pressure data extraction from METAR/TAF responses
  - [x] 3.4 Implement runway data parsing and longest runway selection logic
  - [x] 3.5 Add data validation against expected ranges before populating fields
  - [x] 3.6 Implement TAF time selection based on flight date/time
  - [x] 3.7 Write unit tests in `src/utils/weatherDataMapper.test.ts` covering all mapping functions, validation, and edge cases
- [x] 4.0 Create User Interface Components
  - [x] 4.1 Create `src/components/WeatherModal.tsx` for error handling and loading states
  - [x] 4.2 Implement modal for API data retrieval failures with retry option
  - [x] 4.3 Add modal for airport not found errors with clear messaging
  - [x] 4.4 Implement loading spinner/progress indicator for API calls
  - [x] 4.5 Add weather data display components with API integration
  - [x] 4.6 Write unit tests in `src/components/WeatherModal.test.tsx` covering all modal states and user interactions
- [ ] 5.0 Integrate Weather Data Population into Existing Components
  - [x] 5.1 Add "Check AviationWeather" button to `src/components/AppInputs.tsx` below title and action buttons
  - [x] 5.2 Implement button state management (enabled/disabled based on required flight info)
  - [x] 5.3 Add loading state with spinner and disable button during API calls
  - [x] 5.4 Integrate weather data population into `src/components/WeatherInfo.tsx` with visual indicators for API-populated fields
  - [ ] 5.5 Add runway data population to `src/components/AircraftPerformance.tsx`
  - [ ] 5.6 Implement timestamp display for "Last updated" near weather section
  - [ ] 5.7 Add visual indicators (subtle background color) to show API vs manual entry
  - [ ] 5.8 Ensure all API-populated fields remain editable after population
  - [ ] 5.9 Implement logic to prevent overwriting user-modified data on subsequent API calls
  - [ ] 5.10 Update `src/utils/types.ts` if needed to track API-populated vs manual data
  - [ ] 5.11 Write unit tests for `src/components/AppInputs.test.tsx` covering button functionality and state management
  - [ ] 5.12 Write unit tests for `src/components/WeatherInfo.test.tsx` covering API data population and visual indicators
  - [ ] 5.13 Write unit tests for `src/components/AircraftPerformance.test.tsx` covering runway data population
