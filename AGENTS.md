# SpendWise Web Application

React + Vite + Tailwind CSS dynamic personal expense tracker & financial management web app.

## Development Server

- Run `npm run dev` to start the local development server.
- Default dev server port: `http://localhost:5173`.
- Build command: `npm run build`.

## Project Structure

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component containing dynamic state, auth, expense tracking, dashboard, analytics, and settings
- `src/index.css` - Global CSS entrypoint and styling
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and scripts
- `vite.config.ts` - Vite configuration with React and Tailwind CSS v4 plus the `@` alias for `src`

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`

## Code quality

- Double quotes for strings with apostrophes.
- Valid JSX tags and type checks.
