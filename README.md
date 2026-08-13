# Swiss Forest Explorer — ArcGIS version

This is a standalone ArcGIS Maps SDK for JavaScript application. It no longer uses Mapbox,
Mapbox tilesets, or a Mapbox token.

The current interface is map-first: display settings and national statistics open on demand,
while clicking a valid 30 m forest cell reads the 11 public tree-group basal-area services and
shows their exact Float32 values together with the dominant tree group. Raster hit testing requires
ArcGIS Maps SDK for JavaScript 5.1 or newer.

## Advanced workbench

The Workbench button opens five analysis capabilities without adding an export workflow:

1. **Region analysis** — draw a rectangle, circle or polygon and calculate the mean 11-group
   basal-area composition inside it. Regions small enough to fit the processing budget are read at the native
   30 m grid; larger regions are sampled on a maximum 220 × 220 grid and are clearly labelled with
   their effective sample spacing.
2. **Conditional filter** — filter the selected region by any species value, top-two gap or
   normalised entropy, then highlight matching sampled cells.
3. **Uncertainty analysis** — reports mean normalised entropy, mean top-two gap, ambiguous-cell
   share and mean leading basal-area group, with a green-to-red map overlay.
4. **Enhanced comparison** — includes presets, per-side opacity, side swapping and sliding or
   side-by-side layouts. Both views remain synchronised.
5. **Layer manager** — independently stacks the dominant raster, a selected composition raster,
   analysis graphics and either base map, with visibility, opacity and layer-order controls.

The pixel inspector also reports entropy and the top-two composition gap for the clicked cell.
Entropy and gap describe composition ambiguity; they are model-derived diagnostics rather than a
calibrated probability that the dominant label is correct.

```powershell
python .\serve.py     # http://127.0.0.1:8789
```

## Published dominant-tree-group service

The app loads the public tiled image service directly:

`https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/species_argmax/ImageServer`

Its metadata declares a one-band 30 m thematic raster with class values 1–11 and LERC tiles.
`app.js` applies a fixed 11-colour pixel filter to these class IDs. Values outside 1–11
(including NoData) are masked, so category colours cannot be interpolated or blended with
the basemap at forest boundaries.

The labels follow the model's 11 groups: Spruce (*Picea* spp.), Fir (*Abies alba*), Pine
(*Pinus* spp.), Larch (*Larix* spp.), Arolla pine (*Pinus cembra*), Beech (*Fagus sylvatica*),
Maple (*Acer* spp.), Ash (*Fraxinus* spp.), Oak (*Quercus* spp.), Chestnut (*Castanea sativa*)
and Other retained taxa. The raster's service class values are 1–11; the model category IDs
are documented as 0–10, so the browser explicitly maps between those two schemes.

## Meaning of the displayed proportion

The displayed 0–1 values are modelled **Swiss NFI basal-area proportions**, not stem-count
proportions. In the Swiss NFI, basal area is the sum of stem cross-sectional areas at 1.3 m for
living trees and shrubs with DBH ≥12 cm. The displayed percentage therefore describes the
modelled share of basal area assigned to each tree group in that 30 m cell.

Swissimage is used over Switzerland; OpenStreetMap remains beneath it as the global fallback.

## Published basal-area services

The dominant and all 11 separately published tree-group services are configured in
[arcgis-services.js](./arcgis-services.js). To replace the data release, update the corresponding
public ImageServer URL there, for example:

```js
broadleaf: 'https://.../arcgis/rest/services/swiss_forestleaf_probability_01_broadleaf/ImageServer',
spruce: 'https://.../arcgis/rest/services/swiss_forestspecies_probability_01_spruce/ImageServer',
```

Once a URL is present, its selector entry becomes available in the map. The Float32 raster is
requested as LERC and colourised in the browser, so the colour scale, display range and
opacity controls remain user-adjustable.

For each service, share it with **Everyone (public)** in ArcGIS Online. A browser app cannot
safely hold an owner token or an ArcGIS username/password.
