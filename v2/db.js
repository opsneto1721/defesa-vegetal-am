const DB_NAME = 'DefesaVegetalAM_V2';
const DB_VERSION = 1;

const STORES = [
  'produtores',
  'propriedades',
  'culturas',
  'dadosCultura',

  'fiscalizacoes',
  'fiscalizacaoCulturas',
  'ocorrenciasPragas',
  'dadosFiscalizacao',
  'amostras',
  'providencias',
  'evidencias',

  'armadilhas',
  'monitoramentosArmadilhas',

  'viveiros',
  'especiesViveiro',
  'documentosViveiro',

  'documentos',
  'assinaturas',

  'servidores',

  'cadastroCulturas',
  'cadastroPragas',
  'programasTecnicos',
  'programaCultura',
  'pragaCultura',
  'camposDinamicos',
  'opcoesCampos',
  'campoCultura',
  'listasApoio',

  'syncQueue',
  'meta'
];

let dbPromise = null;

/* =========================================================
   ABERTURA DO BANCO
========================================================= */

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {
            keyPath: 'id'
          });
        }
      });
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('Atualização do banco local bloqueada por outra aba.');
    };
  });

  return dbPromise;
}

/* =========================================================
   UUID LOCAL
========================================================= */

function createUUID() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }
  );
}

/* =========================================================
   FUNÇÕES GENÉRICAS
========================================================= */

async function dbPut(storeName, record) {
  const db = await openDB();

  if (!STORES.includes(storeName)) {
    throw new Error(`Store inválida: ${storeName}`);
  }

  if (!record.id) {
    record.id = createUUID();
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    store.put(record);

    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');

    tx.objectStore(storeName).delete(id);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');

    tx.objectStore(storeName).clear();

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================================================
   SALVAMENTO OFFLINE-FIRST
========================================================= */

async function saveLocalRecord(storeName, data, options = {}) {
  const now = new Date().toISOString();

  const record = {
    ...data,
    id: data.id || createUUID(),

    localUpdatedAt: now,

    syncStatus:
      options.syncStatus ||
      data.syncStatus ||
      'PENDENTE'
  };

  if (!record.localCreatedAt) {
    record.localCreatedAt = now;
  }

  await dbPut(storeName, record);

  if (options.queue !== false) {
    await addToSyncQueue({
      entity: storeName,
      recordId: record.id,
      operation: options.operation || 'UPSERT',
      dependsOn: options.dependsOn || []
    });
  }

  return record;
}

/* =========================================================
   FILA DE SINCRONIZAÇÃO
========================================================= */

async function addToSyncQueue({
  entity,
  recordId,
  operation = 'UPSERT',
  dependsOn = []
}) {
  const queueItem = {
    id: createUUID(),

    entity,
    recordId,
    operation,

    dependsOn,

    status: 'PENDENTE',

    attempts: 0,

    createdAt: new Date().toISOString(),

    lastAttemptAt: null,
    lastError: null
  };

  await dbPut('syncQueue', queueItem);

  return queueItem;
}

async function getPendingSyncItems() {
  const items = await dbGetAll('syncQueue');

  return items
    .filter(item =>
      item.status === 'PENDENTE' ||
      item.status === 'ERRO'
    )
    .sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );
}

async function countPendingSyncItems() {
  const items = await getPendingSyncItems();
  return items.length;
}

async function markQueueItemSyncing(id) {
  const item = await dbGet('syncQueue', id);

  if (!item) return;

  item.status = 'SINCRONIZANDO';
  item.attempts = (item.attempts || 0) + 1;
  item.lastAttemptAt = new Date().toISOString();

  await dbPut('syncQueue', item);
}

async function markQueueItemError(id, error) {
  const item = await dbGet('syncQueue', id);

  if (!item) return;

  item.status = 'ERRO';
  item.lastError =
    error instanceof Error
      ? error.message
      : String(error);

  await dbPut('syncQueue', item);
}

async function removeQueueItem(id) {
  return dbDelete('syncQueue', id);
}

/* =========================================================
   STATUS DE SINCRONIZAÇÃO DO REGISTRO
========================================================= */

async function markRecordSynced(
  storeName,
  recordId,
  serverData = {}
) {
  const record = await dbGet(storeName, recordId);

  if (!record) return null;

  const updated = {
    ...record,
    ...serverData,

    // Nunca substituir o ID local usado pelo IndexedDB.
    id: record.id,

    syncStatus: 'SINCRONIZADO',
    syncedAt: new Date().toISOString()
  };

  await dbPut(storeName, updated);

  return updated;
}

/* =========================================================
   METADADOS LOCAIS
========================================================= */

async function setMeta(key, value) {
  return dbPut('meta', {
    id: key,
    value,
    updatedAt: new Date().toISOString()
  });
}

async function getMeta(key) {
  const item = await dbGet('meta', key);
  return item ? item.value : null;
}

/* =========================================================
   SUBSTITUIÇÃO DE CATÁLOGOS
========================================================= */

async function replaceCatalog(storeName, records) {
  if (!STORES.includes(storeName)) {
    throw new Error(`Store inválida: ${storeName}`);
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    store.clear();

    records.forEach(item => {
      store.put({
        ...item,
        id:
          item.id ||
          item.ID ||
          item.ID_Registro ||
          createUUID()
      });
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function initLocalDatabase() {
  await openDB();

  const firstRun = await getMeta('firstRun');

  if (!firstRun) {
    await setMeta(
      'firstRun',
      new Date().toISOString()
    );
  }

  console.log(
    'Defesa Vegetal AM V2 - banco local inicializado.'
  );

  return true;
}
