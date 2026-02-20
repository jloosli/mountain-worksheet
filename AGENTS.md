# CAP Mountain Flying Worksheet - AI Agent Instructions

This document provides essential context for AI agents working with this codebase. It outlines key architectural decisions, workflows, and patterns specific to this project.

## Project Overview

A Next.js web application designed to help Civil Air Patrol (CAP) pilots plan and execute mountain flying operations safely. It takes information about the aircraft being flown and the weather conditions for the flight to give insights on the conditions to expect and whether or not the mission should proceed. It is built with:

- Next.js 15.5+ (App Router)
- TypeScript
- Tailwind CSS
- Vercel deployment

## Key Architecture Points

### App Structure

- Uses Next.js App Router pattern (`src/app/` directory)
- Page components in `page.tsx` files
- Layout components in `layout.tsx` files
- Shared components in `src/components/` (when added)
- Most components are stateless and use props to update the state
- Calculations are done in the `Calculations` component
- Inputs are done in the `AppInputs` component

### Styling

- Tailwind CSS for styling
- Custom fonts: Geist Sans and Geist Mono via `next/font/google`
- Dark mode support built into component styles

### URL State Management

The application uses URL query strings to persist application state, allowing users to bookmark and share worksheet configurations.

**Key Files:**
- `src/utils/urlState.ts` - Serialization/deserialization logic
- `src/utils/useUrlState.ts` - React hook for URL state management

**Serialization Approach:**
- Uses the `qs` library (https://github.com/ljharb/qs) for query string handling
- Query strings are optimized for compactness and human-readability
- Configuration: `{arrayFormat: 'comma', encode: false, skipNulls: true}`

**Format Details:**
- **Arrays**: Comma-separated values (e.g., `?numbers=1,2,3`)
- **Booleans**: Serialized as "1" or "0" (e.g., `?turb=1`)
- **Nested Arrays (2D)**: Custom format with `||` separator (e.g., `?wind=0,90,180||5,10,15`)
- **Empty values**: Null, undefined, empty strings, and empty arrays are automatically omitted
- **No URL encoding**: Values are stored as-is for readability (e.g., `?pilot=John+Doe` not `?pilot=John%20Doe`)

**Type Hints:**
- Deserialization uses `initialState` as type hints to properly convert strings back to numbers, booleans, etc.
- This ensures type safety when reading from URL parameters

**Usage Example:**
```typescript
const [state, setState] = useUrlState({
  pilot: "",
  altitude: [0, 0, 0],
  turb: false,
});
// State is automatically synced with URL query string
```

### Performance Calculations

Aircraft performance tables (from POH data) are stored in `src/data/aircraft.json` indexed by weight × altitude × temperature. Calculations use trilinear interpolation (`src/utils/interpolation.ts`) to find values between table entries.

Key calculation files:
- `src/utils/toldCalculations.ts` — takeoff/landing distance calculations
- `src/utils/maneuveringCalculations.ts` — maneuvering speed calculations
- `src/utils/formulas.ts` — density altitude and other aviation formulas

### Type Definitions

All core types are in `src/utils/types.ts`:
- `WorksheetData` — the complete form state
- `Aircraft` — aircraft model with performance tables
- `TOLDResults`, `TOLDInputs` — takeoff/landing calculation I/O

## Development Workflow

### Commands

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

### Testing

Jest + React Testing Library. Next.js navigation (`useRouter`, `useSearchParams`, `usePathname`) is mocked in `jest.setup.ts`. Tests live alongside source in `__tests__/` subdirectories.

CI runs tests, lint, and build on every push/PR to `main`.

### Deployment

- Automatically deploys to Vercel on push to `main` branch
- Preview deployments created for pull requests

## Conventions

### Components

- Use TypeScript for all components
- Implement proper type definitions for props
- Follow Next.js App Router patterns for layouts and pages
- Most components are stateless and use props to update the state

### Styles

- Use Tailwind utility classes directly in components
- Dark mode classes prefixed with `dark:`
- Responsive design using Tailwind breakpoints (`sm:`, `md:`, etc.)

### File Structure

- Keep page components in `src/app/` directory
- Place reusable components in `src/components/`
- Static assets in `public/` directory

## Common Tasks

### Adding an aircraft

- Update the aircraft data from aircraft POH information in `src/data/aircraft.json`

### Styling Updates

- Add Tailwind classes directly to components
- Update global styles in `src/app/globals.css`
- Configure Tailwind in `tailwind.config.js`
