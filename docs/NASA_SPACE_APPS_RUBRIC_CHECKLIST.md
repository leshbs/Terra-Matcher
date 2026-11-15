# NASA Space Apps Rubric Checklist

Last reviewed: 2026-11-15  
Scope: Terra Analog Mission Control MVP, model run `2026-11-14-mvp-v1`

NASA Space Apps identifies five core judging criteria: Impact, Creativity, Validity, Relevance, and Presentation. This checklist maps the current MVP to those criteria and separates completed evidence from the remaining submission work.

| Criterion | Current evidence | Status | Before submission |
|---|---|---|---|
| Impact | The product frames terrain comparison as an auditable starting point for rover, instrument, and geology questions; every candidate includes a hypothesis and limitation. | Ready for demo | State one concrete beneficiary in the project page and measure a simple usability outcome during rehearsal. |
| Creativity | It treats the failure modes of an analogy as first-class evidence: feature contributions, data coverage, and limitations appear beside rankings rather than below marketing copy. | Ready for demo | Show the evidence panel in the demo; do not market the method as AI discovery. |
| Validity | Production scores are rejected if source IDs, all three feature contributions, coverage, operational hypothesis, or limitations are incomplete. MOLA and NASADEM metadata are registered and exposed. | Ready for demo | Run the app with the production Supabase seed and retain a screenshot of the methodology page. |
| Relevance | The MVP applies NASA/open planetary data to an Earth–Mars exploration comparison and makes the data source and scientific boundary visible. | Ready for demo | Link the project page explicitly to the selected official challenge statement once the team has frozen it. |
| Presentation | English copy, a 90-second arc, and methodology navigation are ready. The UI communicates fixture versus production data. | Needs rehearsal | Rehearse within 90 seconds, capture a backup recording, and test the public deployment on a fresh browser. |

## Non-negotiable claims checklist

- [x] Use “candidate hypothesis” and “data-derived similarity.”
- [x] Do not call a ranked location the “best landing site.”
- [x] Do not call any candidate a “proven analog.”
- [x] Do not claim “AI discovery” or a black-box model.
- [x] State the unmodeled conditions: gravity, atmosphere, radiation, temperature regime, biological activity, access, safety, regulation, and land permissions.
- [x] Distinguish a terrain match from field suitability, rover safety, and mission approval.

## Demo evidence to capture

1. Landing/dashboard with the data-mode banner visible.
2. Candidate detail with feature values, contributions, operational hypothesis, and limitation.
3. Methodology page with model run and both registered datasets.
4. A production API response or seed log demonstrating five rankings and full coverage.
5. A test log for the provenance validator and scientific-claim scanner.

## Remaining release gate

- [ ] Apply the production migration and seed to the target Supabase project.
- [ ] Verify `/`, `/methodology`, and the production scenario on the deployed application.
- [ ] Complete one timed 90-second rehearsal and record priority bugs.
- [ ] Paste the submission description into the official project page and link the repository/demo.

## Source

The current Space Apps site states the five criteria and their focus. See the [2026 NASA Space Apps judging overview](https://www.spaceappschallenge.org/2026/local-events/ajmer/) and the [NASA Space Apps Challenge overview](https://www.spaceappschallenge.org/about/).
