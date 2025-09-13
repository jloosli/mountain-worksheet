# CAP Mountain Flying Worksheet - AI Agent Instructions

This document provides essential context for AI agents working with this codebase. It outlines key architectural decisions, workflows, and patterns specific to this project.

## Project Overview

A Next.js web application designed to help Civil Air Patrol (CAP) pilots plan and execute mountain flying operations safely. Built with:

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

### Styling

- Tailwind CSS for styling
- Custom fonts: Geist Sans and Geist Mono via `next/font/google`
- Dark mode support built into component styles

## Development Workflow

### Environment Setup

```bash
npm install     # Install dependencies
npm run dev     # Start development server with Turbopack
```

### Key Commands

- `npm run dev` - Development server with hot reload
- `npm run build` - Production build with Turbopack
- `npm run lint` - Run ESLint checks
- `npm start` - Start production server

### Deployment

- Automatically deploys to Vercel on push to `main` branch
- Preview deployments created for pull requests

## Conventions

### Components

- Use TypeScript for all components
- Implement proper type definitions for props
- Follow Next.js App Router patterns for layouts and pages

### Styling

- Use Tailwind utility classes directly in components
- Dark mode classes prefixed with `dark:`
- Responsive design using Tailwind breakpoints (`sm:`, `md:`, etc.)

### File Structure

- Keep page components in `src/app/` directory
- Place reusable components in `src/components/`
- Static assets in `public/` directory

## Common Tasks

### Adding a New Page

1. Create new directory in `src/app/`
2. Add `page.tsx` for the route
3. Include in parent `layout.tsx` if needed

### Styling Updates

- Add Tailwind classes directly to components
- Update global styles in `src/app/globals.css`
- Configure Tailwind in `tailwind.config.js`

## Need Help?

- Check [Next.js App Router Documentation](https://nextjs.org/docs)
- Review [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- See deployment details in [Vercel Dashboard](https://vercel.com/dashboard)
