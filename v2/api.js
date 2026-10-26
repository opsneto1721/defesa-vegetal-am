/* =========================================================
   DEFESA VEGETAL AM V2
   API + SINCRONIZAÇÃO OFFLINE-FIRST
========================================================= */

function apiIsConfigured() {
  return Boolean(
    APP_CONFIG.API_URL &&
    APP_CONFIG.API_URL.trim()
  );
}

/* =========================================================
   REQUISIÇÃO À API
========================================================= */

async function apiRequest(action, payload = {}) {
  if (!apiIsConfigured()) {
    throw new Error('API_V2_NAO_CONFIGURADA');
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    APP_CONFIG.REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },

      body: JSON.stringify({
        action,
        payload,
        appVersion: APP_CONFIG.APP_VERSION,
        sentAt: new Date().toISOString()
      }),

      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const result = await response.json();

    if (!result || result.ok !== true) {
      throw new Error(
        result?.error || 'ERRO_API'
      );
    }

    return result;

  } catch (error) {

    if (error.name === 'AbortError') {
      throw new Error('TEMPO_LIMITE_API');
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   PRIORIDADE DE SINCRONIZAÇÃO

   Registros-pai são enviados antes dos registros-filhos.
========================================================= */

const SYNC_PRIORITY = {
  produtores: 10,

  propriedades: 20,

  culturas: 30,
  viveiros: 30,
  armadilhas: 30,

  dadosCultura: 35,
  especiesViveiro: 35,

  documentosViveiro: 40,

  fiscalizacoes: 50,

  fiscalizacaoCulturas: 55,

  ocorrenciasPragas: 60,
  monitoramentosArmadilhas: 60,

  dadosFiscalizacao: 65,

  amostras: 70,
  providencias: 70,
  evidencias: 70,

  assinaturas: 80,

  documentos: 90
};

function getSyncPriority(entity) {
  return SYNC_PRIORITY[entity] ?? 999;
}

/* =========================================================
   VERIFICAÇÃO DE DEPENDÊNCIAS
========================================================= */

async function dependenciesAreReady(item) {
  if (
    !Array.isArray(item.dependsOn) ||
    item.dependsOn.length === 0
  ) {
    return true;
  }

  for (const dependency of item.dependsOn) {
    const record = await dbGet(
      dependency.entity,
      dependency.recordId
    );

    if (
      record &&
      record.syncStatus !== 'SINCRONIZADO'
    ) {
      return false;
    }
  }

  return true;
}

/* =========================================================
   SINCRONIZAÇÃO DE UM REGISTRO
========================================================= */

async function syncQueueItem(item) {
  const record = await dbGet(
    item.entity,
    item.recordId
  );

  /*
    Se o registro não existir mais localmente,
    removemos o item órfão da fila.
  */
  if (!record) {
    await removeQueueItem(item.id);

    return {
      ok: true,
      removed: true
    };
  }

  const ready =
    await dependenciesAreReady(item);

  if (!ready) {
    return {
      ok: false,
      waitingDependency: true
    };
  }

  await markQueueItemSyncing(item.id);

  try {
    const result = await apiRequest(
      'syncRecord',
      {
        entity: item.entity,
        operation: item.operation,
        record
      }
    );

    /*
      IMPORTANTE:
      markRecordSynced preserva record.id.
      Portanto o ID interno do IndexedDB
      nunca é substituído pelo ID oficial.
    */
    await markRecordSynced(
      item.entity,
      item.recordId,
      result.record || {}
    );

    await removeQueueItem(item.id);

    return result;

  } catch (error) {

    await markQueueItemError(
      item.id,
      error
    );

    throw error;
  }
}

/* =========================================================
   SINCRONIZAÇÃO COMPLETA
========================================================= */

let syncInProgress = false;

async function syncAll() {
  if (syncInProgress) {
    return {
      ok: false,
      reason: 'SYNC_EM_ANDAMENTO'
    };
  }

  if (!navigator.onLine) {
    return {
      ok: false,
      reason: 'OFFLINE'
    };
  }

  if (!apiIsConfigured()) {
    return {
      ok: false,
      reason: 'API_NAO_CONFIGURADA'
    };
  }

  syncInProgress = true;

  window.dispatchEvent(
    new CustomEvent('sync-start')
  );

  let success = 0;
  let errors = 0;
  let waiting = 0;

  try {
    let items =
      await getPendingSyncItems();

    /*
      Primeiro pela entidade.
      Depois pela data de criação.
    */
    items.sort((a, b) => {
      const priorityDifference =
        getSyncPriority(a.entity) -
        getSyncPriority(b.entity);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(a.createdAt) -
        new Date(b.createdAt)
      );
    });

    for (const item of items) {
      try {
        const result =
          await syncQueueItem(item);

        if (result?.waitingDependency) {
          waiting++;
        } else {
          success++;
        }

      } catch (error) {
        errors++;

        console.error(
          'Erro de sincronização:',
          item.entity,
          item.recordId,
          error
        );
      }
    }

    await setMeta(
      'lastSyncAttempt',
      new Date().toISOString()
    );

    if (
      errors === 0 &&
      waiting === 0
    ) {
      await setMeta(
        'lastSuccessfulSync',
        new Date().toISOString()
      );
    }

    return {
      ok:
        errors === 0 &&
        waiting === 0,

      success,
      errors,
      waiting
    };

  } finally {

    syncInProgress = false;

    window.dispatchEvent(
      new CustomEvent('sync-end')
    );
  }
}
/* =========================================================
   DOWNLOAD DOS REGISTROS DO SERVIDOR

   Baixa Produtores, Propriedades e Culturas
   do Google Sheets para o banco local.
========================================================= */

async function downloadServerRecords() {

  if (!navigator.onLine) {
    return {
      ok: false,
      reason: 'OFFLINE',
      imported: 0
    };
  }

  if (!apiIsConfigured()) {
    return {
      ok: false,
      reason: 'API_NAO_CONFIGURADA',
      imported: 0
    };
  }

  try {

    const result =
      await apiRequest(
        'getRecords'
      );

    const records =
      result.records || {};

    const imported =
      await importServerRecords(
        records
      );

    console.log(
      `${imported} registro(s) recebido(s) do servidor.`
    );

    return {
      ok: true,
      imported
    };

  } catch (error) {

    console.error(
      'Erro ao baixar registros do servidor:',
      error
    );

    return {
      ok: false,
      reason:
        error.message ||
        String(error),
      imported: 0
    };
  }
}
/* =========================================================
   SINCRONIZAÇÃO DOS CATÁLOGOS
========================================================= */

async function syncCatalogs() {
  if (!navigator.onLine) {
    throw new Error('OFFLINE');
  }

  if (!apiIsConfigured()) {
    throw new Error(
      'API_V2_NAO_CONFIGURADA'
    );
  }

  const result = await apiRequest(
    'getCatalogs'
  );

  const catalogs =
    result.catalogs || {};

  for (
    const storeName
    of APP_CONFIG.CATALOG_STORES
  ) {
    if (
      Array.isArray(
        catalogs[storeName]
      )
    ) {
      await replaceCatalog(
        storeName,
        catalogs[storeName]
      );
    }
  }

  await setMeta(
    'lastCatalogSync',
    new Date().toISOString()
  );

  return true;
}

/* =========================================================
   SINCRONIZAÇÃO AUTOMÁTICA

   Ao recuperar a conexão, tentamos enviar
   automaticamente os registros pendentes.
========================================================= */

window.addEventListener(
  'online',
  async () => {

    if (!APP_CONFIG.AUTO_SYNC) {
      return;
    }

    if (!apiIsConfigured()) {
      return;
    }

    try {
      await syncAll();

    } catch (error) {
      console.error(
        'Falha na sincronização automática.',
        error
      );
    }
  }
);
