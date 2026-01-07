# La Cueva de Tatoh - Project Context

## Project Overview

"La Cueva de Tatoh" is an Angular 21 monorepo workspace managed with `pnpm`. It consolidates multiple applications and a shared library into a single repository.

### Key Projects

The workspace (configured in `angular.json`) contains the following projects located in the `projects/` directory:

1. **`perfil-personal`** (Application): A personal portfolio/blog application.
   - **Features**: Blog posts (Markdown rendering via `ngx-markdown` & `prismjs`), QR generator, Service Worker (PWA).
   - **Tech**: Angular, SCSS.

2. **`comidas`** (Application): A meal planning or food tracking application.
   - **Features**: Service Worker (PWA).
   - **Tech**: Angular, SCSS.

3. **`componentes`** (Library): A shared UI component library used by the applications.
   - **Purpose**: Encapsulates reusable UI elements to ensure consistency across apps.

## Building and Running

### Prerequisites

- **Node.js**: Compatible with Angular 21.
- **Package Manager**: `pnpm` (enforced via `preinstall` script).

### Key Commands

| Command        | Description                                                               |
| :------------- | :------------------------------------------------------------------------ |
| `pnpm install` | Install dependencies.                                                     |
| `pnpm start`   | Runs `ng serve`. (Default serving command).                               |
| `pnpm build`   | Builds **all** projects: `componentes`, `perfil-personal`, and `comidas`. |
| `pnpm test`    | Runs unit tests (`ng test`).                                              |
| `pnpm lint`    | Runs linting (`ng lint`) for all projects.                                |
| `pnpm watch`   | Runs build in watch mode for development.                                 |

### Targeted Commands

To target specific projects, use the Angular CLI directly:

- **Serve specific app**: `ng serve <project-name>` (e.g., `ng serve comidas`)
- **Build specific app**: `ng build <project-name>`

## Development Conventions

- **Architecture**: Follows standard Angular workspace patterns. Code is modularized into `projects/`.
- **Styling**: SCSS is the standard for component styling.
- **Linting & Formatting**:
  - Uses **ESLint** (flat config) and **Prettier**.
  - Strict adherence to linting rules is expected.
  - Run `pnpm lint` to verify code quality.
- **Shared Code**: Any UI component or logic reusable between `perfil-personal` and `comidas` must be implemented in the `componentes` library.
- **Assets**: Public assets are located in the `public/` directory of each specific project.

## Technology Stack

- **Framework**: Angular 21
- **Language**: TypeScript 5.9
- **Build Tool**: Angular CLI (esbuild-based)
- **Testing**: Karma/Jasmine (primary), Vitest (installed)
