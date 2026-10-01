/* =========================================================
   DEFESA VEGETAL AM V2
   SERVICE WORKER
========================================================= */

const CACHE_NAME =
  'defesa-vegetal-am-v2-alpha-6';

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

self.addEventListener(
  'install',
  event => {

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(
            APP_SHELL
          );
        })
    );

    self.skipWaiting();
  }
);

/* =========================================================
   ATIVAÇÃO
========================================================= */

self.addEventListener(
  'activate',
  event => {

    event.waitUntil(
      caches
        .keys()
        .then(keys => {
          return Promise.all(
            keys
              .filter(key => {
                return (
                  key !== CACHE_NAME &&
                  key.startsWith(
                    'defesa-vegetal-am-v2-'
                  )
                );
              })
              .map(key =>
                caches.delete(key)
              )
          );
        })
    );

    self.clients.claim();
  }
);

/* =========================================================
   REQUISIÇÕES
========================================================= */

self.addEventListener(
  'fetch',
  event => {

    const request =
      event.request;

    /*
      POST e demais métodos não entram
      no cache do Service Worker.
    */
    if (request.method !== 'GET') {
      return;
    }

    const url =
      new URL(request.url);

    /*
      Não interferimos em recursos
      de outros domínios.
    */
    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
      NAVEGAÇÃO

      Online:
      tenta carregar a versão atual.

      Offline:
      abre o index.html armazenado.
    */
    if (
      request.mode === 'navigate'
    ) {

      event.respondWith(
        fetch(request)
          .catch(() => {
            return caches.match(
              './index.html'
            );
          })
      );

      return;
    }

    /*
      ARQUIVOS ESTÁTICOS

      Primeiro procura no cache.
      Se não encontrar, busca na rede
      e guarda uma cópia.
    */
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

              const responseCopy =
                response.clone();

              caches
                .open(CACHE_NAME)
                .then(cache => {
                  cache.put(
                    request,
                    responseCopy
                  );
                });

              return response;
            });
        })
    );
  }
);
