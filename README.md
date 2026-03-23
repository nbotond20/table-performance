# Data Grid Performance Benchmark

A React application for benchmarking and comparing three popular data grid libraries side by side with realistic data and built-in performance metrics.

**[Live Demo](https://nbotond20.github.io/table-performance/)**

## Libraries Compared

- **MUI DataGrid Pro** — Full-featured commercial grid with built-in editing, virtualization, and detail panels
- **TanStack Table** — Headless table library with manual rendering and `@tanstack/react-virtual` for virtualization
- **React Data Grid** — Lightweight grid component (v7 beta) with custom row renderers

## Features

- **Scalable datasets** — Generate 25 to 100,000 rows of deterministic student data (40 columns)
- **Virtualization toggle** — Compare virtualized vs. non-virtualized rendering
- **Inline cell editing** — Single-click to edit, Tab/Enter navigation, mock database save with simulated latency
- **Sorting & filtering** — Single and multi-column sorting, debounced name search
- **Row expansion** — Expandable detail panels for each row
- **Bulk actions** — Multi-row selection with batch grade updates
- **Column pinning & resizing** — Fixed left/right columns with draggable borders
- **Performance panel** — Real-time metrics for initial render, sort, filter, edit duration, and render count

## Tech Stack

- React 19 + TypeScript
- Vite
- MUI DataGrid Pro
- TanStack Table + TanStack Virtual
- React Data Grid
- Catppuccin Mocha dark theme

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
├── App.tsx                        # Grid selector, row count, virtualization toggle
├── types/student.ts               # StudentRow, Grade, Status types
├── data/
│   ├── generateStudents.ts        # Deterministic data generator (seeded PRNG)
│   └── mockDb.ts                  # Simulated async save endpoint
├── hooks/
│   └── usePerformanceTracker.ts   # Performance measurement hook
├── components/
│   └── PerformancePanel.tsx       # Metrics sidebar
└── grids/
    ├── tanstack-table/            # TanStack Table implementation
    ├── mui-datagrid-pro/          # MUI DataGrid Pro implementation
    └── react-data-grid/           # React Data Grid implementation
```

## Data Model

Each row represents a student with:

| Category | Columns | Editable |
|----------|---------|----------|
| Metadata | name, email, age, grade, status, enrollmentDate | No |
| Exercises | ex1–ex30 (scores 0–100) | Yes |
| Aggregates | avgScore, minScore, maxScore, totalPoints, passRate | No (computed) |

## Performance Metrics

The sidebar panel tracks:

- **Initial render** — Time from mount to first paint
- **Sort duration** — Time from click to rendered result
- **Filter duration** — Time from input to filtered display
- **Edit duration** — Time from save to state update + mock DB response
- **Render count** — Total component re-renders
- **Last render cycle** — Time between commits via requestAnimationFrame
