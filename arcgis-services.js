// Public ArcGIS ImageServer endpoints only. No token or API key is needed in this app.
// Add the individual public probability ImageServer URLs as they are published.
window.SWISS_FOREST_ARCGIS_SERVICES = {
  dominant: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species/ImageServer',
  probabilities: {
    broadleaf: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_prob_broadleaf/ImageServer',
    picea: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_01_picea_abies/ImageServer',
    fagus: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_02_fagus_sylvatica/ImageServer',
    abies: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_03_abies_alba/ImageServer',
    larix: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_04_larix_decidua/ImageServer',
    acer: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_05_acer_pseudoplatanus/ImageServer',
    fraxinus: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_06_fraxinus_excelsior/ImageServer',
    pinus: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_07_pinus_sylvestris/ImageServer',
    castanea: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_08_castanea_sativa/ImageServer',
    betula: 'https://tiledimageservices-eu1.arcgis.com/DmEtBMiyE68OImsA/arcgis/rest/services/swiss_forest_species_probability_09_betula_pendula/ImageServer'
  }
};
