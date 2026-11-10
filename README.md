# CAP Mountain Flying Worksheet

[![Vercel](https://vercelbadge.vercel.app/api/jloosli/mountain-worksheet)](https://vercel.com/jlooslis-projects/mountain-worksheet)

## Description

The CAP Mountain Flying Worksheet is a web application designed to help pilots plan and execute mountain flying operations safely and effectively. It provides tools and resources for flight planning, risk assessment, and decision-making in mountainous terrain. It also integrates with the Aviation Weather API to provide weather forecasts for the flight.
Built with [Next.js](https://nextjs.org/) and [Tailwind CSS](https://tailwindcss.com/).

## Chart Calculations

The app is a digital version of the Rocky Mountain Region CAP Mountain Flight Worksheet v2 ([PDF](docs/reference/mountain-flight-worksheet-v2.pdf), [original](https://rmrcapgov.sharepoint.com/sites/RockyMountainReginCivilAirPatrolStaff/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FRockyMountainReginCivilAirPatrolStaff%2FShared%20Documents%2FPublicly%2Daccessible%20web%20files%2FOperations%2FMission%20Training%2FMountain%20Flying%20Training%2FReference%20Materials%2FMountain%20Flight%20Worksheet%20v2%2Epdf&parent=%2Fsites%2FRockyMountainReginCivilAirPatrolStaff%2FShared%20Documents%2FPublicly%2Daccessible%20web%20files%2FOperations%2FMission%20Training%2FMountain%20Flying%20Training%2FReference%20Materials&p=true&ga=1)), which is the reference for what the worksheet computes.

Most calculations are based on the POH for the aircraft in use, transcribed into `src/data/aircraft.json`. The POH PDFs themselves are not in the repository: `poh/` is gitignored, so get the POH for each supported aircraft (C172S, C182T, T182T, T206H) from Textron Aviation or your CAP wing and place it there if you need to check the source tables. Takeoff distances are interpolated across weight × pressure altitude × temperature using [trilinear interpolation](https://en.wikipedia.org/wiki/Trilinear_interpolation). Landing distances (single-weight table) and climb performance use [bilinear interpolation](https://en.wikipedia.org/wiki/Bilinear_interpolation) across pressure altitude × temperature.

## Data Source

* [Aviation Weather API](https://aviationweather.gov/data/api/) ([OpenAPI Schema](https://aviationweather.gov/data/schema/openapi.yaml)): METARs, TAFs, airport data, G-AIRMETs
* [Open-Meteo](https://open-meteo.com/) (GFS model): winds and temperatures aloft and area-of-operations weather

## Development

To get started with development, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/jloosli/mountain-worksheet.git
   cd mountain-worksheet
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

### Deployment

Deploys automatically to [Vercel](https://vercel.com/) on push to the `main` branch [Mountain Worksheet](https://mountain-worksheet.vercel.app/).
