# Frontend Design Spec — xp-analyzer Web UI

**Date:** 2026-04-07
**Branch:** frontend
**Status:** Approved

---

## Goal

Build a web frontend that lets non-technical users upload a CSV and configure an experiment, then run the analysis and see a visual report. This replaces the CLI for non-technical users.

---

## Architecture

The frontend lives in a `web/` subdirectory of the existing `xp_analyzer` repo. It is a Next.js App Router project deployed on Vercel, with Vercel's root directory set to `web/`.

**Frontend:** React (TypeScript), single-page app. Wizard state managed entirely in React — no multi-page routing. Data flows forward through steps and users cannot deep-link to intermediate steps.

**Backend:** One Python serverless function at `web/api/analyze.py` (Vercel Python runtime — files in the root-level `api/` directory of the deployed project). Receives a multipart POST with the CSV file + config JSON, runs the existing `xp_analyzer` pipeline directly (no subprocess), and returns an `ExperimentResult` as JSON.

**CSV parsing:** Done client-side in the browser using Papa Parse. Python never sees the raw CSV until the analysis POST — it only runs statistics.

**`xp_analyzer` as a dependency:** The existing `pyproject.toml` makes `xp_analyzer` pip-installable. The Python function lists it in `web/requirements.txt` (e.g. `xp-analyzer @ ../` or published to PyPI). Vercel installs it at deploy time.

```
xp_analyzer/          ← existing Python package (unchanged)
web/                  ← new Next.js project (Vercel root directory)
├── app/
│   └── page.tsx      # Single page, hosts the wizard
├── api/
│   └── analyze.py    # Vercel Python serverless function
├── components/
│   ├── wizard/       # One component per step
│   └── report/       # Recommendation banner, metric cards, caveats
├── lib/
│   └── types.ts      # TypeScript mirrors of Python models
├── requirements.txt  # xp-analyzer, scipy, pandas, numpy
└── package.json
```

---

## Wizard Flow

A 5-step linear wizard. The step indicator is a vertical timeline: completed steps collapse to a one-line summary with a green ✓, the active step is highlighted with a purple border and glow, and upcoming steps are dimmed.

### Step 1 — Upload CSV
Drop zone (or click-to-browse) for a CSV file. On file selection, Papa Parse reads the headers and row count in the browser. Displays a confirmation row: filename, row count, column count. "Continue" is enabled once a valid CSV is loaded.

### Step 2 — Experiment Setup
Three fields, all populated from the parsed CSV:
- **Experiment Name** — free text input
- **Group Column** — dropdown of all CSV column names
- **Control Group Value** — dropdown of unique values in the selected group column (sampled client-side from the first ~1000 rows)

### Step 3 — Add Metrics
Shows a list of configured metrics (each with name, role badge, type, and a remove button). An inline "+ Add Metric" form opens below the list when clicked.

**Add Metric form** uses progressive disclosure:
- Essential fields (always visible): Metric Name (text), Column (dropdown of CSV headers), Type (binary/continuous), Role (primary/guardrail/secondary), Higher is Better (yes/no)
- Advanced options (collapsed behind "Advanced options ▾"): Derive (none/not_null), Filter By (column dropdown + condition dropdown)

At least one metric with role `primary` is required before "Continue" is enabled.

### Step 4 — Review & Run
Displays a config summary: experiment name, group column, control value, metric count, correction method, significance threshold. Two actions:
- **Download config.yaml** — generates and downloads the YAML config locally (Blob download, no server call)
- **Run Analysis** — POSTs CSV + config JSON to `/api/analyze`

During analysis: the "Run Analysis" button shows a spinner and the form locks. If the request takes more than 3 seconds, a "This may take a moment for large files..." message appears.

### Step 5 — Results Report
See Report Layout section below.

---

## API

### `POST /api/analyze`

**Request:** `multipart/form-data`
- `csv` — the CSV file
- `config` — JSON string of the experiment config

The Python function:
1. Reads the CSV into a DataFrame
2. Parses the config JSON into an `ExperimentConfig`
3. Runs `load_experiment_data`, `run_analysis`, `generate_findings`, `generate_recommendation`
4. Returns the `ExperimentResult` as JSON (using `result.to_dict()`)

**Response:** `200 OK` with `ExperimentResult` JSON, or `400 Bad Request` with `{"error": "<message>"}` for validation errors, `500` for unexpected errors.

---

## Report Layout

Shown as Step 5 of the wizard (replaces the wizard form area).

**Recommendation banner** — full-width, color-coded by decision:
- Ship → green
- Don't ship → red
- Review guardrail → orange
- Needs more data / Inconclusive → yellow

Contains the decision label and rationale text.

**Stats bar** — three pills: Total Users, Metric Count, Significance threshold + correction method.

**Metric cards** — one card per metric, color-coded by outcome (green border for positive/significant, red border for guardrail violation, neutral for secondary/non-significant). Each card shows:
- Metric name, role badge, type, direction
- Significance badge (✓ Significant / ⚠ Violation / — Not significant)
- Control mean + n, Treatment mean + n
- Relative lift (large) + absolute lift in pp
- Corrected p-value
- CI bar visualization with "worse ← 0 → better" axis (direction flips for lower-is-better metrics)
- 95% CI range label

**Caveats** — yellow block, shown only when `recommendation.caveats` is non-empty.

**Actions** — two buttons: "Download JSON" (Blob download of the full result), "← Run Another" (resets wizard to Step 1).

---

## Error Handling

**Validation errors** (e.g. column not found, no primary metric): shown inline in the relevant wizard step. The step does not advance until resolved.

**API errors** (analysis fails): dismissible red banner above the "Run Analysis" button showing the error message returned by the API. User can fix config and retry without losing their wizard state.

---

## State Management

All wizard state (CSV file, parsed headers, config being built, result) lives in a single React `useState` object at the top-level page component, passed down as props. No external state library needed for the MVP.

---

## Testing

- **Unit tests** — wizard step components: test that "Continue" is disabled in invalid states, enabled in valid states
- **Integration test** — POST to `/api/analyze` with the existing `xp_data/` fixtures, assert the JSON response matches known-good output
- **No E2E tests** in the MVP (add Playwright later if the UI stabilizes)

---

## Out of Scope (MVP)

- User accounts / authentication
- Saving or browsing past reports
- Multi-treatment group visualization (data is returned but not specially rendered)
- Charts beyond the CI bar (bar charts, forest plots — add in a follow-up)
- Mobile layout optimization
