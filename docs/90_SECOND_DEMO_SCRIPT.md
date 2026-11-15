# 90-Second Demo Script

**Use production mode with `mars-gale-aeolis-palus-v1`.**  
**Goal:** tell one complete story: question → evidence → caveat → impact.

| Time | Screen action | Spoken script |
|---|---|---|
| 0:00–0:10 | Open Mission Control. | “Mission rehearsal starts on Earth. This reference window, model run, and disclaimer are the canonical story used by ranking and Explorer.” |
| 0:10–0:24 | Open **Explore terrain**. | “Explorer shows the Mars reference and five Earth windows from the same model run. Each window has 25 source-backed grid samples; it does not invent terrain cells from a ranking aggregate.” |
| 0:24–0:38 | Select the top Earth window, inspect one cell, then return to the window. | “The map exposes slope, roughness, and relative relief alongside dataset provenance and limitations. It is a terrain comparison, not a mission-site approval.” |
| 0:38–0:52 | Open **Ranking**, then select rank 1. | “The same five candidates are ranked with median slope, terrain roughness, and relative relief. The top result is a data-derived similarity score, not a probability.” |
| 0:52–1:08 | Open **Candidate detail** and the evidence panel. | “Raw values, feature contributions, source IDs, the operational hypothesis, and limitations remain visible. The explanation matters as much as the score.” |
| 1:08–1:20 | Read one limitation, then open **Methodology & provenance**. | “A terrain match does not model gravity, atmosphere, radiation, temperature, biology, access, safety, regulation, or land permissions.” |
| 1:20–1:30 | Show model run and both source datasets. | “The exact run, 500-metre analysis resolution, 3-kilometre local window, transform version, MOLA, and NASADEM sources make this an auditable starting point for field-validation questions.” |

## Delivery notes

- Do not say “best landing site,” “proven analog,” “AI discovery,” or “mission-ready.”
- Spend the most time on the evidence panel and scientific boundary, not the ranking number.
- If production data is unavailable, stop the demo rather than presenting fixture values as measurements. The fixture banner must remain visible during any interface-only fallback demonstration.
- Keep the final sentence unhurried; it is the project’s impact statement.

## Rehearsal pass/fail

- [ ] Completes in 80–90 seconds without rushing.
- [ ] Shows the production data-mode banner.
- [ ] Shows the same model run in Explorer and Ranking.
- [ ] Shows one Explorer window and one grid-cell inspection.
- [ ] Opens one candidate’s raw features, contributions, hypothesis, and limitation.
- [ ] Opens methodology and identifies both datasets.
- [ ] States at least one unmodeled condition.
- [ ] Avoids unsupported scientific or AI claims.
