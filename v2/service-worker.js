/* =========================================================
   DEFESA VEGETAL AM V2
   SERVICE WORKER
========================================================= */

const CACHE_NAME =
  'defesa-vegetal-am-v2-alpha-8';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './db.js',
  './api.js',
  './modules/cadastros.js',
  './app.js',
  './manifest.json'
];


/* =========================================================
   INSTALAÇÃO
========================================================= */

self.addEventListener('install', event => {

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll(APP_SHELL)
      )
  );

  self.skipWaiting();
});


/* =========================================================
   ATIVAÇÃO
========================================================= */

self.addEventListener('activate', event => {

  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith(
                'defesa-vegetal-am-v2-'
              ) &&
              key !== CACHE_NAME
            )
            .map(key =>
              caches.delete(key)
            )
        )
      )
      .then(() =>
        self.clients.claim()
      )
  );
});


/* =========================================================
   REQUISIÇÕES
========================================================= */

self.addEventListener('fetch', event => {

  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /*
    Não interfere nas requisições
    para Google Apps Script ou
    outros domínios.
  */
  if (url.origin !== self.location.origin) {
    return;
  }


  /* =======================================================
     NAVEGAÇÃO
     Rede primeiro / cache como fallback
  ======================================================= */

  if (request.mode === 'navigate') {

    event.respondWith(
      fetch(request)
        .then(response => {

          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache =>
              cache.put(
                './index.html',
                copy
              )
            );

          return response;
        })
        .catch(() =>
          caches.match('./index.html')
        )
    );

    return;
  }


  /* =======================================================
     JS E CONFIGURAÇÃO
     Rede primeiro.

     Evita executar versões antigas
     de app.js, api.js, db.js,
     config.js e módulos.
  ======================================================= */

  const isDynamicCode =
    url.pathname.endsWith('.js');

  if (isDynamicCode) {

    event.respondWith(
      fetch(request)
        .then(response => {

          if (
            response &&
            response.status === 200
          ) {

            const copy =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache =>
                cache.put(
                  request,
                  copy
                )
              );
          }

          return response;
        })
        .catch(() =>
          caches.match(request)
        )
    );

    return;
  }


  /* =======================================================
     DEMAIS ARQUIVOS
     Cache primeiro
  ======================================================= */

  event.respondWith(
    caches
      .match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (
              !response ||
              response.status !== 200
            ) {
              return response;
            }

            const copy =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache =>
                cache.put(
                  request,
                  copy
                )
              );

            return response;
          });
      })
  );
});
