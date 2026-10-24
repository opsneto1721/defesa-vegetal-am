const APP_CONFIG = {
  APP_NAME: 'Defesa Vegetal AM',
  APP_VERSION: '2.0.0-alpha.1',

  // API exclusiva da V2. Será configurada posteriormente.
  API_URL: 'https://script.google.com/macros/s/AKfycbzhxCbmJIhUQa40j4Vk52ZO42wi-YEMQ7ETS3U8PPJIUtg-VuYa9R8SxDaXT0tvS6AE/exec',

  REQUEST_TIMEOUT: 30000,
  AUTO_SYNC: true,

  CATALOG_STORES: [
    'cadastroCulturas',
    'cadastroPragas',
    'programasTecnicos',
    'programaCultura',
    'pragaCultura',
    'camposDinamicos',
    'opcoesCampos',
    'campoCultura',
    'listasApoio'
  ]
};
