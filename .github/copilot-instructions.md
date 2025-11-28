# La Cueva de Tatoh - AI Coding Agent Instructions

## Architecture Overview

This is an **Angular 21 monorepo** with two projects:

- **`perfil-personal`** - Main application (personal profile/blog site)
- **`componentes`** - Reusable Angular library exported to `dist/componentes`

The app uses **standalone components** (no NgModules), **signals**, and modern Angular features.

## Key Conventions

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

### Component Structure

- All components are **standalone** with `imports` array in `@Component` decorator
- Use **signal-based reactive state** (`signal()`, `computed()`, `effect()`)
- Component inputs use `input<T>()` API with readonly modifier
- No outputs—pass callbacks via `input<() => void>()`
- File naming: `component-name.ts`, `component-name.html`, `component-name.scss` (no `.component.` infix)
- Class names match file names (e.g., `Blog` in `blog.ts`, not `BlogComponent`)

Example from `projects/componentes/src/lib/avatar/avatar.ts`:

```typescript
@Component({
  selector: 'lib-avatar',
  imports: [CommonModule],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  readonly imagenUrl = input<string>();
  readonly nombre = input<string>();
  readonly textoError = input<string>('No se pudo cargar la imagen');
}
```

### Template Syntax

- Use **modern control flow** syntax: `@if`, `@for`, `@switch` (not `*ngIf`, `*ngFor`)
- Always include `track` expression in `@for` loops
- Prefer `@for` with `track $index` or unique identifier

Example:

```html
@for (s of skills(); track $index) {
<lib-skill-bar [skill]="s.skill" [nivel]="s.nivel" />
}
```

### TypeScript & ESLint Rules

- **Explicit return types required** on all functions (`@typescript-eslint/explicit-function-return-type`)
- Use `type` over `interface` (`@typescript-eslint/consistent-type-definitions`)
- No `public` keyword on class members (`@typescript-eslint/explicit-member-accessibility`)
- Prefer `readonly` for component inputs and signals
- Variables: `camelCase`, `PascalCase` for classes, `UPPER_CASE` for constants
- Max file length: 400 lines
- Max line length: 120 chars (code), 160 (comments)
- Import sorting: alphabetical, case-insensitive, ignore declaration sort

### Styling

- Component styles in separate `.scss` files (not inline)
- Global styles in `projects/perfil-personal/src/styles.scss`
- CSS custom properties defined in `:root` (e.g., `--color-1`, `--color-2`)
- Use `.bg-30` utility class for semi-transparent backgrounds
- Prettier config: single quotes, 2 spaces, 80 char width

### Library Pattern (`componentes`)

- Library components use `lib-` prefix (e.g., `lib-avatar`, `lib-panel`)
- Export all public APIs via `projects/componentes/src/public-api.ts`
- Components accept many optional `input()` properties for customization
- Heavily uses computed signals for dynamic styling (see `Panel` component)
- Peer dependencies: Angular 20+, `qr-code-styling`

### Routing & Lazy Loading

- All routes use `loadComponent` with dynamic imports:

```typescript
{
  path: 'blog',
  loadComponent: () => import('./componentes/blog/blog').then((m) => m.Blog),
}
```

- Default route redirects to `/blog`
- 404 handled by wildcard route (`**`) to `NotFound` component

### Content Management

- Blog posts stored as `.md` files in `projects/perfil-personal/public/posts/`
- Rendered using `ngx-markdown` with `MarkdownComponent`
- Static assets in `public/` folder (images, markdown files)

### Data Constants

- App-level constants in `projects/perfil-personal/src/variables.ts`
- Exports typed arrays: `SKILLS`, `INTERESES`, `REDES`
- Example: `Skill` type with properties `skill`, `nivel`, `color`, `textColor`

## Development Workflow

### Build & Serve

```bash
pnpm start              # Serve app (default: http://localhost:4200)
pnpm build              # Production build
pnpm watch              # Development build with watch mode
pnpm lint               # Run ESLint on all projects
pnpm test               # Run Karma tests
```

### Library Development

1. Build library first: `ng build componentes`
2. Library outputs to `dist/componentes` (referenced in `tsconfig.json` paths)
3. Import from library in app: `import { Avatar, Panel } from 'componentes';`

### Path Aliases

- `componentes` → `./dist/componentes` (must build library before using)
- Direct imports from library during development may fail—always build first

### Static Site Deployment

- `_redirects` file for SPA routing (Netlify/similar hosts)
- Build output: single-page application requiring redirect rules

## Angular-Specific Patterns

### Config & Providers

- Bootstrap in `projects/perfil-personal/src/main.ts`
- App config in `app.config.ts` with providers:
  - `provideRouter(routes)`
  - `provideHttpClient()`
  - `importProvidersFrom(MarkdownModule.forRoot())`

### Change Detection

- OnPush preference disabled in ESLint (project uses default change detection)
- Signal-based reactivity reduces need for manual change detection

### Accessibility

- Template accessibility rules enforced via `angular.configs.templateAccessibility`
- Button type attribute required (`@angular-eslint/template/button-has-type`)

## Code Quality Enforcement

- **Prettier** handles formatting (integrated with ESLint via `eslint-config-prettier`)
- **ESLint** enforces 80+ rules across TypeScript and HTML templates
- HTML templates: alphabetical attribute ordering, prefer control flow, use track-by
- TypeScript: explicit types, no `any`, complexity ≤ 20, one class per file
- Security: `no-eval`, `no-implied-eval` enforced

## Testing

- **No test files currently exist** in the codebase
- Karma/Jasmine configured but unused
- When adding tests, use `.spec.ts` suffix

## Common Pitfalls

1. **Don't import from library source** - Always build `componentes` first and import from `'componentes'`
2. **Don't use old syntax** - No `*ngIf`, `*ngFor`, `NgModule`, constructor DI for inputs
3. **Don't forget return types** - All functions must declare return type
4. **Don't use `public` keyword** - Omit it per ESLint rules
5. **Don't create `.component.ts` files** - Use shorter naming convention

## Unique Project Patterns

- **Dual QR generators**: One in library (`lib/generador-qr`), one in app (`componentes/utilidades/generador-qr`)
- **Signal-heavy architecture**: Prefer signals over observables for local state
- **Component composition**: Main app shell (`App`) + `Sidebar` + `Navigator` + `<router-outlet>`
- **Markdown integration**: Blog posts rendered directly from public folder markdown files
