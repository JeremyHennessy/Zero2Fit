# Zero2Fit

Personal fitness, nutrition, workout and progression tracker hosted on GitHub Pages.

Zero2Fit is intentionally a **one-person app**, not a commercial SaaS product. The UI combines straightforward fitness tracking with an optional RPG progression layer: real actions earn XP, improve character attributes, unlock milestones, and advance longer-term "boss" objectives.

## Build 001

- responsive Today dashboard
- recoverable Momentum score
- daily quest board with XP
- RPG character level and attributes
- Quick / Standard / Full workout modes
- set-by-set workout tracking
- manual weight and steps
- calorie/protein food log
- Journey view and progress history
- Data/provenance view
- browser localStorage persistence
- GitHub Pages deployment workflow

## Run locally

No build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages after pushes to `main` once GitHub Pages is configured to use **GitHub Actions** as its publishing source.

Expected project URL:

`https://jeremyhennessy.github.io/Zero2Fit/`

## Product/architecture notes

See [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).
