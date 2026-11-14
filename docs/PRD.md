# PRD — Terra Analog Mission Control

**Status:** MVP definition  
**Product type:** Web-based, explainable planetary-analog discovery tool  
**Primary target:** Mars  
**Deployment:** Vercel (`*.vercel.app`)  
**MVP delivery window:** 2 days, 5 people, 4 hours/person/day (40 person-hours)

## 1. Product summary

Terra Analog Mission Control helps exploration teams and the public identify Earth locations that are useful *terrestrial analog hypotheses* for a selected Mars environment. The product lets a user inspect a Mars reference region, compare its measurable terrain/environment feature profile against curated Earth candidates, and see an explainable ranking with both similarities and limits.

It is **not** a landing-site recommender, proof of geological equivalence, or a replacement for field validation. It is a transparent discovery and communication tool that turns multi-source planetary data into testable hypotheses.

## 2. Problem and opportunity

Mission teams use terrestrial analogs to rehearse operations, evaluate instruments, and study processes relevant to Mars. Known sites are valuable but not exhaustive, while cross-planet datasets are difficult to compare because they use different sensors, resolutions, and physical contexts. A visual-only comparison can produce misleading matches.

The opportunity is an interface that combines terrain and environmental proxies into a reproducible similarity workflow, makes every score inspectable, and explicitly exposes where the analogy fails.

## 3. Vision, users, and value

### Vision

Make the search for Mars analog environments understandable, reproducible, and useful for exploration conversations.

### Primary users

1. **Challenge judges and science communicators:** need a memorable, evidence-backed demonstration.
2. **Students and citizen scientists:** need an accessible way to explore why locations are comparable beyond appearance.
3. **Future researchers/mission planners:** need exportable, provenance-rich candidate hypotheses for further review.

### Core value proposition

For a selected Mars reference zone, the user can answer: **Which curated Earth places are most comparable on selected measurable dimensions, why, what data supports that statement, and what remains fundamentally different?**

## 4. Product principles

- **Explainable before impressive:** every ranking must show feature contributions, weights, data quality, source, and limitations.
- **Comparable, not identical:** Earth, Mars, and later Moon values are normalized within each body's measurement context; raw values are not falsely equated.
- **Science claims are bounded:** use “candidate”, “hypothesis”, and “proxy” unless supported by cited validation.
- **Demo resilience:** a curated static catalog must power the demo even when third-party data services are unavailable.
- **Mars-first, Moon-ready:** entity names, body identifiers, and schemas accommodate `mars`, `earth`, and `moon`; Moon UI/data are not MVP requirements.

## 5. Goals and non-goals

### MVP goals

- Deliver a polished Mission Control interface hosted on Vercel.
- Support pan, zoom, click, map layers, candidate inspection, Earth–Mars comparison, and a ranked candidate list.
- Present one to three Mars reference zones and five to ten curated Earth candidates.
- Score candidates from three required comparable features: slope, terrain roughness, and elevation/relative relief; add one environmental proxy only if its provenance and coverage are ready.
- Persist source dataset and model version for every displayed score.
- Tell a clear 90-second demo story that includes both a strong match and a mismatch.

### Non-goals for MVP

- Live global raster analysis in the browser.
- Real-time model training or raw NASA archive ingestion at request time.
- Claiming a novel field-discovered analog without scientific review.
- User accounts, collaboration, user uploads, or public edits.
- Equal Moon feature coverage; Moon is a planned extension.

## 6. Main user journey

1. User lands on **Mission Control** and selects a preconfigured Mars scenario.
2. The map centers on the Mars reference zone with topography and derived terrain layers.
3. User clicks the zone to view a feature profile, source data, and operations context.
4. User opens **Find Earth Analogs**; the system returns ranked Earth candidates.
5. User chooses a candidate and views Earth/Mars profiles side-by-side: matched features, differences, confidence, and evidence.
6. User toggles layers and adjusts only preapproved weights within a bounded range.
7. User reads the limitations card and opens source citations.

## 7. Functional requirements

| ID | Requirement | MVP acceptance criterion |
|---|---|---|
| FR-01 | Mission Control landing page | Explains purpose, scientific boundary, featured scenario, and enters explorer. |
| FR-02 | 2D interactive map | Pan, zoom, layer toggles, and clickable reference/candidate features work on desktop. |
| FR-03 | Layer controls | At least topography, slope, and roughness can be independently enabled; legend and unit are visible. |
| FR-04 | Location inspection | Click opens name, coordinates, feature values, data quality, sources, and interpretation. |
| FR-05 | Earth–Mars comparison | Side-by-side profile shows normalized values, raw-value units, match/mismatch explanations, and limits. |
| FR-06 | Similarity ranking | Returns 5–10 candidates sorted by reproducible score with model/dataset version. |
| FR-07 | Explainability | Shows weighted contribution for each included feature and no-data exclusion. |
| FR-08 | Provenance | Every scenario, layer, and ranking links to dataset metadata and citation. |
| FR-09 | Responsive and accessible shell | Keyboard-navigable controls, semantic labels, and usable layout at 1280px and 375px. |
| FR-10 | Failure behavior | Missing layer/data shows a human-readable fallback; the app never invents a score. |

## 8. Similarity contract

For each reference region and Earth candidate, the pipeline stores a normalized feature vector and a score:

`distance = Σ(weight_i × |normalizedCandidate_i − normalizedReference_i|)`

`similarityScore = 100 × (1 − distance / Σ(weight_i))`

Features missing for either side are excluded and the available-weight share is displayed as `dataCoverage`. Weights total 1.0. Default MVP weights: slope 0.35, roughness 0.35, relative relief 0.30. Weight controls are constrained to 0.15–0.50 per feature and re-normalized.

The normalized value is a percentile or robust z-score relative to the body-specific study population, recorded with its transform. Raw measurements and source units remain visible. This prevents the score from implying that, for example, an Earth elevation has the same physical reference frame as a Mars elevation.

## 9. Scientific integrity requirements

- Show “data-derived similarity, not mission-site approval” beside every ranking.
- State unmodeled factors: gravity, atmospheric pressure/composition, radiation, global temperature regime, and biological activity.
- Use a named source and product version for all input features.
- Display the native resolution and analysis resolution; never present a derived layer as more precise than its source.
- Separate operational relevance from similarity: a terrain match does not prove logistics, access, land rights, or safety.
- Validate each featured Earth candidate against at least one independent literature/source note before demo.

## 10. NASA Space Apps rubric strategy

| Rubric | Product evidence |
|---|---|
| **Impact** | Each candidate includes a concrete exploration use, such as rover mobility rehearsal, instrument calibration, terrain navigation, or geologic-process study. A downloadable evidence card is the post-MVP path. |
| **Creativity** | The product pairs multilayer map exploration with an explainable cross-planet analog engine and makes the *breakdown* of an analogy first-class rather than hiding it. |
| **Validity** | Dataset provenance, units, resolution, body-specific normalization, visible equation, confidence, feature contribution, caveats, and validation notes are part of the interface. |
| **Relevance** | Directly fulfills the challenge objective: use open Earth and Mars data to identify, characterize, compare, and communicate terrestrial analog candidates. |

## 11. MVP content model

- **Mars scenarios:** 1 required, up to 3 if preprocessed. Each represents a bounded region rather than all of Mars.
- **Earth candidates:** 5 required, up to 10 curated candidates from varied terrain classes.
- **Layers:** topography, slope, roughness required; one optional environmental or materials proxy.
- **Evidence per candidate:** data profile, score, explanation, operational relevance hypothesis, limitation statement, citations.

## 12. Success metrics

### Demo success

- A first-time viewer can reach a ranked Earth candidate from a Mars scenario in under 45 seconds.
- Every displayed score has a model version and at least three source-backed feature values.
- The team can explain why the first-ranked candidate is not necessarily the best field site.
- No critical interaction fails during an offline/static-data demo.

### Product-quality targets

- Initial explorer load under 3 seconds on a typical broadband connection.
- Interaction response under 250ms for cached scenario/ranking data.
- Lighthouse accessibility target: 90+ for the non-map UI; map controls carry accessible labels.
- Zero unhandled API errors in the scripted demo path.

## 13. Two-day delivery plan

### Day 1 — establish truth and interaction

| Role | Output |
|---|---|
| Science/data lead | Freeze feature definition, source registry, scenario/candidate catalog, and caveat copy. |
| Data engineer | Produce harmonized feature table, deterministic ranking JSON, model manifest, and validation checks. |
| Map/frontend lead | Build map shell, basemap, layer controls, legend, and inspection panel. |
| Full-stack lead | Set up Supabase schema, seed data, typed API routes, and comparison/ranking UI contracts. |
| Story/QA lead | Write landing narrative, provenance cards, rubric evidence, demo script, and test cases. |

### Day 2 — integrate, explain, and rehearse

- Integrate ranking and comparison endpoints with curated data.
- Add contribution chart, coverage/confidence badge, and limitations component.
- Verify exact source citations, units, and copy.
- Deploy preview and production to Vercel; execute demo path on a fresh device/browser.
- Record or rehearse a 90-second narrative: question → Mars zone → ranking → evidence → caveat → impact.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Different sensor scales make comparisons misleading | Use derived, scale-aware features; disclose resolution and normalize per body. |
| NASA data download/API friction | Bundle a small, cited curated dataset and processed GeoJSON before frontend integration. |
| “AI” overclaim damages validity | Describe the method accurately as explainable similarity learning / nearest-neighbor ranking. |
| Time spent on global coverage harms demo | Freeze one Mars scenario and five strong candidates first. |
| Map imagery or tile provider fails | Ship local vector layers and a static image fallback for the demo. |
| Sensitive/remote Earth locations create false operational claims | Avoid access/safety endorsements; state field validation, permissions, and local expertise are required. |

## 15. Roadmap

### Immediately after MVP

- Add reproducible candidate export (CSV/JSON evidence packet).
- Add more Mars reference zones and sensitivity analysis for feature weights.
- Introduce PostGIS for regional candidate search and spatial filtering.

### Moon extension

- Add `moon` body records and Lunar Orbiter Laser Altimeter-based terrain products.
- Create Moon-specific scenarios and caveat set; do not reuse Mars environmental semantics.
- Keep the shared feature registry, transform metadata, provenance model, and comparison UI.

### Research-grade direction

- Independent expert review of candidates.
- Regional/global tiled feature store, uncertainty propagation, process-oriented features, and reproducible notebooks.
- Explicit evaluation against known analog sites held out from ranking calibration.
