# TreeAI — Switzerland Forest Species Composition

An interactive web map of modelled tree species composition across Switzerland, developed within the TreeAI project at ETH Zürich.

**Live site:** https://yixin-zhou.github.io/treeai-forest-composition/

## What it shows

Three views of the same 30 m national model:

| View | Layer | Description |
| --- | --- | --- |
| Dominant Species | Categorical | Argmax class across the nine modelled species |
| Leaf Type Composition | Float32 | Broadleaf share |
| Species Composition | Float32 | Relative composition of one selected species |

Nine modelled species: *Picea abies*, *Fagus sylvatica*, *Abies alba*, *Larix decidua*, *Acer pseudoplatanus*, *Fraxinus excelsior*, *Pinus sylvestris*, *Castanea sativa*, *Betula pendula*.

Values describe relative composition among these nine species. They are not occurrence probability or absolute canopy cover.

## Tools

- **Compare** — sliding or side-by-side comparison of any two layers, locked to the same view
- **Workbench** — draw a region and compute mean composition, conditional filters, and uncertainty (entropy, top-two gap)
- **Statistics** — national distribution of the dominant class
- **Cell inspector** — click any pixel for its full nine-species profile

## Data services

Raster data is served from public ArcGIS ImageServer endpoints listed in `arcgis-services.js`. No API key or token is required. The site is fully static — there is no backend.

## Running locally

Any static file server works, for example:

```bash
python3 -m http.server 8789
```

Then open http://127.0.0.1:8789.

## Deployment

Hosted on GitHub Pages from the `main` branch, root folder. `.nojekyll` is present so the files are served as-is.

## Dependencies

Loaded from CDN at runtime: ArcGIS Maps SDK for JavaScript 5.1, ECharts 5.5, and Google Fonts (DM Sans, DM Mono, STIX Two Text).
