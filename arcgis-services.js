// Public ArcGIS ImageServer endpoints only. No token or API key is needed in this app.
// Add the individual public probability ImageServer URLs as they are published.
window.SWISS_FOREST_ARCGIS_SERVICES = {
  cantonStatistics: 'https://services-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/canton_statistics/FeatureServer/0',
  dominant: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/species_argmax/ImageServer',
  probabilities: {
    broadleaf: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestleaf_probability_01_broadleaf/ImageServer',
    spruce: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_01_spruce/ImageServer',
    fir: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_02_fir/ImageServer',
    pine: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_03_pine/ImageServer',
    larch: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_04_larch/ImageServer',
    arollaPine: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_05_arolla_pine/ImageServer',
    beech: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_06_beech/ImageServer',
    maple: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_07_maple/ImageServer',
    ash: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_08_ash/ImageServer',
    oak: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_09_oak/ImageServer',
    chestnut: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_10_chestnut/ImageServer',
    other: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forestspecies_probability_11_other/ImageServer'
  }
};
