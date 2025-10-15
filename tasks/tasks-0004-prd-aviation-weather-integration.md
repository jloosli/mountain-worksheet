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
- `src/utils/weatherCache.ts` - New utility for localStorage-based weather data caching
- `src/utils/weatherCache.test.ts` - Unit tests for weather caching utilities
- `src/utils/weatherDataMapper.ts` - New utility for mapping API responses to WorksheetData format
- `src/utils/weatherDataMapper.test.ts` - Unit tests for weather data mapping utilities
- `src/utils/types.ts` - Type definitions that may need updates for weather data tracking
- `src/utils/types.test.ts` - Unit tests for type utilities

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Create Aviation Weather API Integration Infrastructure
  - [ ] 1.1 Create `src/utils/aviationWeatherApi.ts` with API client functions for METAR, TAF, airport, and wind/temp endpoints
  - [ ] 1.2 Implement CORS handling using appropriate method (proxy, CORS proxy service, or alternative approach)
  - [ ] 1.3 Add error handling for HTTP status codes (400, 404, 429, 500) with retry logic
  - [ ] 1.4 Implement request batching and debouncing to respect rate limits (100 requests/minute)
  - [ ] 1.5 Add TypeScript interfaces for API response types (METAR, TAF, Airport, WindTemp)
  - [ ] 1.6 Write comprehensive unit tests in `src/utils/aviationWeatherApi.test.ts` covering all API functions, error cases, and retry logic
- [ ] 2.0 Implement Weather Data Caching System
  - [ ] 2.1 Create `src/utils/weatherCache.ts` with localStorage-based caching functions
  - [ ] 2.2 Implement cache key generation using format `aviationWeather_[airport]_[date]_[type]`
  - [ ] 2.3 Add cache expiration logic (1-hour retention policy) with automatic cleanup
  - [ ] 2.4 Implement cache storage limits handling and cleanup for old data
  - [ ] 2.5 Add cache validation and error recovery mechanisms
  - [ ] 2.6 Write unit tests in `src/utils/weatherCache.test.ts` covering cache operations, expiration, cleanup, and edge cases
- [ ] 3.0 Build Weather Data Mapping and Validation
  - [ ] 3.1 Create `src/utils/weatherDataMapper.ts` to convert API responses to WorksheetData format
  - [ ] 3.2 Implement wind data mapping for altitudes 3k, 6k, 9k, 12k, 15k (leave blank if not available)
  - [ ] 3.3 Add temperature and pressure data extraction from METAR/TAF responses
  - [ ] 3.4 Implement runway data parsing and longest runway selection logic
  - [ ] 3.5 Add data validation against expected ranges before populating fields
  - [ ] 3.6 Implement TAF time selection based on flight date/time
  - [ ] 3.7 Write unit tests in `src/utils/weatherDataMapper.test.ts` covering all mapping functions, validation, and edge cases
- [ ] 4.0 Create User Interface Components
  - [ ] 4.1 Create `src/components/WeatherModal.tsx` for error handling and loading states
  - [ ] 4.2 Implement modal for API data retrieval failures with retry option
  - [ ] 4.3 Add modal for airport not found errors with clear messaging
  - [ ] 4.4 Implement loading spinner/progress indicator for API calls
  - [ ] 4.5 Add modal for offline/poor connectivity scenarios
  - [ ] 4.6 Write unit tests in `src/components/WeatherModal.test.tsx` covering all modal states and user interactions
- [ ] 5.0 Integrate Weather Data Population into Existing Components
  - [ ] 5.1 Add "Check AviationWeather" button to `src/components/AppInputs.tsx` below title and action buttons
  - [ ] 5.2 Implement button state management (enabled/disabled based on required flight info)
  - [ ] 5.3 Add loading state with spinner and disable button during API calls
  - [ ] 5.4 Integrate weather data population into `src/components/WeatherInfo.tsx` with visual indicators for API-populated fields
  - [ ] 5.5 Add runway data population to `src/components/AircraftPerformance.tsx`
  - [ ] 5.6 Implement timestamp display for "Last updated" near weather section
  - [ ] 5.7 Add visual indicators (subtle background color) to show API vs manual entry
  - [ ] 5.8 Ensure all API-populated fields remain editable after population
  - [ ] 5.9 Implement logic to prevent overwriting user-modified data on subsequent API calls
  - [ ] 5.10 Update `src/utils/types.ts` if needed to track API-populated vs manual data
  - [ ] 5.11 Write unit tests for `src/components/AppInputs.test.tsx` covering button functionality and state management
  - [ ] 5.12 Write unit tests for `src/components/WeatherInfo.test.tsx` covering API data population and visual indicators
  - [ ] 5.13 Write unit tests for `src/components/AircraftPerformance.test.tsx` covering runway data population
