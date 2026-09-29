// v0.3: URL e token NÃO ficam no código. São informados na tela Configuração e salvos somente neste navegador.
const APP_CONFIG={
 get API_URL(){return localStorage.getItem('dv_api_url')||''},
 get API_TOKEN(){return localStorage.getItem('dv_api_token')||''},
 save(url,token){localStorage.setItem('dv_api_url',String(url||'').trim());localStorage.setItem('dv_api_token',String(token||'').trim())}
};
