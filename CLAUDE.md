# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js web application for Civil Air Patrol (CAP) pilots to plan mountain flying operations. It calculates aircraft performance (takeoff/landing distances, climb rates, maneuvering speeds) using POH data with bilinear/trilinear interpolation, and integrates real-time weather from the Aviation Weather API.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests once
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
```

To run a single test file:
```bash
npx jest src/utils/__tests__/interpolation.test.ts
npx jest src/components/__tests__/AppContainer.test.tsx
```

## Architecture

### State Management

All application state lives in `AppContainer.tsx` and is persisted to URL query strings via `useUrlState` hook (`src/utils/useUrlState.ts`). This enables bookmarking and sharing worksheet configurations.

Serialization (`src/utils/urlState.ts`):
- Arrays → comma-separated (`?numbers=1,2,3`)
- 2D arrays → `||` row separator (`?wind=0,90||5,10`)
- Booleans → `"1"`/`"0"`
- Spaces → `+` (not `%20`)
- Deserialization uses `initialState` as type hints to restore correct types

### Component Model

Most components are **stateless** — they receive data and `onChange` callbacks as props. The two primary input/output components are:
- `AppInputs` — collects pilot info, weather, aircraft selection
- `Calculations` — displays performance results

`AppContainer` owns all state and passes handlers down.

### Performance Calculations

Aircraft performance tables (from POH data) are stored in `src/data/aircraft.json` indexed by weight × altitude × temperature. Calculations use trilinear interpolation (`src/utils/interpolation.ts`) to find values between table entries.

Key calculation files:
- `src/utils/toldCalculations.ts` — takeoff/landing distance calculations
- `src/utils/maneuveringCalculations.ts` — maneuvering speed calculations
- `src/utils/formulas.ts` — density altitude and other aviation formulas

### API Route

`src/app/api/aviation-weather/route.ts` proxies requests to the Aviation Weather API (avwx or similar) to avoid CORS issues.

### Type Definitions

All core types are in `src/utils/types.ts`:
- `WorksheetData` — the complete form state
- `Aircraft` — aircraft model with performance tables
- `TOLDResults`, `TOLDInputs` — takeoff/landing calculation I/O

### Adding an Aircraft

Add an entry to `src/data/aircraft.json` following the existing structure (empty weight, max gross weight, fuel capacity, service ceiling, and performance tables for climb, takeoff, landing indexed by weight/altitude/temperature).

## Testing

Jest + React Testing Library. Next.js navigation (`useRouter`, `useSearchParams`, `usePathname`) is mocked in `jest.setup.ts`. Tests live alongside source in `__tests__/` subdirectories.

CI runs tests, lint, and build on every push/PR to `main`.
