# TaskFlow

A real-time collaborative project management app built with Angular 21 and .NET. Think Trello meets Jira — workspaces, Kanban boards, sprint management, voice comments, and live collaboration, all wrapped in a glassmorphism UI with dark/light themes.

- **Live Demo**: [taskflow-agile.netlify.app](https://taskflow-agile.netlify.app) 
- **SwagerUI**:  [task-flow.runasp.net/swagger](https://task-flow.runasp.net/swagger/index.html)
- **Backend API**: Hosted on [task-flow.runasp.net](https://task-flow.runasp.net)

---

## Why This Exists

I built TaskFlow to solve a gap I kept running into: Trello is great for simple boards but falls apart for anything sprint-oriented, and Jira is powerful but feels like it was designed to slow you down. I wanted something in between — Kanban flexibility with sprint structure, real-time updates so teams actually stay in sync, and a UI that doesn't make you dread opening it.

This is the frontend client. The backend is a separate .NET 9 API with SignalR, JWT auth, and PostgreSQL.

---

## What It Does

### Workspaces & Team Management
- Create workspaces to organize boards by team, project, or client
- Invite members via email with role-based access (Admin / Member)
- Accept or reject workspace invitations from a dedicated inbox
- Per-workspace analytics dashboard — completion rates, member workloads, overdue cards

### Kanban Boards
- Drag-and-drop cards between lists using Angular CDK's `DragDropModule`
- Inline list renaming (click the title, edit, press Enter)
- Archive and restore lists and cards without losing data
- Board-level settings dialog for name, description, and background color
- Card filtering by keyword, label, or assignee

### Cards (The Core Unit of Work)
- Four card types: **Task**, **Story**, **Bug**, **Epic** — each with its own icon
- Priority levels: Low, Medium, High, Urgent
- Rich card detail dialog with:
  - Description editing
  - Checklists with progress tracking
  - File attachments (image preview for cover photos)
  - Labels with custom colors
  - Assignee management from workspace members
  - Due dates with overdue indicators
  - Story points and time tracking (estimated hours, logged hours)
  - Comments — both text and voice notes
  - Activity log per card
  - Card locking (prevents concurrent edits during real-time sessions)

### Voice Comments
One of the features I'm most proud of. You can record voice notes directly in a card's comment section — the app captures audio through the MediaRecorder API, uploads the `.webm` blob to the server, and plays it back through a custom audio player component. Not something you see in most Kanban tools.

### Sprint Management
- Create sprints per board with goals, start/end dates
- Start and complete sprints from the board view
- Sprint burndown charts (data from the analytics API)
- Backlog management — unassigned cards live outside of active sprints

### Calendar View
- Monthly calendar that pulls all cards with due dates across every board
- Click a day to see scheduled cards; click a card to open its full detail dialog
- Upcoming cards sidebar for a quick deadline overview
- O(1) date lookups using a pre-computed `Map<string, CalendarCard[]>`

### Real-Time Collaboration (SignalR)
- **Live board sync**: When someone moves a card, creates a list, or edits anything, every other user on the same board sees it instantly
- **Presence indicators**: See who else is currently viewing the board (avatar stack in the header)
- **Typing indicators**: Know when someone is actively editing a card
- **Card locking**: Prevents two people from editing the same card simultaneously — shows who has the lock and when it expires
- **@Mentions**: Tag teammates in comments and they receive real-time notifications
- **Auto-reconnect**: Connection drops? SignalR reconnects automatically with backoff intervals (0s, 2s, 5s, 10s, 30s)

### Search
Global search across boards and cards with debounced input (300ms). Results show board/card type, title, and direct navigation links. Search scope can be narrowed to a specific workspace.

### Dark / Light Theme
Not just a CSS variable swap — the theme system touches every component. Both themes are fully designed with appropriate contrast ratios, shadow depths, and glass effects. Defaults to dark, persists your choice to `localStorage`, and transitions smoothly with 300ms ease.

### Automation Rules
Set up if-this-then-that rules at the board level:
- **Triggers**: Card moved to list, card created, label added, due date passed, card assigned
- **Actions**: Set label, remove all assignees, set priority, move to list, send webhook

### Webhook Integration
Workspace-level outbound webhooks with event filtering. Useful for piping board events into Slack, Discord, or any custom endpoint.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| Language | TypeScript 5.9 (strict mode) |
| UI Library | Angular Material 21 (heavily customized) |
| Styling | Tailwind CSS 4 + vanilla CSS custom properties |
| Real-Time | SignalR (`@microsoft/signalr` 10.x) |
| State | Angular Signals + RxJS 7.8 |
| Drag & Drop | `@angular/cdk/drag-drop` |
| Testing | Vitest |
| Build | Angular CLI with `@angular/build` |
| Deployment | Netlify (with SPA redirect rules) |
| Backend | .NET 9 REST API + SignalR hubs |

---

## Architecture

```
src/
├── app/
│   ├── core/                    # Singletons — loaded once, used everywhere
│   │   ├── components/          # Main layout shell, collapsible sidebar
│   │   ├── guards/              # auth, admin, guest (functional guards)
│   │   ├── interceptors/        # JWT auth + HTTP cache interceptor
│   │   ├── models/              # TypeScript interfaces and enums
│   │   └── services/            # Auth, boards, workspaces, SignalR, cache, etc.
│   │
│   ├── features/                # Lazy-loaded feature modules
│   │   ├── auth/                # Login + Register pages
│   │   ├── boards/              # Board view, card dialogs, list dialogs, board settings
│   │   ├── calendar/            # Calendar view with due date visualization
│   │   └── workspaces/          # Workspace list, detail, invitations, board creation
│   │
│   └── shared/                  # Reusable components
│       └── components/          # Header (with global search), custom audio player
│
├── environments/                # Dev + production API URLs
└── styles.css                   # Global design system (dark/light theme tokens)
```

### Key Design Decisions

**Standalone components everywhere.** No `NgModules`. Every component declares its own imports, which makes the dependency graph explicit and keeps the bundle tree-shakeable.

**Functional guards and interceptors.** Using Angular's `CanActivateFn` pattern — no guard classes, just exported functions. Cleaner and easier to compose.

**Two-layer caching.** The `CacheService` implements L1 (in-memory `Map`) and L2 (`localStorage`) caching with configurable TTLs per resource type. The `cacheInterceptor` transparently caches GET responses and invalidates on mutations using tag-based rules. Boards cache for 5 min, cards for 30 sec, workspaces for 10 min.

**Optimistic updates with rollback.** The `BoardCachedService` applies changes to signal state immediately before the server responds. If the request fails, it rolls back to the previous state. This makes the UI feel instant.

**Request deduplication.** Concurrent calls to the same endpoint share a single `shareReplay(1)` Observable, preventing duplicate network requests during rapid navigation.

**Signal-based state.** No NgRx, no external state library. Board data, loading states, and filter results are managed through Angular Signals with `computed()` for derived state. Keeps things simple and performant.

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 11+
- The [TaskFlow backend API](https://task-flow.runasp.net) running locally or using the hosted version

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/taskflow-client.git
cd taskflow-client

# Install dependencies
npm install

# Start dev server (defaults to http://localhost:4200)
ng serve
```

The dev environment points to `http://localhost:5226/api` by default. If your backend runs on a different port, update `src/environments/environment.ts`.

### Environment Configuration

**Development** (`src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5226/api',
  hubUrl: 'http://localhost:5226/hubs'
};
```

**Production** (`src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://task-flow.runasp.net/api',
  hubUrl: 'https://task-flow.runasp.net/hubs'
};
```

Angular CLI swaps these automatically during `ng build --configuration production`.

### Build for Production

```bash
ng build
```

Output goes to `dist/taskFlow/browser/`. The `netlify.toml` handles SPA routing with a catch-all redirect to `index.html`.

---

## Project Structure Deep Dive

### Authentication Flow
1. User submits credentials → `AuthService.login()` sends POST to `/api/auth/login`
2. Server returns JWT access token, refresh token, and user profile
3. Tokens stored in `localStorage`; user data pushed to `BehaviorSubject`
4. `authInterceptor` attaches the Bearer token to every outgoing request
5. On 401 response, interceptor silently refreshes the token using the refresh token
6. If refresh fails, user gets logged out and redirected to `/login`
7. Concurrent requests during refresh are queued via `BehaviorSubject` + `filter`

### Caching Strategy
The cache interceptor pattern-matches every request against a config table:

| Endpoint Pattern | TTL | Persisted? | Tags |
|---|---|---|---|
| `GET /workspaces` | 10 min | Yes | `workspaces` |
| `GET /boards/:id` | 2 min | No | `boards` |
| `GET /boards/cards/:id` | 30 sec | No | `cards` |
| `GET /sprints/board/:id` | 5 min | No | `sprints` |

Mutations (POST, PUT, DELETE) trigger tag-based invalidation. For example, creating a card invalidates both `boards` and `cards` tags, forcing the next read to hit the server.

### SignalR Connection Lifecycle
1. User navigates to a board → `SignalRService.connect()` establishes WebSocket
2. `JoinBoard(boardId)` subscribes to that board's SignalR group
3. Events flow in: `CardMoved`, `CardCreated`, `ListCreated`, `UserJoinedBoard`, etc.
4. On navigation away, `LeaveBoard(boardId)` unsubscribes
5. On component destroy, connection is terminated
6. Auto-reconnect handles network interruptions transparently

---

## Design System

The UI is built on CSS custom properties organized by theme. Everything flows from the token definitions in `styles.css`.

**Typography**: Outfit for headings (display font, tight letter-spacing), Inter for body text.

**Visual style**: Glassmorphism with `backdrop-filter: blur()`, semi-transparent surfaces, and subtle gradient accents. The dark theme uses a deep void palette (#030712 base) with electric violet (#8b5cf6) as the primary accent. The light theme flips to clean whites and slates while keeping the violet accents vibrant.

**Material overrides**: Every Angular Material component (form fields, menus, dialogs, tooltips, snackbars, buttons, tabs) is restyled through CSS variable overrides to match the design system. No out-of-the-box Material look remains.

---

## Deployment

Currently deployed on Netlify with this config:

```toml
[build]
  command = "npm run build"
  publish = "dist/taskFlow/browser"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The catch-all redirect is necessary because Angular handles routing client-side. Without it, refreshing on `/boards/abc-123` would return a 404.

---

## What I'd Improve

If I revisit this project, here's what I'd tackle:

- **Offline support** — Service workers + IndexedDB for true offline-first capability
- **E2E tests** — Playwright or Cypress coverage for the main user flows
- **Board templates** — Pre-built list structures (Scrum, Kanban, Bug Triage) for faster onboarding
- **Drag-and-drop for lists** — Currently only cards are draggable; lists reorder via API calls
- **Performance profiling** — The board view re-renders on every SignalR event; debouncing or diffing would help at scale
- **Mobile responsiveness** — It works on mobile but the Kanban board needs a dedicated mobile layout

---

## License

This project is part of my personal portfolio. Feel free to explore the code, but please don't redistribute it as your own.
