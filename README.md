# predict-hfqso-endtimes

A small tool for tracking the progress of the [hfqso.com](https://hfqso.com) activity group across HF bands, with prediction of when each band session will wrap up.

**Live app:** https://predict-hfqso-endtimes.netlify.app/

## What it does

Given a log of completed activity entries with timestamps, the app plots cumulative completion counts across four bands (17m, 15m, 12m, 10m) as step curves over time. For any band session still in progress, it projects a dashed trend line forward using the mean inter-arrival rate of completed entries. Bands not yet started are extrapolated in sequence from that predicted finish time, using the global mean rate across all completed entries.

## Repository layout

```
generate_mock_data.py   # Generates mock_data.json for development
mock_data.json          # Sample data (committed for reference)
chart-app/              # Vite + React + TypeScript front-end
  src/
    chartLogic.ts       # Pure data transformation functions
    chartLogic.test.ts  # Vitest unit tests
    App.tsx             # Chart rendering (Recharts)
```

## Running locally

```bash
cd chart-app
npm install
npm run dev
```

Open http://localhost:5173 (or the next available port).

## Running tests

```bash
cd chart-app
npm test
```

## Regenerating mock data

```bash
python generate_mock_data.py
cp mock_data.json chart-app/public/mock_data.json
```

Requires Python 3.12 and numpy (`pip install numpy`).

## Deployment

The `chart-app/` directory is deployed automatically to Netlify on every push to `main`. Build settings:

- **Base directory:** `chart-app`
- **Build command:** `npm run build`
- **Publish directory:** `dist`

## License

MIT — see [LICENSE](LICENSE).
