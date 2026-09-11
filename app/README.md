# Concludo Workspace — App Shell

Standalone SaaS application shell for **Concludo Workspace** (`app.concludo.com`).

Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898, Melbourne VIC).

## Architecture & Boundary

- **Target URL:** `app.concludo.com`
- **Marketing Site:** Wix remains the public marketing site only (`concludo.com.au` / `concludo.au`).
- **Separation:** The Workspace SaaS app is completely decoupled and standalone from Wix.
- **Frontend Stack:** React 19, TypeScript, Vite, React Router v7, Lucide React icons.
- **Brand Standards:** Concludo Navy (`#16263F`, `#21395C`), Gold (`#E2B53C`, `#BC8A1C`), Light (`#F4F6FA`), Poppins headings, Inter body text, Australian English, no em dashes.

## Routes

| Route | View | Description |
|---|---|---|
| `/login` | Login | Authentication sign-in placeholder |
| `/signup` | Signup | Account creation placeholder |
| `/forgot-password` | Forgot Password | Password recovery flow |
| `/dashboard` | Dashboard | Workspace home with "Welcome to Concludo Workspace" |
| `/projects` | Projects | Project list with "No projects yet" empty state |
| `/projects/new` | New Project | Project setup form (title, meeting type, client/project, date) |
| `/projects/:id` | Project Detail | Dynamic project view with Overview, Transcript, and Outputs tabs |
| `/account` | Account | "Account settings coming soon" profile view |
| `/settings` | Settings | "Workspace settings coming soon" configuration view |
| `/decision-memory` | Decision Memory | "Decision Memory coming soon" governance log |
| `/actions` | Actions | "Action Tracker coming soon" commitment tracker |

## Layout Shell

- **Top Navigation:**
  - Concludo Workspace brand lockup
  - Plan badge placeholder (`Starter Plan`)
  - Account menu (`Anthony Cortez`, avatar `AC`, dropdown to Account, Settings, Sign out)
- **Left Sidebar:**
  - Dashboard
  - Projects
  - New Transcript
  - Decision Memory
  - Actions
  - Settings
  - Organization footer: Concludo Pty Ltd · Melbourne, Australia
- **Main Content Area:**
  - Responsive container with card layouts and styled components

## Local Development

```bash
bun install
bun run dev
```

App runs on `http://localhost:3000/`.

## Build

```bash
bun run build
```

Outputs static SPA bundle in `dist/`.
