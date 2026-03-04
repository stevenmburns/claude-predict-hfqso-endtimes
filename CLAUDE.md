# Project: predict-hfqso-endtimes

## Overview
Visualises cumulative HF QSO completions per band and predicts session end times.

## Stack
- **Front-end:** Vite + React + TypeScript in `chart-app/`
- **Charting:** Recharts (`ComposedChart` with `Area` + `Line`)
- **Tests:** Vitest — run with `npm test` inside `chart-app/`
- **Data generation:** Python 3.12 + numpy — `generate_mock_data.py` at repo root
- **Deployment:** Netlify, auto-deploy from `main` — https://predict-hfqso-endtimes.netlify.app/

## Key files
- `chart-app/src/chartLogic.ts` — all pure data logic (testable, no React deps)
- `chart-app/src/App.tsx` — chart rendering only
- `chart-app/public/mock_data.json` — data served to the app in dev/prod

## Data schema
Each record in `mock_data.json`:
```json
{ "Band": "17m", "Completed": true, "Completed_Timestamp": "2026-03-04T17:31:01+00:00" }
{ "Band": "12m", "Completed": false }
```
Pending records have `Completed: false` and no `Completed_Timestamp`.

## Bands and order
`["17m", "15m", "12m", "10m"]` — processed and charted in this order.

## Prediction logic
- **Active band** (partial completion): uses its own mean inter-arrival time
- **Queued bands** (zero completed): chain from active band's predicted end, use global mean rate
- Each band's cumulative count offsets from where the previous band ended
