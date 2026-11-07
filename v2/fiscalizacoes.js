/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: FISCALIZAÇÕES

   Fluxo:
   1. Escolher a propriedade (cadastrada no módulo Cadastros)
   2. Dados gerais da fiscalização (tipo, data, programa, GPS)
   3. Culturas inspecionadas
   4. Ocorrências de pragas
   5. Amostras
   6. Providências / Termos
   7. Evidências fotográficas
   8. Conclusão e resumo para impressão

   Tudo é salvo primeiro no aparelho (IndexedDB) e entra na
   fila de sincronização. Exclusões são lógicas
   (Excluido = 'SIM') para preservar o histórico.
========================================================= */

const FiscalizacoesModule = {

  current: null,
  property: null,
  producer: null,

  TIPOS_FISCALIZACAO: [
    ['ROTINA', 'Rotina'],
    ['PROGRAMA', 'Programa fitossanitário'],
    ['DENUNCIA', 'Atendimento a denúncia'],
    ['RETORNO', 'Retorno / verificação de providência'],
    ['EMERGENCIAL', 'Emergencial / foco'],
    ['TRANSITO', 'Trânsito de vegetais'],
    ['OUTRA', 'Outra']
  ],

  SITUACOES: [
    ['SEM_OCORRENCIA', 'Sem ocorrência de pragas'],
    ['SUSPEITA', 'Suspeita de praga (aguardando análise)'],
    ['COM_OCORRENCIA', 'Ocorrência de praga confirmada']
  ],

  NIVEIS: [
    ['BAIXO', 'Baixo'],
    ['MEDIO', 'Médio'],
    ['ALTO', 'Alto']
  ],

  PARTES: [
    'Folha', 'Fruto', 'Flor', 'Ramo', 'Caule / tronco',
    'Raiz', 'Planta inteira', 'Solo', 'Outra'
  ],

  MATERIAIS: [
    'Folha', 'Fruto', 'Ramo', 'Raiz', 'Caule', 'Solo',
    'Inseto / ácaro', 'Planta inteira', 'Semente', 'Outro'
  ],

  PROVIDENCIAS: [
    ['ORIENTACAO', 'Orientação técnica'],
    ['NOTIFICACAO', 'Notificação'],
    ['TERMO_FISCALIZACAO', 'Termo de Fiscalização'],
    ['TERMO_INTERDICAO', 'Termo de Interdição'],
    ['TERMO_DESTRUICAO', 'Termo de Destruição / Erradicação'],
    ['TERMO_APREENSAO', 'Termo de Apreensão'],
    ['AUTO_INFRACAO', 'Auto de Infração'],
    ['OUTRA', 'Outra']
  ],


  /* =======================================================
     UTILITÁRIOS
  ======================================================= */

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value ?? '').trim() : '';
  },

  num(id) {
    const v = this.val(id).replace(',', '.');
    return v === '' ? '' : Number(v);
  },

  options(list, selected = '', placeholder = 'Selecione') {
    const items = list.map(item => {
      const [value, label] =
        Array.isArray(item) ? item : [item, item];
      return `<option value="${this.esc(value)}" ${
        String(value) === String(selected) ? 'selected' : ''
      }>${this.esc(label)}</option>`;
    });
    return `<option value="">${placeholder}</option>${items.join('')}`;
  },

  label(list, value) {
    const found = list.find(item =>
      (Array.isArray(item) ? item[0] : item) === value
    );
    if (!found) return value || '—';
    return Array.isArray(found) ? found[1] : found;
  },

  today() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  },

  nowTime() {
    return new Date().toTimeString().slice(0, 5);
  },

  formatDate(value) {
    if (!value) return '—';
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    try {
      return new Date(s).toLocaleDateString('pt-BR');
    } catch {
      return s;
    }
  },

  active(list) {
    return list.filter(item => item.Excluido !== 'SIM');
  },

  syncBadge(record) {
    return record.syncStatus === 'SINCRONIZADO'
      ? '<span class="fz-pill fz-ok">Sincronizado</span>'
      : '<span class="fz-pill fz-wait">Pendente de envio</span>';
  },

  statusBadge(status) {
    const map = {
      RASCUNHO: ['Em andamento', 'fz-wait'],
      CONCLUIDA: ['Concluída', 'fz-ok'],
      CANCELADA: ['Cancelada', 'fz-bad']
    };
    const [text, cls] = map[status] || [status || '—', ''];
    return `<span class="fz-pill ${cls}">${this.esc(text)}</span>`;
  },

  isEditable() {
    return this.current && this.current.Status === 'RASCUNHO';
  },

  getFiscalName() {
    try {
      return localStorage.getItem('dv_fiscal_nome') || '';
    } catch {
      return '';
    }
  },

  setFiscalName(name) {
    try {
      localStorage.setItem('dv_fiscal_nome', name);
    } catch {
      /* armazenamento indisponível */
    }
  },

  municipalities() {
    if (
      typeof CadastrosModule !== 'undefined' &&
      typeof CadastrosModule.getAmazonasMunicipalities === 'function'
    ) {
      return CadastrosModule.getAmazonasMunicipalities();
    }
    return [];
  },

  cultureName(culture) {
    return (
      culture.Nome_Cultura_Local ||
      culture.Nome_Cultura ||
      culture.Cultura ||
      culture.ID_Tipo_Cultura ||
      'Cultura'
    );
  },

  async getChildren(store) {
    if (!this.current) return [];
    const all = await dbGetAll(store);
    return this.active(all)
      .filter(item => item.ID_Fiscalizacao_Local === this.current.id)
      .sort((a, b) =>
        String(a.localCreatedAt || '').localeCompare(String(b.localCreatedAt || ''))
      );
  },

  /*
    Salva um registro-filho da fiscalização.
    Sempre depende da fiscalização (registro-pai).
  */
  async saveChild(store, record, extraDeps = []) {
    const now = new Date().toISOString();
    const data = {
      ...record,
      ID_Fiscalizacao_Local: this.current.id,
      ID_Fiscalizacao: this.current.ID_Fiscalizacao || '',
      Data_Atualizacao: now
    };
    if (!data.Data_Cadastro) data.Data_Cadastro = now;

    const saved = await saveLocalRecord(store, data, {
      operation: record.id ? 'UPDATE' : 'CREATE',
      dependsOn: [
        { entity: 'fiscalizacoes', recordId: this.current.id },
        ...extraDeps
      ]
    });

    await App.updateSyncStatus();
    return saved;
  },

  async softDelete(store, id) {
    const record = await dbGet(store, id);
    if (!record) return;
    if (!confirm('Remover este item da fiscalização?')) return;
    record.Excluido = 'SIM';
    await this.saveChild(store, record);
    App.showMessage('Item removido.', 'success');
    await this.renderWorkspace();
  },

  /* =======================================================
     CATÁLOGO DE PRAGAS

     Usa a aba Cadastro_Pragas baixada da planilha.
     Os nomes de colunas são lidos de forma tolerante.
  ======================================================= */

  pestInfo(p) {
    return {
      id: String(p.ID_Praga || p.Codigo_Praga || p.id || ''),
      nome: String(
        p.Nome_Comum || p.Nome_Popular || p.Nome_Praga ||
        p.Praga || p.Nome || ''
      ),
      cientifico: String(
        p.Nome_Cientifico || p.Especie || p.Nome_Científico || ''
      ),
      categoria: String(
        p.Categoria || p.Status_Quarentenario || p.Classificacao || ''
      ),
      legislacao: String(p.Legislacao || p.Legislação || p.Base_Legal || '')
    };
  },

  async getPests() {
    const raw = await dbGetAll('cadastroPragas');
    return raw
      .map(p => this.pestInfo(p))
      .filter(p => p.nome || p.cientifico)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async getPrograms() {
    const raw = await dbGetAll('programasTecnicos');
    return raw
      .map(p => String(
        p.Nome_Programa || p.Programa || p.Nome || p.Descricao || ''
      ))
      .filter(Boolean);
  },


  /* =======================================================
     ABRIR MÓDULO / LISTA
  ======================================================= */

  async open() {
    this.current = null;
    this.property = null;
    this.producer = null;

    const main = document.querySelector('main');

    main.innerHTML = `
      <section class="module-page">
        <div class="module-header">
          <button type="button" class="btn btn-secondary" onclick="App.showHome()">← Voltar</button>
          <div>
            <h2>Fiscalizações</h2>
            <p>Registro de fiscalizações de campo, ocorrências de pragas, amostras, providências e evidências.</p>
          </div>
        </div>

        <div id="fzListControls">
        <div class="module-actions">
          <button type="button" class="action-card" onclick="FiscalizacoesModule.startNew()">
            <span class="action-icon">➕</span>
            <span><strong>Nova fiscalização</strong><small>Escolher a propriedade e iniciar</small></span>
          </button>
          <button type="button" class="action-card" onclick="FiscalizacoesModule.refreshCatalogs()">
            <span class="action-icon">🐛</span>
            <span><strong>Atualizar catálogo de pragas</strong><small id="fzCatalogInfo">Verificando...</small></span>
          </button>
        </div>

        <div class="search-row">
          <input id="fzSearch" type="search" placeholder="Pesquisar por propriedade, produtor, município ou número">
          <select id="fzStatusFilter" class="fz-select">
            <option value="">Todas</option>
            <option value="RASCUNHO">Em andamento</option>
            <option value="CONCLUIDA">Concluídas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>

        <div id="fzList" class="search-results"><p>Carregando...</p></div>
        </div>
        <div id="fzWorkspace" class="workspace"></div>
      </section>
    `;

    document.getElementById('fzSearch').oninput = () => this.renderList();
    document.getElementById('fzStatusFilter').onchange = () => this.renderList();

    await this.updateCatalogInfo();
    await this.renderList();
  },

  async updateCatalogInfo() {
    const el = document.getElementById('fzCatalogInfo');
    if (!el) return;
    const pests = await dbGetAll('cadastroPragas');
    const last = await getMeta('lastCatalogSync');
    el.textContent = pests.length
      ? `${pests.length} praga(s) no aparelho${last ? ' • ' + App.formatDateTime(last) : ''}`
      : 'Nenhuma praga baixada ainda';
  },

  async refreshCatalogs() {
    if (!navigator.onLine) {
      App.showMessage('Sem internet. Use o catálogo já salvo no aparelho.', 'warning');
      return;
    }
    try {
      await syncCatalogs();
      App.showMessage('Catálogos atualizados.', 'success');
    } catch (error) {
      console.error(error);
      App.showMessage('Não foi possível atualizar os catálogos.', 'error');
    }
    await this.updateCatalogInfo();
  },

  async renderList() {
    const container = document.getElementById('fzList');
    if (!container) return;

    const query = this.val('fzSearch').toLowerCase();
    const status = this.val('fzStatusFilter');

    const list = this.active(await dbGetAll('fiscalizacoes'))
      .filter(f => !status || f.Status === status)
      .filter(f => {
        if (!query) return true;
        return [
          f.Numero_Fiscalizacao, f.Nome_Propriedade_Local,
          f.Nome_Produtor_Local, f.Municipio, f.Tipo_Fiscalizacao
        ].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (a.Status === 'RASCUNHO' && b.Status !== 'RASCUNHO') return -1;
        if (b.Status === 'RASCUNHO' && a.Status !== 'RASCUNHO') return 1;
        return String(b.Data_Fiscalizacao || b.localCreatedAt)
          .localeCompare(String(a.Data_Fiscalizacao || a.localCreatedAt));
      });

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          ${query || status
            ? 'Nenhuma fiscalização encontrada com esse filtro.'
            : 'Nenhuma fiscalização registrada neste aparelho. Toque em “Nova fiscalização” para começar.'}
        </div>`;
      return;
    }

    container.innerHTML = list.map(f => `
      <button type="button" class="result-card" onclick="FiscalizacoesModule.openInspection('${this.esc(f.id)}')">
        <strong>${this.esc(f.Nome_Propriedade_Local || 'Propriedade')} ${this.statusBadge(f.Status)}</strong>
        <span>${this.esc(f.Nome_Produtor_Local || '')} • ${this.esc(f.Municipio || '')}</span>
        <small>
          ${this.esc(f.Numero_Fiscalizacao || '')} •
          ${this.formatDate(f.Data_Fiscalizacao)} •
          ${this.esc(this.label(this.TIPOS_FISCALIZACAO, f.Tipo_Fiscalizacao))} •
          ${f.syncStatus === 'SINCRONIZADO' ? 'sincronizada' : 'pendente de envio'}
        </small>
      </button>
    `).join('');
  },


  /* =======================================================
     NOVA FISCALIZAÇÃO — ESCOLHA DA PROPRIEDADE
  ======================================================= */

  showListControls(show) {
    const el = document.getElementById('fzListControls');
    if (el) el.hidden = !show;
  },

  async startNew() {
    this.current = null;
    this.showListControls(false);
    document.getElementById('fzList').innerHTML = '';
    const ws = document.getElementById('fzWorkspace');

    ws.innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>Nova fiscalização</h3>
            <p>Escolha a propriedade fiscalizada. Se ela ainda não existir, cadastre-a primeiro em Cadastros.</p>
          </div>
          <span class="step-badge">Etapa 1 de 2</span>
        </div>

        <div class="search-row">
          <input id="fzPropSearch" type="search" placeholder="Nome da propriedade, produtor, CPF/CNPJ ou município">
        </div>
        <div id="fzPropResults" class="search-results"></div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.open()">Cancelar</button>
          <button type="button" class="btn btn-secondary" onclick="CadastrosModule.open()">Ir para Cadastros</button>
        </div>
      </div>
    `;

    const input = document.getElementById('fzPropSearch');
    input.oninput = () => this.renderPropertyResults();
    input.focus();
    await this.renderPropertyResults();
  },

  async renderPropertyResults() {
    const container = document.getElementById('fzPropResults');
    if (!container) return;

    const query = this.val('fzPropSearch').toLowerCase();
    const digits = query.replace(/\D/g, '');

    const producers = await dbGetAll('produtores');
    const byId = new Map(producers.map(p => [p.id, p]));

    const properties = (await dbGetAll('propriedades'))
      .filter(p => p.Status !== 'INATIVO')
      .map(p => ({ property: p, producer: byId.get(p.ID_Produtor_Local) || null }))
      .filter(({ property, producer }) => {
        if (!query) return true;
        const text = [
          property.Nome_Propriedade, property.Municipio,
          property.Comunidade_Localidade, producer?.Nome_Razao_Social
        ].join(' ').toLowerCase();
        const doc = String(producer?.CPF_CNPJ || '').replace(/\D/g, '');
        return text.includes(query) || (digits.length >= 3 && doc.includes(digits));
      })
      .slice(0, 30);

    if (!properties.length) {
      container.innerHTML = `<div class="empty-state">Nenhuma propriedade encontrada neste aparelho.</div>`;
      return;
    }

    container.innerHTML = properties.map(({ property, producer }) => `
      <button type="button" class="result-card" onclick="FiscalizacoesModule.showGeneralForm(null, '${this.esc(property.id)}')">
        <strong>${this.esc(property.Nome_Propriedade || 'Propriedade sem nome')}</strong>
        <span>${this.esc(producer?.Nome_Razao_Social || 'Produtor não encontrado')}</span>
        <small>${this.esc(property.Comunidade_Localidade || '')} ${property.Comunidade_Localidade ? '•' : ''} ${this.esc(property.Municipio || '')}</small>
      </button>
    `).join('');
  },


  /* =======================================================
     DADOS GERAIS
  ======================================================= */

  async showGeneralForm(existing = null, propertyId = null) {
    const f = existing || {};
    const pid = existing ? existing.ID_Propriedade_Local : propertyId;

    this.property = await dbGet('propriedades', pid);
    this.producer = this.property
      ? await dbGet('produtores', this.property.ID_Produtor_Local)
      : null;

    if (!this.property) {
      App.showMessage('Propriedade não encontrada neste aparelho.', 'error');
      return;
    }

    const programs = await this.getPrograms();
    this.showListControls(false);
    const ws = document.getElementById('fzWorkspace');
    document.getElementById('fzList').innerHTML = '';

    ws.innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>${existing ? 'Editar dados gerais' : 'Dados gerais da fiscalização'}</h3>
            <p><strong>${this.esc(this.property.Nome_Propriedade)}</strong> • ${this.esc(this.producer?.Nome_Razao_Social || '')} • ${this.esc(this.property.Municipio || '')}</p>
          </div>
          <span class="step-badge">${existing ? 'Edição' : 'Etapa 2 de 2'}</span>
        </div>

        <form id="fzGeneralForm">
          <div class="form-grid">
            <div class="field">
              <label for="fzData">Data *</label>
              <input id="fzData" type="date" required value="${this.esc(f.Data_Fiscalizacao || this.today())}">
            </div>
            <div class="field">
              <label for="fzHora">Hora de início</label>
              <input id="fzHora" type="time" value="${this.esc(f.Hora_Inicio || this.nowTime())}">
            </div>

            <div class="field">
              <label for="fzTipo">Tipo de fiscalização *</label>
              <select id="fzTipo" required>${this.options(this.TIPOS_FISCALIZACAO, f.Tipo_Fiscalizacao)}</select>
            </div>
            <div class="field">
              <label for="fzPrograma">Programa / ação</label>
              <input id="fzPrograma" list="fzProgramList" value="${this.esc(f.Programa_Tecnico || '')}" placeholder="Ex.: Mosca-da-Carambola, Cancro cítrico">
              <datalist id="fzProgramList">${programs.map(p => `<option value="${this.esc(p)}">`).join('')}</datalist>
            </div>

            <div class="field field-wide">
              <label for="fzObjetivo">Objetivo / motivo</label>
              <input id="fzObjetivo" maxlength="300" value="${this.esc(f.Objetivo || '')}">
            </div>

            <div class="field">
              <label for="fzResponsavel">Responsável presente na propriedade</label>
              <input id="fzResponsavel" maxlength="150" value="${this.esc(f.Responsavel_Presente ?? this.producer?.Nome_Razao_Social ?? '')}">
            </div>
            <div class="field">
              <label for="fzVinculo">Vínculo com a propriedade</label>
              <select id="fzVinculo">${this.options(['Proprietário', 'Arrendatário', 'Gerente / encarregado', 'Familiar', 'Funcionário', 'Outro'], f.Vinculo_Responsavel)}</select>
            </div>

            <div class="field field-wide">
              <label for="fzFiscal">Fiscal(is) responsável(is) *</label>
              <input id="fzFiscal" required maxlength="200" value="${this.esc(f.Fiscal_Responsavel || this.getFiscalName())}" placeholder="Nome do(s) fiscal(is) estadual(is) agropecuário(s)">
              <small>O nome fica salvo neste aparelho para as próximas fiscalizações.</small>
            </div>

            <div class="field">
              <label for="fzLat">Latitude</label>
              <input id="fzLat" inputmode="decimal" value="${this.esc(f.Latitude ?? '')}">
            </div>
            <div class="field">
              <label for="fzLng">Longitude</label>
              <input id="fzLng" inputmode="decimal" value="${this.esc(f.Longitude ?? '')}">
            </div>
            <div class="field field-wide">
              <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.captureGPS('fzLat','fzLng','fzGpsStatus')">📍 Capturar localização atual</button>
              <small id="fzGpsStatus">${f.Precisao_GPS_m ? 'Precisão registrada: ' + this.esc(f.Precisao_GPS_m) + ' m' : 'Recomendado capturar no local da inspeção.'}</small>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="${existing ? `FiscalizacoesModule.openInspection('${this.esc(existing.id)}')` : 'FiscalizacoesModule.startNew()'}">Voltar</button>
            <button type="submit" class="btn btn-primary">${existing ? 'Salvar alterações' : 'Iniciar fiscalização'}</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('fzGeneralForm').onsubmit = event => {
      event.preventDefault();
      this.saveGeneral(existing);
    };
  },

  captureGPS(latId, lngId, statusId) {
    const status = document.getElementById(statusId);
    if (!navigator.geolocation) {
      App.showMessage('Localização não suportada neste dispositivo.', 'warning');
      return;
    }
    if (status) status.textContent = 'Obtendo coordenadas...';

    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById(latId).value = pos.coords.latitude.toFixed(6);
        document.getElementById(lngId).value = pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy);
        document.getElementById(latId).dataset.accuracy = acc;
        if (status) status.textContent = `Localização capturada • precisão aproximada: ${acc} m`;
      },
      err => {
        if (status) status.textContent = 'Não foi possível obter a localização: ' + err.message;
        App.showMessage('Não foi possível obter a localização.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  },

  generateNumber() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `FISC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${rand}`;
  },

  async saveGeneral(existing) {
    const fiscal = this.val('fzFiscal');
    if (!this.val('fzData') || !this.val('fzTipo') || !fiscal) {
      App.showMessage('Preencha data, tipo e fiscal responsável.', 'warning');
      return;
    }
    this.setFiscalName(fiscal);

    const lat = this.num('fzLat');
    const lng = this.num('fzLng');
    if ((lat !== '' && (isNaN(lat) || lat < -10 || lat > 3)) ||
        (lng !== '' && (isNaN(lng) || lng < -75 || lng > -56))) {
      if (!confirm('As coordenadas parecem estar fora do Amazonas. Salvar mesmo assim?')) return;
    }

    const now = new Date().toISOString();
    const accuracy = document.getElementById('fzLat').dataset.accuracy;

    const record = {
      ...(existing || {}),
      ID_Fiscalizacao: existing?.ID_Fiscalizacao || '',
      Numero_Fiscalizacao: existing?.Numero_Fiscalizacao || this.generateNumber(),

      ID_Propriedade_Local: this.property.id,
      ID_Propriedade: this.property.ID_Propriedade || '',
      ID_Produtor_Local: this.producer?.id || '',
      ID_Produtor: this.producer?.ID_Produtor || '',
      Nome_Propriedade_Local: this.property.Nome_Propriedade || '',
      Nome_Produtor_Local: this.producer?.Nome_Razao_Social || '',
      Municipio: this.property.Municipio || '',

      Data_Fiscalizacao: this.val('fzData'),
      Hora_Inicio: this.val('fzHora'),
      Tipo_Fiscalizacao: this.val('fzTipo'),
      Programa_Tecnico: this.val('fzPrograma'),
      Objetivo: this.val('fzObjetivo'),
      Responsavel_Presente: this.val('fzResponsavel'),
      Vinculo_Responsavel: this.val('fzVinculo'),
      Fiscal_Responsavel: fiscal,

      Latitude: lat,
      Longitude: lng,
      Precisao_GPS_m: accuracy ? Number(accuracy) : (existing?.Precisao_GPS_m || ''),

      Status: existing?.Status || 'RASCUNHO',
      Data_Cadastro: existing?.Data_Cadastro || now,
      Data_Atualizacao: now
    };

    const deps = [{ entity: 'propriedades', recordId: this.property.id }];
    if (this.producer) deps.push({ entity: 'produtores', recordId: this.producer.id });

    const saved = await saveLocalRecord('fiscalizacoes', record, {
      operation: existing ? 'UPDATE' : 'CREATE',
      dependsOn: deps
    });

    await App.updateSyncStatus();
    App.showMessage(existing ? 'Dados atualizados.' : 'Fiscalização iniciada.', 'success');
    await this.openInspection(saved.id);
  },


  /* =======================================================
     ÁREA DE TRABALHO DA FISCALIZAÇÃO
  ======================================================= */

  async openInspection(id) {
    this.current = await dbGet('fiscalizacoes', id);
    if (!this.current) {
      App.showMessage('Fiscalização não encontrada.', 'error');
      return;
    }
    this.property = await dbGet('propriedades', this.current.ID_Propriedade_Local);
    this.producer = this.property
      ? await dbGet('produtores', this.property.ID_Produtor_Local)
      : null;

    const list = document.getElementById('fzList');
    if (list) list.innerHTML = '';
    await this.renderWorkspace();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async renderWorkspace() {
    const ws = document.getElementById('fzWorkspace');
    if (!ws || !this.current) return;
    this.showListControls(false);

    this.current = await dbGet('fiscalizacoes', this.current.id);
    const f = this.current;
    const editable = this.isEditable();

    const [cults, occs, samples, actions, photos] = await Promise.all([
      this.getChildren('fiscalizacaoCulturas'),
      this.getChildren('ocorrenciasPragas'),
      this.getChildren('amostras'),
      this.getChildren('providencias'),
      this.getChildren('evidencias')
    ]);

    ws.innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>${this.esc(f.Nome_Propriedade_Local)} ${this.statusBadge(f.Status)}</h3>
            <p>${this.esc(f.Nome_Produtor_Local)} • ${this.esc(f.Municipio)} • ${this.esc(f.Numero_Fiscalizacao)}</p>
          </div>
          ${this.syncBadge(f)}
        </div>

        <div class="summary-grid">
          <div><small>Data</small><strong>${this.formatDate(f.Data_Fiscalizacao)} ${this.esc(f.Hora_Inicio || '')}</strong></div>
          <div><small>Tipo</small><strong>${this.esc(this.label(this.TIPOS_FISCALIZACAO, f.Tipo_Fiscalizacao))}</strong></div>
          <div><small>Programa</small><strong>${this.esc(f.Programa_Tecnico || '—')}</strong></div>
          <div><small>Fiscal</small><strong>${this.esc(f.Fiscal_Responsavel || '—')}</strong></div>
        </div>

        <div class="fz-toolbar">
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.open()">← Lista</button>
          ${editable ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.editGeneral()">✏️ Dados gerais</button>` : ''}
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.printSummary()">🖨️ Resumo / Termo</button>
          ${!editable && f.Status !== 'CANCELADA' ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.reopen()">Reabrir para edição</button>` : ''}
        </div>

        ${this.sectionCultures(cults, editable)}
        ${this.sectionOccurrences(occs, cults, editable)}
        ${this.sectionSamples(samples, occs, editable)}
        ${this.sectionActions(actions, editable)}
        ${this.sectionPhotos(photos, occs, editable)}
        ${this.sectionConclusion(f, occs, editable)}
      </div>
    `;

    this.bindWorkspace();
  },

  editGeneral() {
    this.showGeneralForm(this.current);
  },

  sectionHeader(title, count, formToggle, editable) {
    return `
      <div class="fz-section-header">
        <h4>${title} <span class="fz-count">${count}</span></h4>
        ${editable && formToggle ? `<button type="button" class="btn btn-secondary fz-small" onclick="FiscalizacoesModule.toggle('${formToggle}')">+ Adicionar</button>` : ''}
      </div>`;
  },

  toggle(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !el.hidden;
    if (!el.hidden) {
      const first = el.querySelector('input, select, textarea');
      if (first) first.focus();
    }
  },

  removeButton(store, id, editable) {
    return editable
      ? `<button type="button" class="fz-link-danger" onclick="FiscalizacoesModule.softDelete('${store}','${this.esc(id)}')">Remover</button>`
      : '';
  },


  /* ---------- CULTURAS INSPECIONADAS ---------- */

  sectionCultures(cults, editable) {
    return `
      <section class="subsection">
        ${this.sectionHeader('🌱 Culturas inspecionadas', cults.length, 'fzCultForm', editable)}
        <form id="fzCultForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field field-wide">
              <label for="fzCultSel">Cultura da propriedade *</label>
              <select id="fzCultSel" required><option value="">Carregando...</option></select>
              <small>Culturas cadastradas na propriedade. Para incluir outra, cadastre-a em Cadastros.</small>
            </div>
            <div class="field">
              <label for="fzCultArea">Área inspecionada (ha)</label>
              <input id="fzCultArea" inputmode="decimal">
            </div>
            <div class="field">
              <label for="fzCultPlantas">Nº de plantas inspecionadas</label>
              <input id="fzCultPlantas" type="number" min="0">
            </div>
            <div class="field">
              <label for="fzCultFase">Estádio fenológico</label>
              <select id="fzCultFase">${this.options(['Vegetativo', 'Floração', 'Frutificação', 'Maturação / colheita', 'Pós-colheita', 'Muda / viveiro', 'Repouso'])}</select>
            </div>
            <div class="field">
              <label for="fzCultObs">Observações</label>
              <input id="fzCultObs" maxlength="300">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzCultForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Adicionar cultura</button>
          </div>
        </form>
        ${cults.length ? cults.map(c => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(c.Nome_Cultura_Local)}</strong>
              <span>${[
                c.Area_Inspecionada_ha !== '' && c.Area_Inspecionada_ha != null ? c.Area_Inspecionada_ha + ' ha' : '',
                c.Plantas_Inspecionadas ? c.Plantas_Inspecionadas + ' plantas' : '',
                c.Estadio_Fenologico, c.Observacoes
              ].filter(Boolean).map(v => this.esc(v)).join(' • ') || 'Sem detalhes'}</span>
            </div>
            ${this.removeButton('fiscalizacaoCulturas', c.id, editable)}
          </div>`).join('') : `<div class="empty-state">Nenhuma cultura inspecionada registrada.</div>`}
      </section>`;
  },

  async fillCultureSelect() {
    const select = document.getElementById('fzCultSel');
    if (!select || !this.property) return;
    const all = await dbGetAll('culturas');
    const used = new Set(
      (await this.getChildren('fiscalizacaoCulturas')).map(c => c.ID_Cultura_Local)
    );
    const list = all.filter(c =>
      c.ID_Propriedade_Local === this.property.id &&
      c.Status !== 'INATIVO' &&
      !used.has(c.id)
    );
    select.innerHTML = list.length
      ? `<option value="">Selecione</option>` + list.map(c =>
          `<option value="${this.esc(c.id)}">${this.esc(this.cultureName(c))}${c.Cultivar_Variedade ? ' — ' + this.esc(c.Cultivar_Variedade) : ''}</option>`
        ).join('')
      : `<option value="">Nenhuma cultura disponível nesta propriedade</option>`;
  },

  async saveCulture() {
    const cultId = this.val('fzCultSel');
    if (!cultId) {
      App.showMessage('Selecione a cultura.', 'warning');
      return;
    }
    const culture = await dbGet('culturas', cultId);
    await this.saveChild('fiscalizacaoCulturas', {
      ID_Cultura_Local: culture.id,
      ID_Cultura: culture.ID_Cultura || '',
      ID_Tipo_Cultura: culture.ID_Tipo_Cultura || '',
      Nome_Cultura_Local: this.cultureName(culture),
      Area_Inspecionada_ha: this.num('fzCultArea'),
      Plantas_Inspecionadas: this.num('fzCultPlantas'),
      Estadio_Fenologico: this.val('fzCultFase'),
      Observacoes: this.val('fzCultObs')
    }, [{ entity: 'culturas', recordId: culture.id }]);
    App.showMessage('Cultura adicionada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- OCORRÊNCIAS DE PRAGAS ---------- */

  sectionOccurrences(occs, cults, editable) {
    return `
      <section class="subsection">
        ${this.sectionHeader('🐛 Ocorrências de pragas', occs.length, 'fzOccForm', editable)}
        <form id="fzOccForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field field-wide">
              <label for="fzOccPraga">Praga *</label>
              <input id="fzOccPraga" list="fzPestList" required autocomplete="off" placeholder="Digite o nome comum ou científico">
              <datalist id="fzPestList"></datalist>
              <small id="fzPestInfo">Selecione do catálogo ou digite um nome novo (praga não catalogada).</small>
            </div>
            <div class="field">
              <label for="fzOccCult">Cultura afetada</label>
              <select id="fzOccCult">${this.options(cults.map(c => [c.id, c.Nome_Cultura_Local]), '', 'Não se aplica')}</select>
            </div>
            <div class="field">
              <label for="fzOccTipo">Situação *</label>
              <select id="fzOccTipo" required>${this.options([['SUSPEITA', 'Suspeita (sintomas)'], ['CONFIRMADA', 'Confirmada em campo']], 'SUSPEITA')}</select>
            </div>
            <div class="field">
              <label for="fzOccNivel">Nível de infestação</label>
              <select id="fzOccNivel">${this.options(this.NIVEIS)}</select>
            </div>
            <div class="field">
              <label for="fzOccParte">Parte afetada</label>
              <select id="fzOccParte">${this.options(this.PARTES)}</select>
            </div>
            <div class="field">
              <label for="fzOccAfetadas">Plantas afetadas</label>
              <input id="fzOccAfetadas" type="number" min="0">
            </div>
            <div class="field">
              <label for="fzOccIncid">Incidência estimada (%)</label>
              <input id="fzOccIncid" type="number" min="0" max="100" step="0.1">
            </div>
            <div class="field">
              <label for="fzOccLat">Latitude do foco</label>
              <input id="fzOccLat" inputmode="decimal">
            </div>
            <div class="field">
              <label for="fzOccLng">Longitude do foco</label>
              <input id="fzOccLng" inputmode="decimal">
            </div>
            <div class="field field-wide">
              <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.captureGPS('fzOccLat','fzOccLng','fzOccGps')">📍 Capturar ponto do foco</button>
              <small id="fzOccGps"></small>
            </div>
            <div class="field field-wide">
              <label for="fzOccObs">Sintomas / observações</label>
              <textarea id="fzOccObs" rows="3" maxlength="1000"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzOccForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar ocorrência</button>
          </div>
        </form>
        ${occs.length ? occs.map(o => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(o.Nome_Praga)} ${o.Nome_Cientifico ? `<em>(${this.esc(o.Nome_Cientifico)})</em>` : ''}
                <span class="fz-pill ${o.Tipo_Ocorrencia === 'CONFIRMADA' ? 'fz-bad' : 'fz-wait'}">${o.Tipo_Ocorrencia === 'CONFIRMADA' ? 'Confirmada' : 'Suspeita'}</span></strong>
              <span>${[
                o.Nome_Cultura_Local,
                o.Nivel_Infestacao ? 'Nível ' + this.label(this.NIVEIS, o.Nivel_Infestacao).toLowerCase() : '',
                o.Parte_Afetada,
                o.Incidencia_Percentual !== '' && o.Incidencia_Percentual != null ? o.Incidencia_Percentual + '% de incidência' : '',
                o.Plantas_Afetadas ? o.Plantas_Afetadas + ' plantas afetadas' : ''
              ].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
              ${o.Legislacao ? `<span class="fz-legal">⚖️ ${this.esc(o.Legislacao)}</span>` : ''}
              ${o.Observacoes ? `<span>${this.esc(o.Observacoes)}</span>` : ''}
            </div>
            ${this.removeButton('ocorrenciasPragas', o.id, editable)}
          </div>`).join('') : `<div class="empty-state">Nenhuma ocorrência registrada.</div>`}
      </section>`;
  },

  async fillPestList() {
    const list = document.getElementById('fzPestList');
    if (!list) return;
    this._pests = await this.getPests();
    list.innerHTML = this._pests.map(p =>
      `<option value="${this.esc(p.nome || p.cientifico)}">${this.esc(p.cientifico)}</option>`
    ).join('');

    const input = document.getElementById('fzOccPraga');
    const info = document.getElementById('fzPestInfo');
    input.oninput = () => {
      const pest = this.findPest(input.value);
      info.textContent = pest
        ? [pest.cientifico, pest.categoria, pest.legislacao].filter(Boolean).join(' • ') || 'Praga do catálogo.'
        : (this._pests.length
            ? 'Praga não catalogada: será registrada com o nome digitado.'
            : 'Catálogo de pragas ainda não baixado — o nome digitado será registrado.');
    };
  },

  findPest(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n || !this._pests) return null;
    return this._pests.find(p =>
      p.nome.toLowerCase() === n || p.cientifico.toLowerCase() === n
    ) || null;
  },

  async saveOccurrence() {
    const name = this.val('fzOccPraga');
    if (!name) {
      App.showMessage('Informe a praga.', 'warning');
      return;
    }
    const pest = this.findPest(name);
    const cultId = this.val('fzOccCult');
    const cult = cultId ? await dbGet('fiscalizacaoCulturas', cultId) : null;

    const extra = cult ? [{ entity: 'fiscalizacaoCulturas', recordId: cult.id }] : [];

    await this.saveChild('ocorrenciasPragas', {
      ID_Fiscalizacao_Cultura_Local: cult?.id || '',
      ID_Cultura_Local: cult?.ID_Cultura_Local || '',
      Nome_Cultura_Local: cult?.Nome_Cultura_Local || '',
      ID_Praga: pest?.id || '',
      Nome_Praga: pest ? (pest.nome || pest.cientifico) : name,
      Nome_Cientifico: pest?.cientifico || '',
      Praga_Catalogada: pest ? 'SIM' : 'NAO',
      Legislacao: pest?.legislacao || '',
      Tipo_Ocorrencia: this.val('fzOccTipo'),
      Nivel_Infestacao: this.val('fzOccNivel'),
      Parte_Afetada: this.val('fzOccParte'),
      Plantas_Afetadas: this.num('fzOccAfetadas'),
      Incidencia_Percentual: this.num('fzOccIncid'),
      Latitude: this.num('fzOccLat'),
      Longitude: this.num('fzOccLng'),
      Observacoes: this.val('fzOccObs')
    }, extra);

    App.showMessage('Ocorrência registrada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- AMOSTRAS ---------- */

  sectionSamples(samples, occs, editable) {
    return `
      <section class="subsection">
        ${this.sectionHeader('🧪 Amostras', samples.length, 'fzSampleForm', editable)}
        <form id="fzSampleForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field">
              <label for="fzSmpCod">Código da amostra *</label>
              <input id="fzSmpCod" required maxlength="60">
              <small>Gerado automaticamente; pode ser alterado para o código do lacre.</small>
            </div>
            <div class="field">
              <label for="fzSmpOcc">Ocorrência relacionada</label>
              <select id="fzSmpOcc">${this.options(occs.map(o => [o.id, o.Nome_Praga]), '', 'Nenhuma')}</select>
            </div>
            <div class="field">
              <label for="fzSmpMat">Material coletado *</label>
              <select id="fzSmpMat" required>${this.options(this.MATERIAIS)}</select>
            </div>
            <div class="field">
              <label for="fzSmpQtd">Quantidade</label>
              <div class="fz-row">
                <input id="fzSmpQtd" type="number" min="0" step="any">
                <select id="fzSmpUn" class="fz-select">${this.options(['unidade(s)', 'g', 'kg', 'frasco(s)', 'saco(s)'], 'unidade(s)', '—')}</select>
              </div>
            </div>
            <div class="field">
              <label for="fzSmpLab">Laboratório de destino</label>
              <input id="fzSmpLab" maxlength="150">
            </div>
            <div class="field">
              <label for="fzSmpAnalise">Análise solicitada</label>
              <input id="fzSmpAnalise" maxlength="150" placeholder="Ex.: identificação de praga, diagnose">
            </div>
            <div class="field field-wide">
              <label for="fzSmpObs">Observações</label>
              <input id="fzSmpObs" maxlength="500">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzSampleForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar amostra</button>
          </div>
        </form>
        ${samples.length ? samples.map(s => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(s.Codigo_Amostra)} — ${this.esc(s.Tipo_Material)}</strong>
              <span>${[
                s.Quantidade !== '' && s.Quantidade != null ? s.Quantidade + ' ' + (s.Unidade || '') : '',
                s.Nome_Praga_Relacionada, s.Laboratorio_Destino, s.Analise_Solicitada,
                s.Status_Amostra === 'COLETADA' ? 'Coletada' : s.Status_Amostra
              ].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
            </div>
            ${this.removeButton('amostras', s.id, editable)}
          </div>`).join('') : `<div class="empty-state">Nenhuma amostra coletada.</div>`}
      </section>`;
  },

  async saveSample() {
    if (!this.val('fzSmpCod') || !this.val('fzSmpMat')) {
      App.showMessage('Informe código e material.', 'warning');
      return;
    }
    const occId = this.val('fzSmpOcc');
    const occ = occId ? await dbGet('ocorrenciasPragas', occId) : null;
    await this.saveChild('amostras', {
      Codigo_Amostra: this.val('fzSmpCod'),
      ID_Ocorrencia_Local: occ?.id || '',
      Nome_Praga_Relacionada: occ?.Nome_Praga || '',
      Tipo_Material: this.val('fzSmpMat'),
      Quantidade: this.num('fzSmpQtd'),
      Unidade: this.val('fzSmpUn'),
      Laboratorio_Destino: this.val('fzSmpLab'),
      Analise_Solicitada: this.val('fzSmpAnalise'),
      Data_Coleta: this.current.Data_Fiscalizacao,
      Status_Amostra: 'COLETADA',
      Resultado: '',
      Observacoes: this.val('fzSmpObs')
    }, occ ? [{ entity: 'ocorrenciasPragas', recordId: occ.id }] : []);
    App.showMessage('Amostra registrada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- PROVIDÊNCIAS ---------- */

  sectionActions(actions, editable) {
    return `
      <section class="subsection">
        ${this.sectionHeader('📄 Providências e termos', actions.length, 'fzActForm', editable)}
        <form id="fzActForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field">
              <label for="fzActTipo">Tipo *</label>
              <select id="fzActTipo" required>${this.options(this.PROVIDENCIAS)}</select>
            </div>
            <div class="field">
              <label for="fzActNum">Nº do documento / termo</label>
              <input id="fzActNum" maxlength="60">
            </div>
            <div class="field field-wide">
              <label for="fzActDesc">Descrição / medida determinada *</label>
              <textarea id="fzActDesc" rows="3" required maxlength="1500"></textarea>
            </div>
            <div class="field">
              <label for="fzActPrazo">Prazo para cumprimento</label>
              <input id="fzActPrazo" type="date">
            </div>
            <div class="field">
              <label for="fzActBase">Base legal</label>
              <input id="fzActBase" maxlength="300">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzActForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar providência</button>
          </div>
        </form>
        ${actions.length ? actions.map(a => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(this.label(this.PROVIDENCIAS, a.Tipo_Providencia))}${a.Numero_Documento ? ' nº ' + this.esc(a.Numero_Documento) : ''}</strong>
              <span>${this.esc(a.Descricao)}</span>
              <span>${[a.Prazo ? 'Prazo: ' + this.formatDate(a.Prazo) : '', a.Base_Legal].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
            </div>
            ${this.removeButton('providencias', a.id, editable)}
          </div>`).join('') : `<div class="empty-state">Nenhuma providência registrada.</div>`}
      </section>`;
  },

  async saveAction() {
    if (!this.val('fzActTipo') || !this.val('fzActDesc')) {
      App.showMessage('Informe tipo e descrição.', 'warning');
      return;
    }
    await this.saveChild('providencias', {
      Tipo_Providencia: this.val('fzActTipo'),
      Numero_Documento: this.val('fzActNum'),
      Descricao: this.val('fzActDesc'),
      Prazo: this.val('fzActPrazo'),
      Base_Legal: this.val('fzActBase'),
      Status_Providencia: 'PENDENTE'
    });
    App.showMessage('Providência registrada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- EVIDÊNCIAS FOTOGRÁFICAS ---------- */

  sectionPhotos(photos, occs, editable) {
    return `
      <section class="subsection">
        ${this.sectionHeader('📷 Evidências fotográficas', photos.length, 'fzPhotoForm', editable)}
        <form id="fzPhotoForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field field-wide">
              <label for="fzPhotoFile">Foto *</label>
              <input id="fzPhotoFile" type="file" accept="image/*" capture="environment" required>
              <small>A foto é reduzida no aparelho (máx. 1280 px) para economizar espaço e dados.</small>
            </div>
            <div class="field">
              <label for="fzPhotoOcc">Ocorrência relacionada</label>
              <select id="fzPhotoOcc">${this.options(occs.map(o => [o.id, o.Nome_Praga]), '', 'Nenhuma')}</select>
            </div>
            <div class="field">
              <label for="fzPhotoDesc">Legenda</label>
              <input id="fzPhotoDesc" maxlength="200">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzPhotoForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="fzPhotoBtn">Salvar foto</button>
          </div>
        </form>
        ${photos.length ? `<div class="fz-gallery">${photos.map(p => `
          <figure class="fz-photo">
            ${p.Foto ? `<img src="${this.esc(p.Foto)}" alt="${this.esc(p.Descricao || 'Evidência')}">`
              : p.Foto_URL ? `<a href="${this.esc(p.Foto_URL)}" target="_blank" rel="noopener" class="fz-photo-link">Ver foto no Drive</a>`
              : '<div class="fz-photo-link">Foto indisponível</div>'}
            <figcaption>
              ${this.esc(p.Descricao || 'Sem legenda')}
              ${p.Nome_Praga_Relacionada ? `<br><small>${this.esc(p.Nome_Praga_Relacionada)}</small>` : ''}
              ${this.removeButton('evidencias', p.id, editable)}
            </figcaption>
          </figure>`).join('')}</div>` : `<div class="empty-state">Nenhuma foto registrada.</div>`}
      </section>`;
  },

  compressImage(file, maxSize = 1280, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('IMAGEM_INVALIDA'));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  getPositionQuick() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  },

  async savePhoto() {
    const input = document.getElementById('fzPhotoFile');
    const file = input?.files?.[0];
    if (!file) {
      App.showMessage('Selecione ou tire uma foto.', 'warning');
      return;
    }
    const btn = document.getElementById('fzPhotoBtn');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
      const [dataUrl, coords] = await Promise.all([
        this.compressImage(file),
        this.getPositionQuick()
      ]);
      const occId = this.val('fzPhotoOcc');
      const occ = occId ? await dbGet('ocorrenciasPragas', occId) : null;

      await this.saveChild('evidencias', {
        ID_Ocorrencia_Local: occ?.id || '',
        Nome_Praga_Relacionada: occ?.Nome_Praga || '',
        Descricao: this.val('fzPhotoDesc'),
        Foto: dataUrl,
        Foto_URL: '',
        Nome_Arquivo: `${this.current.Numero_Fiscalizacao}_${Date.now()}.jpg`,
        Latitude: coords ? Number(coords.latitude.toFixed(6)) : '',
        Longitude: coords ? Number(coords.longitude.toFixed(6)) : '',
        Data_Hora: new Date().toISOString()
      }, occ ? [{ entity: 'ocorrenciasPragas', recordId: occ.id }] : []);

      App.showMessage('Foto salva.', 'success');
      await this.renderWorkspace();
    } catch (error) {
      console.error(error);
      App.showMessage('Não foi possível processar a foto.', 'error');
      btn.disabled = false;
      btn.textContent = 'Salvar foto';
    }
  },


  /* ---------- CONCLUSÃO ---------- */

  suggestSituation(occs) {
    if (occs.some(o => o.Tipo_Ocorrencia === 'CONFIRMADA')) return 'COM_OCORRENCIA';
    if (occs.length) return 'SUSPEITA';
    return 'SEM_OCORRENCIA';
  },

  sectionConclusion(f, occs, editable) {
    if (!editable) {
      return `
        <section class="subsection">
          <div class="fz-section-header"><h4>✅ Conclusão</h4></div>
          <div class="mini-card">
            <strong>${this.esc(this.label(this.SITUACOES, f.Situacao_Fitossanitaria))}</strong>
            <span>${this.esc(f.Observacoes || 'Sem observações.')}</span>
            <span>${f.Status === 'CANCELADA'
              ? 'Cancelada: ' + this.esc(f.Motivo_Cancelamento || '')
              : 'Concluída em ' + (f.Data_Conclusao ? App.formatDateTime(f.Data_Conclusao) : '—')}</span>
          </div>
        </section>`;
    }

    const suggested = f.Situacao_Fitossanitaria || this.suggestSituation(occs);

    return `
      <section class="subsection">
        <div class="fz-section-header"><h4>✅ Conclusão</h4></div>
        <form id="fzConclForm" class="fz-inline-form">
          <div class="form-grid">
            <div class="field field-wide">
              <label for="fzSituacao">Situação fitossanitária *</label>
              <select id="fzSituacao" required>${this.options(this.SITUACOES, suggested)}</select>
              <small>Sugerida a partir das ocorrências registradas.</small>
            </div>
            <div class="field field-wide">
              <label for="fzObs">Observações finais / relato da fiscalização</label>
              <textarea id="fzObs" rows="4" maxlength="4000">${this.esc(f.Observacoes || '')}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary fz-danger" onclick="FiscalizacoesModule.cancelInspection()">Cancelar fiscalização</button>
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.saveConclusion(false)">Salvar rascunho</button>
            <button type="submit" class="btn btn-primary">Concluir fiscalização</button>
          </div>
        </form>
      </section>`;
  },

  async saveConclusion(finish) {
    const situacao = this.val('fzSituacao');
    if (finish && !situacao) {
      App.showMessage('Informe a situação fitossanitária.', 'warning');
      return;
    }

    if (finish) {
      const cults = await this.getChildren('fiscalizacaoCulturas');
      const occs = await this.getChildren('ocorrenciasPragas');
      const problems = [];
      if (!cults.length) problems.push('nenhuma cultura inspecionada');
      if (situacao === 'SEM_OCORRENCIA' && occs.length) problems.push('há ocorrências registradas, mas a situação indica “sem ocorrência”');
      if (situacao !== 'SEM_OCORRENCIA' && !occs.length) problems.push('a situação indica praga, mas nenhuma ocorrência foi registrada');
      if (problems.length &&
          !confirm('Atenção:\n- ' + problems.join('\n- ') + '\n\nConcluir mesmo assim?')) {
        return;
      }
      if (!confirm('Concluir a fiscalização? Depois disso ela ficará somente para consulta (pode ser reaberta).')) return;
    }

    const now = new Date().toISOString();
    const record = {
      ...this.current,
      Situacao_Fitossanitaria: situacao,
      Observacoes: this.val('fzObs'),
      Data_Atualizacao: now
    };
    if (finish) {
      record.Status = 'CONCLUIDA';
      record.Hora_Fim = this.nowTime();
      record.Data_Conclusao = now;
    }

    await saveLocalRecord('fiscalizacoes', record, {
      operation: 'UPDATE',
      dependsOn: [{ entity: 'propriedades', recordId: record.ID_Propriedade_Local }]
    });
    await App.updateSyncStatus();
    App.showMessage(finish ? 'Fiscalização concluída.' : 'Rascunho salvo.', 'success');

    if (finish && navigator.onLine && apiIsConfigured()) {
      syncAll().catch(err => console.warn('Sincronização após conclusão falhou:', err));
    }
    await this.renderWorkspace();
  },

  async cancelInspection() {
    const reason = prompt('Motivo do cancelamento da fiscalização:');
    if (reason === null) return;
    if (!reason.trim()) {
      App.showMessage('Informe o motivo do cancelamento.', 'warning');
      return;
    }
    const now = new Date().toISOString();
    await saveLocalRecord('fiscalizacoes', {
      ...this.current,
      Status: 'CANCELADA',
      Motivo_Cancelamento: reason.trim(),
      Data_Atualizacao: now
    }, { operation: 'UPDATE' });
    await App.updateSyncStatus();
    App.showMessage('Fiscalização cancelada. O registro foi preservado.', 'success');
    await this.renderWorkspace();
  },

  async reopen() {
    if (!confirm('Reabrir esta fiscalização para edição?')) return;
    await saveLocalRecord('fiscalizacoes', {
      ...this.current,
      Status: 'RASCUNHO',
      Data_Atualizacao: new Date().toISOString()
    }, { operation: 'UPDATE' });
    await App.updateSyncStatus();
    await this.renderWorkspace();
  },


  /* =======================================================
     EVENTOS DA ÁREA DE TRABALHO
  ======================================================= */

  bindWorkspace() {
    const bind = (id, fn) => {
      const form = document.getElementById(id);
      if (!form) return;
      form.onsubmit = async event => {
        event.preventDefault();
        const submit = form.querySelector('[type=submit]');
        if (submit) submit.disabled = true;
        try {
          await fn();
        } catch (error) {
          console.error(error);
          App.showMessage('Não foi possível salvar. Tente novamente.', 'error');
          if (submit) submit.disabled = false;
        }
      };
    };

    bind('fzCultForm', () => this.saveCulture());
    bind('fzOccForm', () => this.saveOccurrence());
    bind('fzSampleForm', () => this.saveSample());
    bind('fzActForm', () => this.saveAction());
    bind('fzPhotoForm', () => this.savePhoto());
    bind('fzConclForm', () => this.saveConclusion(true));

    if (this.isEditable()) {
      this.fillCultureSelect();
      this.fillPestList();
      this.getChildren('amostras').then(list => {
        const el = document.getElementById('fzSmpCod');
        if (el) {
          const base = String(this.current.Numero_Fiscalizacao || '').replace('FISC-', 'AM-');
          el.value = `${base}-${String(list.length + 1).padStart(2, '0')}`;
        }
      });
    }
  },


  /* =======================================================
     RESUMO PARA IMPRESSÃO
  ======================================================= */

  async printSummary() {
    const f = this.current;
    const [cults, occs, samples, actions, photos] = await Promise.all([
      this.getChildren('fiscalizacaoCulturas'),
      this.getChildren('ocorrenciasPragas'),
      this.getChildren('amostras'),
      this.getChildren('providencias'),
      this.getChildren('evidencias')
    ]);
    const e = v => this.esc(v ?? '');
    const table = (headers, rows) => rows.length
      ? `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
          rows.map(r => `<tr>${r.map(c => `<td>${e(c)}</td>`).join('')}</tr>`).join('')
        }</tbody></table>`
      : '<p class="none">Nenhum registro.</p>';

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${e(f.Numero_Fiscalizacao)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
        h1{font-size:16px;margin:0}h2{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #176b3a;padding-bottom:8px}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
        th{background:#eef5f0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}.none{color:#666}
        .photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.photos img{width:100%;border:1px solid #ccc}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px;text-align:center}
        .sign div{border-top:1px solid #000;padding-top:4px}
        @media print{button{display:none}body{margin:10mm}}
      </style></head><body>
      <button onclick="print()" style="float:right;padding:8px 14px">Imprimir / salvar PDF</button>
      <div class="head"><div><h1>Relatório de Fiscalização Fitossanitária</h1>
        <div>Gerência de Defesa Vegetal — Estado do Amazonas</div></div>
        <div><strong>${e(f.Numero_Fiscalizacao)}</strong><br>${this.statusBadge(f.Status).replace(/<[^>]+>/g, '')}</div></div>

      <h2>Identificação</h2>
      <div class="grid">
        <div><b>Propriedade:</b> ${e(f.Nome_Propriedade_Local)}</div>
        <div><b>Produtor:</b> ${e(f.Nome_Produtor_Local)}</div>
        <div><b>Município:</b> ${e(f.Municipio)}</div>
        <div><b>Localidade:</b> ${e(this.property?.Comunidade_Localidade)}</div>
        <div><b>Data:</b> ${this.formatDate(f.Data_Fiscalizacao)} ${e(f.Hora_Inicio)}${f.Hora_Fim ? ' às ' + e(f.Hora_Fim) : ''}</div>
        <div><b>Tipo:</b> ${e(this.label(this.TIPOS_FISCALIZACAO, f.Tipo_Fiscalizacao))}</div>
        <div><b>Programa:</b> ${e(f.Programa_Tecnico || '—')}</div>
        <div><b>Coordenadas:</b> ${f.Latitude !== '' && f.Latitude != null ? e(f.Latitude) + ', ' + e(f.Longitude) : '—'}</div>
        <div><b>Responsável presente:</b> ${e(f.Responsavel_Presente)} ${f.Vinculo_Responsavel ? '(' + e(f.Vinculo_Responsavel) + ')' : ''}</div>
        <div><b>Fiscal(is):</b> ${e(f.Fiscal_Responsavel)}</div>
      </div>
      ${f.Objetivo ? `<p><b>Objetivo:</b> ${e(f.Objetivo)}</p>` : ''}

      <h2>Culturas inspecionadas</h2>
      ${table(['Cultura', 'Área (ha)', 'Plantas', 'Estádio', 'Obs.'],
        cults.map(c => [c.Nome_Cultura_Local, c.Area_Inspecionada_ha, c.Plantas_Inspecionadas, c.Estadio_Fenologico, c.Observacoes]))}

      <h2>Ocorrências de pragas</h2>
      ${table(['Praga', 'Cultura', 'Situação', 'Nível', 'Incidência', 'Parte', 'Obs.'],
        occs.map(o => [`${o.Nome_Praga}${o.Nome_Cientifico ? ' (' + o.Nome_Cientifico + ')' : ''}`, o.Nome_Cultura_Local,
          o.Tipo_Ocorrencia === 'CONFIRMADA' ? 'Confirmada' : 'Suspeita',
          this.label(this.NIVEIS, o.Nivel_Infestacao), o.Incidencia_Percentual !== '' && o.Incidencia_Percentual != null ? o.Incidencia_Percentual + '%' : '',
          o.Parte_Afetada, o.Observacoes]))}

      <h2>Amostras</h2>
      ${table(['Código', 'Material', 'Qtde.', 'Praga', 'Laboratório', 'Análise'],
        samples.map(s => [s.Codigo_Amostra, s.Tipo_Material, `${s.Quantidade ?? ''} ${s.Unidade || ''}`, s.Nome_Praga_Relacionada, s.Laboratorio_Destino, s.Analise_Solicitada]))}

      <h2>Providências e termos</h2>
      ${table(['Tipo', 'Nº', 'Descrição', 'Prazo', 'Base legal'],
        actions.map(a => [this.label(this.PROVIDENCIAS, a.Tipo_Providencia), a.Numero_Documento, a.Descricao, a.Prazo ? this.formatDate(a.Prazo) : '', a.Base_Legal]))}

      <h2>Conclusão</h2>
      <p><b>Situação fitossanitária:</b> ${e(this.label(this.SITUACOES, f.Situacao_Fitossanitaria))}</p>
      <p>${e(f.Observacoes || '')}</p>

      ${photos.some(p => p.Foto) ? `<h2>Evidências fotográficas</h2><div class="photos">${
        photos.filter(p => p.Foto).map(p => `<figure style="margin:0"><img src="${e(p.Foto)}"><figcaption>${e(p.Descricao)}</figcaption></figure>`).join('')
      }</div>` : ''}

      <div class="sign">
        <div>${e(f.Fiscal_Responsavel)}<br>Fiscal responsável</div>
        <div>${e(f.Responsavel_Presente)}<br>Responsável pela propriedade</div>
      </div>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      App.showMessage('Permita pop-ups para abrir o resumo.', 'warning');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
};
