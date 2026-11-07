/* =========================================================
   DEFESA VEGETAL AM V2
   API GOOGLE APPS SCRIPT

   Versão 2.1
   - Mapeia as entidades do app para os nomes reais das abas
     (ex.: fiscalizacaoCulturas -> Fiscalizacao_Culturas)
   - Catálogos passam a ser lidos das abas corretas
     (ex.: cadastroPragas -> Cadastro_Pragas)
   - Fotos das evidências são gravadas no Google Drive;
     na planilha fica apenas o link
   - Trava (LockService) para evitar linhas duplicadas
     quando dois aparelhos sincronizam ao mesmo tempo
   - Somente entidades conhecidas podem ser gravadas
   - Token opcional (propriedade de script API_TOKEN)
========================================================= */

// ID da planilha central
const SPREADSHEET_ID =
  '1_cN9jQ-M8ADxw-mo7FlgkB6Tx_0DmKL9y3VTMZcHH0U';

// Nome da pasta do Drive para as fotos (usada se a
// propriedade de script DRIVE_FOLDER_ID não for definida)
const DRIVE_FOLDER_NAME =
  'Defesa Vegetal AM - Evidências Fotográficas';

// Limite de caracteres de uma célula do Google Sheets
const MAX_CELL_CHARS = 49000;


/* =========================================================
   ENTIDADES DO APP -> ABAS DA PLANILHA
========================================================= */

// Registros que o app pode gravar (syncRecord)
const ENTITY_SHEETS = {
  produtores: 'Produtores',
  propriedades: 'Propriedades',
  culturas: 'Culturas',
  dadosCultura: 'Dados_Cultura',

  fiscalizacoes: 'Fiscalizacoes',
  fiscalizacaoCulturas: 'Fiscalizacao_Culturas',
  ocorrenciasPragas: 'Ocorrencias_Pragas',
  dadosFiscalizacao: 'Dados_Fiscalizacao',
  amostras: 'Amostras',
  providencias: 'Providencias',
  evidencias: 'Evidencias_Fotograficas',

  armadilhas: 'Armadilhas',
  monitoramentosArmadilhas: 'Monitoramentos_Armadilhas',

  viveiros: 'Viveiros',
  especiesViveiro: 'Especies_Viveiro',
  documentosViveiro: 'Documentos_Viveiro',

  documentos: 'Documentos',
  assinaturas: 'Assinaturas'
};

// Catálogos (somente leitura pelo app)
const CATALOG_SHEETS = {
  cadastroCulturas: 'Cadastro_Culturas',
  cadastroPragas: 'Cadastro_Pragas',
  programasTecnicos: 'Programas_Tecnicos',
  programaCultura: 'Programa_Cultura',
  pragaCultura: 'Praga_Cultura',
  camposDinamicos: 'Campos_Dinamicos',
  opcoesCampos: 'Opcoes_Campos',
  campoCultura: 'Campo_Cultura',
  listasApoio: 'Listas_Apoio',
  servidores: 'Servidores'
};

// Registros enviados aos aparelhos (getRecords).
// As três primeiras chaves mantêm o formato anterior.
const DOWNLOAD_SHEETS = {
  Produtores: 'Produtores',
  Propriedades: 'Propriedades',
  Culturas: 'Culturas',

  fiscalizacoes: 'Fiscalizacoes',
  fiscalizacaoCulturas: 'Fiscalizacao_Culturas',
  ocorrenciasPragas: 'Ocorrencias_Pragas',
  amostras: 'Amostras',
  providencias: 'Providencias',
  evidencias: 'Evidencias_Fotograficas'
};


/* =========================================================
   ENTRADA DA API
========================================================= */

function doPost(e) {

  try {

    const data =
      JSON.parse(e.postData.contents || '{}');

    checkToken(data);

    const action = data.action;
    const payload = data.payload || {};

    let result;

    switch (action) {

      case 'syncRecord':
        result = syncRecord(payload);
        break;

      case 'getCatalogs':
        result = getCatalogs();
        break;

      case 'getRecords':
        result = getRecords(payload);
        break;

      case 'ping':
        result = {
          message: 'API Defesa Vegetal AM V2 online'
        };
        break;

      default:
        throw new Error(
          'AÇÃO_NÃO_RECONHECIDA: ' + action
        );
    }

    return jsonResponse({
      ok: true,
      ...result
    });

  } catch (error) {

    return jsonResponse({
      ok: false,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    });
  }
}


/* =========================================================
   TESTE PELO NAVEGADOR
========================================================= */

function doGet() {

  return jsonResponse({
    ok: true,
    app: 'Defesa Vegetal AM',
    api: 'V2.1',
    status: 'online',
    timestamp: new Date().toISOString()
  });
}


/* =========================================================
   TOKEN (OPCIONAL)

   Se a propriedade de script API_TOKEN existir, toda
   requisição precisa enviar o mesmo valor em "token".
========================================================= */

function checkToken(data) {

  const expected =
    PropertiesService
      .getScriptProperties()
      .getProperty('API_TOKEN');

  if (!expected) {
    return;
  }

  if (String(data.token || '') !== expected) {
    throw new Error('TOKEN_INVALIDO');
  }
}


/* =========================================================
   LOCALIZAR ABA

   Procura pelo nome oficial e, se não achar, compara os
   nomes ignorando maiúsculas, acentos e "_" — assim
   abas antigas como "produtores" continuam funcionando.
========================================================= */

function normalizeName(name) {

  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function findSheet(ss, sheetName, aliases) {

  const direct =
    ss.getSheetByName(sheetName);

  if (direct) {
    return direct;
  }

  const wanted =
    [sheetName]
      .concat(aliases || [])
      .map(normalizeName);

  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {

    if (
      wanted.indexOf(
        normalizeName(sheets[i].getName())
      ) !== -1
    ) {
      return sheets[i];
    }
  }

  return null;
}


/* =========================================================
   SINCRONIZAÇÃO DE REGISTRO
========================================================= */

function syncRecord(payload) {

  if (!payload.entity) {
    throw new Error('ENTIDADE_NÃO_INFORMADA');
  }

  if (!payload.record) {
    throw new Error('REGISTRO_NÃO_INFORMADO');
  }

  const entity = payload.entity;

  const sheetName =
    ENTITY_SHEETS[entity];

  if (!sheetName) {
    throw new Error(
      'ENTIDADE_NAO_PERMITIDA: ' + entity
    );
  }

  const operation =
    payload.operation || 'UPSERT';

  const record = payload.record;

  if (
    record.id === undefined ||
    record.id === null ||
    record.id === ''
  ) {
    throw new Error('REGISTRO_SEM_ID');
  }

  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );

    let sheet =
      findSheet(ss, sheetName, [entity]);

    /*
      Se a aba ainda não existir,
      ela será criada com o nome oficial.
    */
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const cleanRecord =
      prepareRecord(record);

    let headers =
      ensureHeaders(
        sheet,
        cleanRecord
      );

    const rowNumber =
      findExistingRow(
        sheet,
        headers,
        cleanRecord
      );

    if (operation === 'DELETE') {

      if (rowNumber) {
        sheet.deleteRow(rowNumber);
      }

      return {
        record: {
          id: record.id,
          syncStatus: 'SINCRONIZADO'
        }
      };
    }

    /*
      Fotos: grava no Drive e guarda só o link.
      Se a linha já tem link, a foto não é enviada de novo.
    */
    if (entity === 'evidencias') {
      handlePhoto(
        sheet,
        headers,
        rowNumber,
        cleanRecord
      );

      headers =
        ensureHeaders(sheet, cleanRecord);
    }

    const row =
      headers.map(header =>
        toCellValue(cleanRecord[header])
      );

    if (rowNumber) {

      /*
        Mantém o valor atual das colunas que o app
        não enviou (ex.: colunas preenchidas à mão
        na planilha).
      */
      const current =
        sheet
          .getRange(rowNumber, 1, 1, headers.length)
          .getValues()[0];

      headers.forEach((header, index) => {
        if (!(header in cleanRecord)) {
          row[index] = current[index];
        }
      });

      sheet
        .getRange(
          rowNumber,
          1,
          1,
          headers.length
        )
        .setValues([row]);

    } else {

      sheet.appendRow(row);
    }

    const response = {
      id: record.id,
      syncStatus: 'SINCRONIZADO',
      syncedAt: new Date().toISOString()
    };

    if (cleanRecord.Foto_URL) {
      response.Foto_URL = cleanRecord.Foto_URL;
    }

    return {
      record: response
    };

  } finally {

    lock.releaseLock();
  }
}


/* =========================================================
   VALOR DE CÉLULA
========================================================= */

function toCellValue(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }

  if (
    typeof value === 'string' &&
    value.length > MAX_CELL_CHARS
  ) {
    return value.slice(0, MAX_CELL_CHARS);
  }

  return value;
}


/* =========================================================
   FOTOS NO GOOGLE DRIVE
========================================================= */

function getPhotoFolder() {

  const folderId =
    PropertiesService
      .getScriptProperties()
      .getProperty('DRIVE_FOLDER_ID');

  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }

  const found =
    DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);

  if (found.hasNext()) {
    return found.next();
  }

  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function handlePhoto(
  sheet,
  headers,
  rowNumber,
  record
) {

  const photo =
    String(record.Foto || '');

  // A foto nunca vai para a célula
  record.Foto = '';

  // Já existe link na linha? Reaproveita.
  if (rowNumber) {

    const urlColumn =
      headers.indexOf('Foto_URL');

    if (urlColumn !== -1) {

      const existingUrl =
        sheet
          .getRange(rowNumber, urlColumn + 1)
          .getValue();

      if (existingUrl) {
        record.Foto_URL = existingUrl;
        return;
      }
    }
  }

  if (record.Foto_URL) {
    return;
  }

  const match =
    photo.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);

  if (!match) {
    return;
  }

  const blob =
    Utilities.newBlob(
      Utilities.base64Decode(match[2]),
      match[1],
      record.Nome_Arquivo ||
        ('evidencia_' + record.id + '.jpg')
    );

  const file =
    getPhotoFolder().createFile(blob);

  record.Foto_URL = file.getUrl();
  record.ID_Arquivo_Drive = file.getId();
}


/* =========================================================
   PREPARAÇÃO DO REGISTRO
========================================================= */

function prepareRecord(record) {

  const result = {};

  Object.keys(record).forEach(key => {

    /*
      syncStatus pertence ao controle
      local do aplicativo.
    */
    if (key === 'syncStatus') {
      return;
    }

    result[key] = record[key];
  });

  result._serverUpdatedAt =
    new Date().toISOString();

  return result;
}


/* =========================================================
   CABEÇALHOS DAS ABAS
========================================================= */

function ensureHeaders(
  sheet,
  record
) {

  const recordKeys =
    Object.keys(record);

  const lastColumn =
    sheet.getLastColumn();

  /*
    Aba completamente vazia.
  */
  if (lastColumn === 0) {

    sheet
      .getRange(1, 1, 1, recordKeys.length)
      .setValues([recordKeys])
      .setFontWeight('bold');

    sheet.setFrozenRows(1);

    return recordKeys;
  }

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0]
      .map(String);

  /*
    Campos novos viram colunas novas no final.
  */
  const missing =
    recordKeys.filter(key =>
      headers.indexOf(key) === -1
    );

  if (missing.length) {

    sheet
      .getRange(
        1,
        headers.length + 1,
        1,
        missing.length
      )
      .setValues([missing])
      .setFontWeight('bold');

    missing.forEach(key => headers.push(key));
  }

  return headers;
}


/* =========================================================
   LOCALIZAR REGISTRO EXISTENTE

   O ID local é mantido como chave estável.
========================================================= */

function findExistingRow(
  sheet,
  headers,
  record
) {

  const idColumn =
    headers.indexOf('id');

  if (idColumn === -1) {
    return null;
  }

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const target =
    String(record.id);

  const found =
    sheet
      .getRange(2, idColumn + 1, lastRow - 1, 1)
      .createTextFinder(target)
      .matchEntireCell(true)
      .findNext();

  return found ? found.getRow() : null;
}


/* =========================================================
   BAIXAR REGISTROS PARA OS DISPOSITIVOS
========================================================= */

function getRecords(payload) {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const records = {};

  Object.keys(DOWNLOAD_SHEETS).forEach(key => {

    const sheet =
      findSheet(ss, DOWNLOAD_SHEETS[key], [key]);

    const items =
      sheet ? sheetToObjects(sheet) : [];

    // Cadastros mantêm o comportamento anterior;
    // nas demais abas, só registros criados pelo app (têm id)
    records[key] =
      ['Produtores', 'Propriedades', 'Culturas'].indexOf(key) !== -1
        ? items
        : items.filter(item => item.id);
  });

  // A foto em base64 nunca é enviada de volta
  records.evidencias.forEach(item => {
    delete item.Foto;
  });

  return {
    records,
    serverTimestamp:
      new Date().toISOString()
  };
}


/* =========================================================
   CATÁLOGOS
========================================================= */

function getCatalogs() {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const catalogs = {};

  Object.keys(CATALOG_SHEETS).forEach(name => {

    const sheet =
      findSheet(ss, CATALOG_SHEETS[name], [name]);

    catalogs[name] =
      sheet
        ? sheetToObjects(sheet)
        : [];
  });

  return {
    catalogs
  };
}


/* =========================================================
   CONVERTER ABA EM OBJETOS
========================================================= */

function sheetToObjects(sheet) {

  const data =
    sheet.getDataRange().getValues();

  if (data.length < 2) {
    return [];
  }

  const headers =
    data[0].map(String);

  return data
    .slice(1)
    .filter(row =>
      row.some(value => value !== '')
    )
    .map(row => {

      const obj = {};

      headers.forEach((header, index) => {

        if (!header) {
          return;
        }

        let value = row[index];

        if (value instanceof Date) {
          value = value.toISOString();
        }

        obj[header] = value;
      });

      return obj;
    });
}


/* =========================================================
   RESPOSTA JSON
========================================================= */

function jsonResponse(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/* =========================================================
   TESTES (executar pelo editor do Apps Script)
========================================================= */

function testeGetRecords() {
  Logger.log(
    JSON.stringify(getRecords({}), null, 2)
  );
}

function testeCatalogos() {
  const result = getCatalogs();
  Object.keys(result.catalogs).forEach(name => {
    Logger.log(
      name + ': ' + result.catalogs[name].length + ' registro(s)'
    );
  });
}

/*
  Rode uma vez pelo editor para autorizar o acesso ao
  Google Drive (necessário para as fotos).
*/
function autorizarDrive() {
  Logger.log(
    'Pasta das fotos: ' + getPhotoFolder().getUrl()
  );
}
