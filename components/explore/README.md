# /explore: map and inspector (Anggota 3, Day 1)

Copy into the Next.js project (App Router, TypeScript, `@/*` path alias):

| From this folder | To |
|---|---|
| `app/explore/page.tsx` | `app/explore/page.tsx` |
| `components/explore/*` | `components/explore/` |
| `lib/explore/*` | `lib/explore/` |
| `public/data/demo/explore-fixture.json` | hand to Anggota 1 (owns `public/data/demo/`) |

Install: `npm i maplibre-gl` (and `npm i -D @types/geojson` if TypeScript cannot find `geojson`).

Notes
- Data comes from `lib/explore/data.ts` (one URL). Replace with the real API route later; the loader expects `{ data: { datasets, windows }, meta: { modelRunId } }`.
- Cell polygons are placed from `offsetEastKm`/`offsetNorthKm` using spherical km-per-degree (`lib/explore/geo.ts`). Confirm the same convention with the data owner.
- No basemap yet. When terrain images exist, put them only in `public/layers/` and list them in `public/layers/manifest.json`.
- The scale control is intentionally omitted: MapLibre's scale assumes Earth.
- `.root` uses `100dvh`; adjust if your layout has a header.
