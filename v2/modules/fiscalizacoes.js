/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: FISCALIZAÇÕES (Termo de Fiscalização)

   Tudo vinculado:
   Produtor → Propriedade → Cultura → Fiscalização → Termo

   - As culturas fiscalizadas vêm do cadastro da propriedade.
   - Os programas fitossanitários aplicáveis são calculados
     pelas culturas (aba Programa_Cultura).
   - As pragas a avaliar vêm da aba Praga_Cultura
     (por cultura e por programa).
   - Perguntas específicas vêm de Campos_Dinamicos
     (Contexto = FISCALIZACAO) → aba Dados_Fiscalizacao.
   - Ao concluir, é emitido o Termo de Fiscalização
     (aba Documentos) com as assinaturas (aba Assinaturas).
   - O fiscal é o servidor identificado (Auth).

   Os nomes dos campos seguem os cabeçalhos da planilha.
   Campos terminados em _Local são vínculos internos do app.
   Exclusões são lógicas (Excluido = 'SIM').
========================================================= */

const FiscalizacoesModule = {

  current: null,
  property: null,
  producer: null,
  cat: null,


  /* =======================================================
     LISTAS
  ======================================================= */

  TIPOS_ACAO: [
    ['PROGRAMA', 'Programa fitossanitário'],
    ['ROTINA', 'Fiscalização de rotina'],
    ['DENUNCIA', 'Atendimento a denúncia'],
    ['RETORNO', 'Retorno / verificação de providência'],
    ['EMERGENCIAL', 'Emergencial / foco'],
    ['OUTRA', 'Outra']
  ],

  RESULTADOS: [
    ['NAO_AVALIADA', 'Não avaliada'],
    ['NAO_DETECTADA', 'Não detectada'],
    ['SUSPEITA', 'Suspeita'],
    ['DETECTADA', 'Detectada']
  ],

  SITUACOES: [
    ['SEM_OCORRENCIA', 'Sem ocorrência de pragas'],
    ['SUSPEITA', 'Suspeita de praga (aguardando diagnóstico)'],
    ['COM_OCORRENCIA', 'Ocorrência de praga confirmada']
  ],

  NIVEIS: [['BAIXO', 'Baixo'], ['MEDIO', 'Médio'], ['ALTO', 'Alto']],

  DISTRIBUICAO: [
    ['ISOLADA', 'Planta(s) isolada(s)'],
    ['FOCO', 'Foco / reboleira'],
    ['GENERALIZADA', 'Generalizada na área']
  ],

  MATERIAIS: [
    'Folha', 'Fruto', 'Ramo', 'Raiz', 'Caule', 'Solo',
    'Inseto / ácaro', 'Planta inteira', 'Semente', 'Outro'
  ],

  PROVIDENCIAS: [
    ['ORIENTACAO', 'Orientação técnica'],
    ['NOTIFICACAO', 'Notificação'],
    ['TERMO_INTERDICAO', 'Termo de Interdição'],
    ['TERMO_DESTRUICAO', 'Termo de Destruição / Erradicação'],
    ['TERMO_APREENSAO', 'Termo de Apreensão'],
    ['AUTO_INFRACAO', 'Auto de Infração'],
    ['OUTRA', 'Outra']
  ],

  VINCULOS: [
    ['PROPRIETARIO', 'Proprietário'],
    ['PRODUTOR', 'Produtor / arrendatário'],
    ['RESPONSAVEL', 'Gerente / encarregado'],
    ['REPRESENTANTE', 'Representante / familiar'],
    ['OUTRO', 'Outro']
  ],


  /* =======================================================
     UTILITÁRIOS
  ======================================================= */

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // A planilha usa textos como "deixe vazio" como marcador
  clean(value) {
    const s = String(value ?? '').trim();
    return /^(deixe\s+)?vazio/i.test(s) ? '' : s;
  },

  yes(value) {
    const s = String(value ?? '').trim().toUpperCase();
    return s === '' || s === 'SIM' || s === 'ATIVO' || s === 'TRUE';
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
      const [value, label] = Array.isArray(item) ? item : [item, item];
      return `<option value="${this.esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${this.esc(label)}</option>`;
    });
    return (placeholder === null ? '' : `<option value="">${placeholder}</option>`) + items.join('');
  },

  label(list, value) {
    const found = list.find(item => (Array.isArray(item) ? item[0] : item) === value);
    if (!found) return value || '—';
    return Array.isArray(found) ? found[1] : found;
  },

  localNow() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  },

  formatDateTime(value) {
    if (!value) return '—';
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (m && !/Z$/.test(s)) {
      return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' ' + m[4] + ':' + m[5] : ''}`;
    }
    try {
      return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return s;
    }
  },

  formatDate(value) {
    return this.formatDateTime(value).split(' ')[0];
  },

  active(list) {
    return list.filter(item => item.Excluido !== 'SIM');
  },

  // Compatível com registros da versão anterior do módulo
  status(f) {
    if (!f) return '';
    if (f.Status_Fiscalizacao) return f.Status_Fiscalizacao;
    return { RASCUNHO: 'EM_ANDAMENTO', CONCLUIDA: 'FINALIZADA' }[f.Status] || f.Status || 'EM_ANDAMENTO';
  },

  statusBadge(f) {
    const map = {
      RASCUNHO: ['Rascunho', 'fz-wait'],
      EM_ANDAMENTO: ['Em andamento', 'fz-wait'],
      FINALIZADA: ['Finalizada', 'fz-ok'],
      CANCELADA: ['Cancelada', 'fz-bad']
    };
    const st = this.status(f);
    const [text, cls] = map[st] || [st, ''];
    return `<span class="fz-pill ${cls}">${this.esc(text)}</span>`;
  },

  syncBadge(record) {
    return record.syncStatus === 'SINCRONIZADO'
      ? '<span class="fz-pill fz-ok">Sincronizado</span>'
      : '<span class="fz-pill fz-wait">Pendente de envio</span>';
  },

  isEditable() {
    return this.current && this.status(this.current) === 'EM_ANDAMENTO';
  },

  // ID usado nos vínculos da planilha: oficial, se existir; senão o ID local
  refId(record, field) {
    return record ? (record[field] || record.id || '') : '';
  },

  fiscRef() {
    return this.current.ID_Fiscalizacao || this.current.id;
  },

  cultureName(culture) {
    if (!culture) return 'Cultura';
    const type = this.cat?.culturas.get(culture.ID_Tipo_Cultura);
    return culture.Nome_Cultura_Local || type?.nome || culture.ID_Tipo_Cultura || 'Cultura';
  },

  programLabel(p) {
    return p ? (p.sigla ? `${p.sigla} — ${p.nome}` : p.nome) : '';
  },

  async digest(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  },


  /* =======================================================
     CATÁLOGOS DA PLANILHA
  ======================================================= */

  async loadCatalogs() {
    const [tiposCultura, programas, progCult, pragas, pragaCult, campos, opcoes, campoCult] =
      await Promise.all([
        dbGetAll('cadastroCulturas'), dbGetAll('programasTecnicos'),
        dbGetAll('programaCultura'), dbGetAll('cadastroPragas'),
        dbGetAll('pragaCultura'), dbGetAll('camposDinamicos'),
        dbGetAll('opcoesCampos'), dbGetAll('campoCultura')
      ]);

    const culturas = new Map();
    tiposCultura.filter(c => this.yes(c.Ativo)).forEach(c => culturas.set(String(c.ID_Tipo_Cultura), {
      id: String(c.ID_Tipo_Cultura), nome: this.clean(c.Nome_Cultura), cientifico: this.clean(c.Nome_Cientifico)
    }));

    const progs = new Map();
    programas.filter(p => this.yes(p.Ativo) && p.ID_Programa).forEach(p => progs.set(String(p.ID_Programa), {
      id: String(p.ID_Programa),
      sigla: this.clean(p.Sigla_Programa),
      nome: this.clean(p.Nome_Programa) || this.clean(p.Descricao) || String(p.ID_Programa),
      legislacao: this.clean(p.Legislacao_Base)
    }));

    const pests = new Map();
    pragas.filter(p => p.ID_Praga && String(p.Status || 'ATIVO').toUpperCase() !== 'INATIVO').forEach(p => pests.set(String(p.ID_Praga), {
      id: String(p.ID_Praga),
      nome: this.clean(p.Nome_Comum) || this.clean(p.Nome_Cientifico) || String(p.ID_Praga),
      cientifico: this.clean(p.Nome_Cientifico),
      classificacao: this.clean(p.Classificacao_Fitossanitaria),
      legislacao: this.clean(p.Legislacao)
    }));

    this.cat = {
      culturas,
      programas: progs,
      pragas: pests,
      progCult: progCult.filter(r => this.yes(r.Ativo)).map(r => ({
        programa: String(r.ID_Programa), cultura: String(r.ID_Tipo_Cultura)
      })),
      pragaCult: pragaCult.filter(r => this.yes(r.Ativo) && r.ID_Praga).map(r => ({
        praga: String(r.ID_Praga), cultura: String(r.ID_Tipo_Cultura),
        programa: this.clean(r.ID_Programa), legislacao: this.clean(r.Legislacao_Especifica)
      })),
      campos: campos.filter(c => String(c.Contexto).toUpperCase() === 'FISCALIZACAO' && this.yes(c.Ativo)),
      opcoes: opcoes.filter(o => this.yes(o.Ativo)),
      campoCult: campoCult.filter(r => this.yes(r.Ativo))
    };

    return this.cat;
  },

  catalogIsEmpty() {
    return !this.cat || (!this.cat.programas.size && !this.cat.pragaCult.length);
  },

  /* Programas aplicáveis a um conjunto de tipos de cultura */
  programsForCultureTypes(typeIds) {
    const set = new Set(typeIds.map(String));
    const result = new Map();
    this.cat.progCult.forEach(r => {
      if (!set.has(r.cultura)) return;
      const p = this.cat.programas.get(r.programa);
      if (!p) return;
      if (!result.has(p.id)) result.set(p.id, { ...p, culturas: new Set() });
      result.get(p.id).culturas.add(r.cultura);
    });
    return [...result.values()].sort((a, b) => (a.sigla || a.nome).localeCompare(b.sigla || b.nome));
  },

  selectedPrograms() {
    return String(this.current?.ID_Programa || '').split(',').map(s => s.trim()).filter(Boolean);
  },

  /*
    Pragas de uma cultura:
    - doPrograma: vinculadas aos programas selecionados (avaliação esperada)
    - outras: demais pragas associadas à cultura
  */
  pestsForCulture(typeId, programIds) {
    const progSet = new Set(programIds);
    const byPest = new Map();

    this.cat.pragaCult
      .filter(r => r.cultura === String(typeId))
      .forEach(r => {
        const pest = this.cat.pragas.get(r.praga);
        if (!pest) return;
        const inProgram = r.programa && progSet.has(r.programa);
        const prev = byPest.get(pest.id);
        if (!prev || (inProgram && !prev.inProgram)) {
          byPest.set(pest.id, {
            ...pest,
            programa: inProgram ? r.programa : (prev?.programa || r.programa || ''),
            inProgram: inProgram || prev?.inProgram || false,
            legislacao: r.legislacao || pest.legislacao
          });
        }
      });

    const all = [...byPest.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return {
      doPrograma: all.filter(p => p.inProgram),
      outras: all.filter(p => !p.inProgram)
    };
  },

  /* Campos dinâmicos de fiscalização para uma cultura */
  fieldsForCulture(typeId, programIds) {
    const t = String(typeId);
    const linked = new Set(this.cat.campoCult.filter(r => String(r.ID_Tipo_Cultura) === t).map(r => String(r.ID_Campo)));
    return this.cat.campos
      .filter(c => {
        const ct = this.clean(c.ID_Tipo_Cultura);
        const cp = this.clean(c.ID_Programa);
        const cultureOk = ct ? ct === t : linked.has(String(c.ID_Campo));
        const programOk = !cp || programIds.includes(cp);
        return cultureOk && programOk;
      })
      .sort((a, b) => Number(a.Ordem || 0) - Number(b.Ordem || 0));
  },

  fieldOptions(campo) {
    const fromSheet = this.cat.opcoes
      .filter(o => String(o.ID_Campo) === String(campo.ID_Campo))
      .sort((a, b) => Number(a.Ordem || 0) - Number(b.Ordem || 0))
      .map(o => [String(o.Valor_Opcao), this.clean(o.Rotulo_Opcao) || String(o.Valor_Opcao)]);
    if (fromSheet.length) return fromSheet;
    const inline = this.clean(campo.Opcoes);
    if (inline) return inline.split(/[;|]/).map(s => s.trim()).filter(Boolean).map(s => [s, s]);
    return [];
  },


  /* =======================================================
     REGISTROS-FILHOS
  ======================================================= */

  async getChildren(store) {
    if (!this.current) return [];
    const all = await dbGetAll(store);
    return this.active(all)
      .filter(item => item.ID_Fiscalizacao_Local === this.current.id)
      .sort((a, b) => String(a.localCreatedAt || '').localeCompare(String(b.localCreatedAt || '')));
  },

  async saveChild(store, record, extraDeps = []) {
    const now = new Date().toISOString();
    const data = {
      ...record,
      ID_Fiscalizacao_Local: this.current.id,
      ID_Fiscalizacao: this.fiscRef(),
      Data_Atualizacao: now
    };
    if (!data.Data_Registro) data.Data_Registro = now;

    const saved = await saveLocalRecord(store, data, {
      operation: record.id ? 'UPDATE' : 'CREATE',
      dependsOn: [{ entity: 'fiscalizacoes', recordId: this.current.id }, ...extraDeps]
    });
    await App.updateSyncStatus();
    return saved;
  },

  async softDelete(store, id) {
    if (!confirm('Remover este item da fiscalização?')) return;
    const record = await dbGet(store, id);
    if (!record) return;
    record.Excluido = 'SIM';
    await this.saveChild(store, record);
    App.showMessage('Item removido.', 'success');
    await this.renderWorkspace();
  },


  /* =======================================================
     ABRIR MÓDULO / LISTA
  ======================================================= */

  async open() {
    this.current = null;
    this.property = null;
    this.producer = null;
    await this.loadCatalogs();

    const main = document.querySelector('main');
    main.innerHTML = `
      <section class="module-page">
        <div class="module-header">
          <button type="button" class="btn btn-secondary" onclick="App.showHome()">← Voltar</button>
          <div>
            <h2>Fiscalizações</h2>
            <p>Termos de fiscalização vinculados ao produtor, à propriedade e às culturas cadastradas.</p>
          </div>
        </div>

        <div id="fzListControls">
          <div class="module-actions">
            <button type="button" class="action-card" onclick="FiscalizacoesModule.startNew()">
              <span class="action-icon">➕</span>
              <span><strong>Nova fiscalização</strong><small>Escolher a propriedade cadastrada</small></span>
            </button>
            <button type="button" class="action-card" onclick="FiscalizacoesModule.refreshCatalogs()">
              <span class="action-icon">🔄</span>
              <span><strong>Atualizar programas e pragas</strong><small id="fzCatalogInfo">Verificando...</small></span>
            </button>
          </div>

          <div class="search-row">
            <input id="fzSearch" type="search" placeholder="Pesquisar por propriedade, produtor, município ou número">
            <select id="fzStatusFilter" class="fz-select">
              <option value="">Todas</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          </div>

          <div id="fzList" class="search-results"><p>Carregando...</p></div>
        </div>
        <div id="fzWorkspace" class="workspace"></div>
      </section>`;

    document.getElementById('fzSearch').oninput = () => this.renderList();
    document.getElementById('fzStatusFilter').onchange = () => this.renderList();

    this.updateCatalogInfo();
    await this.renderList();
  },

  /* Atalho usado pelo módulo Cadastros */
  async startFromProperty(propertyId) {
    await this.open();
    await this.showGeneralForm(null, propertyId);
  },

  async openFromAnywhere(fiscalizacaoId) {
    await this.open();
    await this.openInspection(fiscalizacaoId);
  },

  showListControls(show) {
    const el = document.getElementById('fzListControls');
    if (el) el.hidden = !show;
  },

  updateCatalogInfo() {
    const el = document.getElementById('fzCatalogInfo');
    if (!el || !this.cat) return;
    el.textContent = this.catalogIsEmpty()
      ? 'Catálogos ainda não baixados'
      : `${this.cat.programas.size} programa(s) • ${this.cat.pragas.size} praga(s)`;
  },

  async refreshCatalogs() {
    if (!navigator.onLine) {
      App.showMessage('Sem internet. O app usa o catálogo já salvo no aparelho.', 'warning');
      return;
    }
    try {
      await syncCatalogs();
      await this.loadCatalogs();
      App.showMessage('Programas, pragas e campos atualizados.', 'success');
    } catch (error) {
      console.error(error);
      App.showMessage('Não foi possível atualizar os catálogos.', 'error');
    }
    this.updateCatalogInfo();
  },

  async renderList() {
    const container = document.getElementById('fzList');
    if (!container) return;

    const query = this.val('fzSearch').toLowerCase();
    const status = this.val('fzStatusFilter');

    const list = this.active(await dbGetAll('fiscalizacoes'))
      .filter(f => !status || this.status(f) === status)
      .filter(f => !query || [
        f.Numero_Fiscalizacao, f.Nome_Propriedade_Local, f.Nome_Produtor_Local,
        f.Municipio, f.Siglas_Programas
      ].join(' ').toLowerCase().includes(query))
      .sort((a, b) => {
        const oa = this.status(a) === 'EM_ANDAMENTO' ? 0 : 1;
        const ob = this.status(b) === 'EM_ANDAMENTO' ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return String(b.Data_Hora_Inicio || b.localCreatedAt).localeCompare(String(a.Data_Hora_Inicio || a.localCreatedAt));
      });

    if (!list.length) {
      container.innerHTML = `<div class="empty-state">${query || status
        ? 'Nenhuma fiscalização encontrada com esse filtro.'
        : 'Nenhuma fiscalização registrada neste aparelho. Toque em “Nova fiscalização” ou inicie pela propriedade em Cadastros.'}</div>`;
      return;
    }

    container.innerHTML = list.map(f => this.listCard(f)).join('');
  },

  listCard(f) {
    return `
      <button type="button" class="result-card" onclick="FiscalizacoesModule.openInspection('${this.esc(f.id)}')">
        <strong>${this.esc(f.Nome_Propriedade_Local || 'Propriedade')} ${this.statusBadge(f)}</strong>
        <span>${this.esc(f.Nome_Produtor_Local || '')} • ${this.esc(f.Municipio || '')}</span>
        <small>${this.esc(f.Numero_Fiscalizacao || '')} • ${this.formatDateTime(f.Data_Hora_Inicio || f.Data_Fiscalizacao)} •
          ${this.esc(this.label(this.TIPOS_ACAO, f.Tipo_Acao || f.Tipo_Fiscalizacao))}${f.Siglas_Programas ? ' • ' + this.esc(f.Siglas_Programas) : ''} •
          ${f.syncStatus === 'SINCRONIZADO' ? 'sincronizada' : 'pendente de envio'}</small>
      </button>`;
  },


  /* =======================================================
     NOVA FISCALIZAÇÃO — ESCOLHA DA PROPRIEDADE
  ======================================================= */

  async startNew() {
    if (!(await Auth.ensureUser())) return;
    this.current = null;
    this.showListControls(false);

    document.getElementById('fzWorkspace').innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>Nova fiscalização</h3>
            <p>Escolha a propriedade. As culturas e os programas serão carregados do cadastro.</p>
          </div>
          <span class="step-badge">Etapa 1 de 2</span>
        </div>
        <div class="search-row">
          <input id="fzPropSearch" type="search" placeholder="Propriedade, produtor, CPF/CNPJ ou município">
        </div>
        <div id="fzPropResults" class="search-results"></div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.open()">Cancelar</button>
          <button type="button" class="btn btn-secondary" onclick="CadastrosModule.open()">Cadastrar produtor/propriedade</button>
        </div>
      </div>`;

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
    const producers = new Map((await dbGetAll('produtores')).map(p => [p.id, p]));
    const cultures = (await dbGetAll('culturas')).filter(c => c.Status !== 'INATIVO');

    const rows = (await dbGetAll('propriedades'))
      .filter(p => p.Status !== 'INATIVO')
      .map(p => ({
        property: p,
        producer: producers.get(p.ID_Produtor_Local) || null,
        cultures: cultures.filter(c => c.ID_Propriedade_Local === p.id)
      }))
      .filter(({ property, producer }) => {
        if (!query) return true;
        const text = [property.Nome_Propriedade, property.Municipio, property.Comunidade_Localidade, producer?.Nome_Razao_Social].join(' ').toLowerCase();
        const doc = String(producer?.CPF_CNPJ || '').replace(/\D/g, '');
        return text.includes(query) || (digits.length >= 3 && doc.includes(digits));
      })
      .slice(0, 30);

    container.innerHTML = rows.length ? rows.map(({ property, producer, cultures: cs }) => `
      <button type="button" class="result-card" onclick="FiscalizacoesModule.showGeneralForm(null, '${this.esc(property.id)}')">
        <strong>${this.esc(property.Nome_Propriedade || 'Propriedade sem nome')}</strong>
        <span>${this.esc(producer?.Nome_Razao_Social || 'Produtor não encontrado')}</span>
        <small>${this.esc(property.Municipio || '')} • ${cs.length
          ? cs.map(c => this.esc(this.cultureName(c))).join(', ')
          : '<b>sem culturas cadastradas</b>'}</small>
      </button>`).join('')
      : `<div class="empty-state">Nenhuma propriedade encontrada neste aparelho.</div>`;
  },


  /* =======================================================
     DADOS GERAIS + CULTURAS + PROGRAMAS
  ======================================================= */

  async showGeneralForm(existing = null, propertyId = null) {
    if (!(await Auth.ensureUser())) return;
    if (!this.cat) await this.loadCatalogs();

    const f = existing || {};
    const pid = existing ? existing.ID_Propriedade_Local : propertyId;

    this.property = await dbGet('propriedades', pid);
    if (!this.property) {
      App.showMessage('Propriedade não encontrada neste aparelho.', 'error');
      return;
    }
    this.producer = await dbGet('produtores', this.property.ID_Produtor_Local);

    const cultures = (await dbGetAll('culturas'))
      .filter(c => c.ID_Propriedade_Local === this.property.id && c.Status !== 'INATIVO');

    if (!cultures.length) {
      App.showMessage('Cadastre ao menos uma cultura na propriedade antes de fiscalizar.', 'warning');
      if (typeof CadastrosModule !== 'undefined') {
        await CadastrosModule.open();
        const producer = this.producer;
        if (producer && CadastrosModule.showPropertyDetails) {
          CadastrosModule.currentProducer = producer;
          await CadastrosModule.showPropertyDetails(this.property);
        }
      }
      return;
    }

    let checkedCultures;
    if (existing) {
      this.current = existing;
      checkedCultures = new Set((await this.getChildren('fiscalizacaoCulturas')).map(c => c.ID_Cultura_Local));
    } else {
      checkedCultures = new Set(cultures.map(c => c.id));
    }

    const programs = this.programsForCultureTypes(cultures.map(c => c.ID_Tipo_Cultura));
    const selectedProgs = new Set(existing
      ? String(f.ID_Programa || '').split(',').filter(Boolean)
      : (programs.length ? programs.map(p => p.id) : []));
    const tipo = f.Tipo_Acao || (programs.length ? 'PROGRAMA' : 'ROTINA');
    const user = Auth.getUser();

    this.showListControls(false);
    const ws = document.getElementById('fzWorkspace');

    ws.innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>${existing ? 'Editar dados gerais' : 'Termo de fiscalização'}</h3>
            <p><strong>${this.esc(this.property.Nome_Propriedade)}</strong> • ${this.esc(this.producer?.Nome_Razao_Social || '')} • ${this.esc(this.property.Municipio || '')}</p>
          </div>
          <span class="step-badge">${existing ? 'Edição' : 'Etapa 2 de 2'}</span>
        </div>

        <div class="fz-chain">
          <span>👤 ${this.esc(this.producer?.Nome_Razao_Social || 'Produtor')}</span>
          <span>🏡 ${this.esc(this.property.Nome_Propriedade)}</span>
          <span>🌱 ${cultures.length} cultura(s)</span>
          <span>📋 Termo</span>
        </div>

        <form id="fzGeneralForm">
          <div class="form-grid">

            <div class="field field-wide">
              <label>Culturas a fiscalizar *</label>
              <div class="fz-checklist" id="fzCultList">
                ${cultures.map(c => `
                  <label class="fz-check">
                    <input type="checkbox" name="fzCult" value="${this.esc(c.id)}" data-type="${this.esc(c.ID_Tipo_Cultura)}" ${checkedCultures.has(c.id) ? 'checked' : ''}>
                    <span><strong>${this.esc(this.cultureName(c))}</strong>
                    <small>${[c.Cultivar_Variedade, c.Area_Plantada_ha !== '' && c.Area_Plantada_ha != null ? c.Area_Plantada_ha + ' ha' : '', c.Quantidade_Plantas ? c.Quantidade_Plantas + ' plantas' : ''].filter(Boolean).map(v => this.esc(v)).join(' • ') || 'cadastrada na propriedade'}</small></span>
                  </label>`).join('')}
              </div>
            </div>

            <div class="field field-wide">
              <label for="fzTipo">Tipo de ação *</label>
              <select id="fzTipo" required>${this.options(this.TIPOS_ACAO, tipo)}</select>
            </div>

            <div class="field field-wide" id="fzProgBox">
              <label>Programas fitossanitários aplicáveis</label>
              ${programs.length ? `
                <div class="fz-checklist">
                  ${programs.map(p => `
                    <label class="fz-check">
                      <input type="checkbox" name="fzProg" value="${this.esc(p.id)}" data-cultures="${this.esc([...p.culturas].join(','))}" ${selectedProgs.has(p.id) ? 'checked' : ''}>
                      <span><strong>${this.esc(this.programLabel(p))}</strong>
                      <small>Culturas: ${[...p.culturas].map(t => this.esc(this.cat.culturas.get(t)?.nome || t)).join(', ')}</small></span>
                    </label>`).join('')}
                </div>
                <small>Calculados pelas culturas da propriedade (aba Programa_Cultura).</small>`
              : `<div class="empty-state">${this.catalogIsEmpty()
                  ? 'Catálogo de programas ainda não baixado. Toque em “Atualizar programas e pragas” com internet.'
                  : 'Nenhum programa vinculado às culturas desta propriedade.'}</div>`}
            </div>

            <div class="field field-wide">
              <label for="fzInicio">Data e hora de início *</label>
              <input id="fzInicio" type="datetime-local" required value="${this.esc(String(f.Data_Hora_Inicio || this.localNow()).slice(0, 16))}">
            </div>

            <div class="field field-wide">
              <label for="fzFinalidade">Finalidade / motivo</label>
              <input id="fzFinalidade" maxlength="300" value="${this.esc(f.Finalidade || '')}">
            </div>

            <div class="field">
              <label for="fzResponsavel">Responsável presente *</label>
              <input id="fzResponsavel" required maxlength="150" value="${this.esc(f.Responsavel_Presente ?? this.producer?.Nome_Razao_Social ?? '')}">
            </div>
            <div class="field">
              <label for="fzVinculo">Qualificação</label>
              <select id="fzVinculo">${this.options(this.VINCULOS, f.Vinculo_Responsavel || 'PRODUTOR')}</select>
            </div>
            <div class="field">
              <label for="fzCpfResp">CPF do responsável</label>
              <input id="fzCpfResp" inputmode="numeric" maxlength="14" value="${this.esc(f.CPF_Responsavel ?? this.producer?.CPF_CNPJ ?? '')}">
            </div>

            <div class="field">
              <label>Fiscal responsável</label>
              <div class="fz-readonly">
                <strong>${this.esc(existing?.Nome_Servidor || user?.Nome_Completo || '')}</strong>
                <small>${this.esc(existing ? (existing.Matricula_Servidor || '') : (user?.Matricula || ''))} ${!existing ? '• <a href="#" onclick="Auth.showIdentification().then(()=>FiscalizacoesModule.showGeneralForm(null, \'' + this.esc(this.property.id) + '\'));return false;">trocar</a>' : ''}</small>
              </div>
            </div>

            <div class="field">
              <label for="fzLat">Latitude</label>
              <input id="fzLat" inputmode="decimal" value="${this.esc(f.Latitude_Fiscalizacao ?? '')}">
            </div>
            <div class="field">
              <label for="fzLng">Longitude</label>
              <input id="fzLng" inputmode="decimal" value="${this.esc(f.Longitude_Fiscalizacao ?? '')}">
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
      </div>`;

    const tipoEl = document.getElementById('fzTipo');
    const progBox = document.getElementById('fzProgBox');
    const syncProgVisibility = () => {
      progBox.classList.toggle('fz-dim', tipoEl.value !== 'PROGRAMA');
    };
    tipoEl.onchange = syncProgVisibility;
    syncProgVisibility();

    // Marcar um programa marca as culturas dele
    document.querySelectorAll('input[name=fzProg]').forEach(box => {
      box.onchange = () => {
        if (!box.checked) return;
        const types = box.dataset.cultures.split(',');
        document.querySelectorAll('input[name=fzCult]').forEach(c => {
          if (types.includes(c.dataset.type)) c.checked = true;
        });
        if (tipoEl.value !== 'PROGRAMA') {
          tipoEl.value = 'PROGRAMA';
          syncProgVisibility();
        }
      };
    });

    document.getElementById('fzGeneralForm').onsubmit = event => {
      event.preventDefault();
      this.saveGeneral(existing, cultures);
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

  getPositionQuick() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords), () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  },

  generateNumber() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TF-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${rand}`;
  },

  async saveGeneral(existing, cultures) {
    const user = Auth.getUser();
    const cultIds = [...document.querySelectorAll('input[name=fzCult]:checked')].map(c => c.value);
    const progIds = [...document.querySelectorAll('input[name=fzProg]:checked')].map(c => c.value);
    const tipo = this.val('fzTipo');

    if (!cultIds.length) {
      App.showMessage('Selecione ao menos uma cultura a fiscalizar.', 'warning');
      return;
    }
    if (tipo === 'PROGRAMA' && !progIds.length) {
      App.showMessage('Selecione o(s) programa(s) fitossanitário(s) da fiscalização.', 'warning');
      return;
    }
    if (!this.val('fzInicio') || !this.val('fzResponsavel')) {
      App.showMessage('Preencha a data de início e o responsável presente.', 'warning');
      return;
    }

    const lat = this.num('fzLat');
    const lng = this.num('fzLng');
    if ((lat !== '' && (isNaN(lat) || lat < -10 || lat > 3)) || (lng !== '' && (isNaN(lng) || lng < -75 || lng > -56))) {
      if (!confirm('As coordenadas parecem estar fora do Amazonas. Salvar mesmo assim?')) return;
    }

    const usedProgs = tipo === 'PROGRAMA' ? progIds : [];
    const now = new Date().toISOString();
    const accuracy = document.getElementById('fzLat').dataset.accuracy;

    const record = {
      ...(existing || {}),
      Numero_Fiscalizacao: existing?.Numero_Fiscalizacao || this.generateNumber(),

      ID_Propriedade: this.refId(this.property, 'ID_Propriedade'),
      ID_Propriedade_Local: this.property.id,
      ID_Produtor: this.refId(this.producer, 'ID_Produtor'),
      ID_Produtor_Local: this.producer?.id || '',
      Nome_Propriedade_Local: this.property.Nome_Propriedade || '',
      Nome_Produtor_Local: this.producer?.Nome_Razao_Social || '',
      Municipio: this.property.Municipio || '',

      Data_Hora_Inicio: this.val('fzInicio'),
      Tipo_Acao: tipo,
      ID_Programa: usedProgs.join(','),
      Siglas_Programas: usedProgs.map(id => this.cat.programas.get(id)?.sigla || id).join(', '),
      Finalidade: this.val('fzFinalidade'),
      Responsavel_Presente: this.val('fzResponsavel'),
      Vinculo_Responsavel: this.val('fzVinculo'),
      CPF_Responsavel: this.val('fzCpfResp'),

      ID_Servidor: existing ? existing.ID_Servidor : (user?.ID_Servidor || ''),
      Nome_Servidor: existing ? existing.Nome_Servidor : (user?.Nome_Completo || ''),
      Matricula_Servidor: existing ? existing.Matricula_Servidor : (user?.Matricula || ''),

      Latitude_Fiscalizacao: lat,
      Longitude_Fiscalizacao: lng,
      Precisao_GPS_m: accuracy ? Number(accuracy) : (existing?.Precisao_GPS_m || ''),

      Status_Fiscalizacao: existing ? this.status(existing) : 'EM_ANDAMENTO',
      Data_Criacao: existing?.Data_Criacao || now,
      Data_Atualizacao: now
    };
    if (!existing) record.id = createUUID();
    if (!record.ID_Fiscalizacao) record.ID_Fiscalizacao = record.id;

    const deps = [{ entity: 'propriedades', recordId: this.property.id }];
    if (this.producer) deps.push({ entity: 'produtores', recordId: this.producer.id });

    this.current = await saveLocalRecord('fiscalizacoes', record, {
      operation: existing ? 'UPDATE' : 'CREATE',
      dependsOn: deps
    });

    /* Culturas fiscalizadas (Fiscalizacao_Culturas) */
    const existingFc = await this.getChildren('fiscalizacaoCulturas');
    for (const culture of cultures) {
      const fc = existingFc.find(x => x.ID_Cultura_Local === culture.id);
      const wanted = cultIds.includes(culture.id);
      if (wanted && !fc) {
        const id = createUUID();
        await this.saveChild('fiscalizacaoCulturas', {
          id,
          ID_Fiscalizacao_Cultura: id,
          ID_Cultura: this.refId(culture, 'ID_Cultura'),
          ID_Cultura_Local: culture.id,
          ID_Tipo_Cultura: culture.ID_Tipo_Cultura || '',
          Nome_Cultura_Local: this.cultureName(culture),
          Area_Fiscalizada_ha: '',
          Quantidade_Plantas_Avaliadas: '',
          Observacoes: ''
        }, [{ entity: 'culturas', recordId: culture.id }]);
      } else if (!wanted && fc) {
        fc.Excluido = 'SIM';
        await this.saveChild('fiscalizacaoCulturas', fc);
      }
    }

    await App.updateSyncStatus();
    App.showMessage(existing ? 'Dados atualizados.' : 'Fiscalização iniciada.', 'success');
    await this.openInspection(this.current.id);
  },


  /* =======================================================
     ÁREA DE TRABALHO
  ======================================================= */

  async openInspection(id) {
    if (!this.cat) await this.loadCatalogs();
    this.current = await dbGet('fiscalizacoes', id);
    if (!this.current) {
      App.showMessage('Fiscalização não encontrada.', 'error');
      return;
    }
    this.property = await dbGet('propriedades', this.current.ID_Propriedade_Local);
    this.producer = this.property ? await dbGet('produtores', this.property.ID_Produtor_Local) : null;
    this.showListControls(false);
    await this.renderWorkspace();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async loadAll() {
    const [cults, occs, dados, samples, actions, photos] = await Promise.all([
      this.getChildren('fiscalizacaoCulturas'),
      this.getChildren('ocorrenciasPragas'),
      this.getChildren('dadosFiscalizacao'),
      this.getChildren('amostras'),
      this.getChildren('providencias'),
      this.getChildren('evidencias')
    ]);
    return { cults, occs, dados, samples, actions, photos };
  },

  async renderWorkspace() {
    const ws = document.getElementById('fzWorkspace');
    if (!ws || !this.current) return;
    this.current = await dbGet('fiscalizacoes', this.current.id);
    const f = this.current;
    const editable = this.isEditable();
    const data = await this.loadAll();
    const doc = await this.getDocument();

    const openDetails = new Set([...ws.querySelectorAll('details[open]')].map(d => d.id).filter(Boolean));

    ws.innerHTML = `
      <div class="form-card">
        <div class="form-heading">
          <div>
            <h3>${this.esc(f.Nome_Propriedade_Local)} ${this.statusBadge(f)}</h3>
            <p>${this.esc(f.Nome_Produtor_Local)} • ${this.esc(f.Municipio)} • ${this.esc(f.Numero_Fiscalizacao)}</p>
          </div>
          ${this.syncBadge(f)}
        </div>

        <div class="summary-grid">
          <div><small>Início</small><strong>${this.formatDateTime(f.Data_Hora_Inicio || f.Data_Fiscalizacao)}</strong></div>
          <div><small>Tipo de ação</small><strong>${this.esc(this.label(this.TIPOS_ACAO, f.Tipo_Acao || f.Tipo_Fiscalizacao))}</strong></div>
          <div><small>Programa(s)</small><strong>${this.esc(f.Siglas_Programas || f.Programa_Tecnico || '—')}</strong></div>
          <div><small>Fiscal</small><strong>${this.esc(f.Nome_Servidor || f.Fiscal_Responsavel || '—')}</strong></div>
        </div>

        <div class="fz-toolbar">
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.open()">← Lista</button>
          ${editable ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.editGeneral()">✏️ Dados gerais e culturas</button>` : ''}
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.printTerm()">🖨️ ${doc ? 'Termo de Fiscalização' : 'Prévia do termo'}</button>
          ${!editable && this.status(f) !== 'CANCELADA' ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.reopen()">Reabrir para edição</button>` : ''}
        </div>

        ${this.sectionCultures(data, editable)}
        ${this.sectionSamples(data, editable)}
        ${this.sectionActions(data, editable)}
        ${this.sectionPhotos(data, editable)}
        ${this.sectionConclusion(f, data, editable, doc)}
      </div>`;

    openDetails.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.open = true;
    });

    this.bindWorkspace(data);
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


  /* ---------- CULTURAS: AVALIAÇÃO DE PRAGAS E CAMPOS ---------- */

  sectionCultures(data, editable) {
    const progIds = this.selectedPrograms();

    if (!data.cults.length) {
      return `
        <section class="subsection">
          <div class="fz-section-header"><h4>🌱 Culturas fiscalizadas</h4></div>
          <div class="empty-state">Nenhuma cultura selecionada. ${editable ? 'Use “Dados gerais e culturas”.' : ''}</div>
        </section>`;
    }

    return `
      <section class="subsection">
        <div class="fz-section-header"><h4>🌱 Culturas fiscalizadas e pragas avaliadas <span class="fz-count">${data.cults.length}</span></h4></div>
        ${data.cults.map(fc => this.cultureCard(fc, data, progIds, editable)).join('')}
      </section>`;
  },

  cultureCard(fc, data, progIds, editable) {
    const pests = this.pestsForCulture(fc.ID_Tipo_Cultura, progIds);
    const occs = data.occs.filter(o => o.ID_Fiscalizacao_Cultura_Local === fc.id);
    const fields = this.fieldsForCulture(fc.ID_Tipo_Cultura, progIds);
    const listedIds = new Set([...pests.doPrograma, ...pests.outras].map(p => p.id));
    const extraOccs = occs.filter(o => !o.ID_Praga || !listedIds.has(String(o.ID_Praga)));
    const dis = editable ? '' : 'disabled';

    const pestRows = list => list.map(p => {
      const occ = occs.find(o => String(o.ID_Praga) === p.id);
      return this.pestRow(fc, p, occ, editable);
    }).join('');

    return `
      <div class="fz-culture">
        <div class="fz-culture-head">
          <strong>${this.esc(fc.Nome_Cultura_Local)}</strong>
          <div class="fz-row fz-culture-metrics">
            <label>Área fiscalizada (ha)
              <input class="fz-mini" inputmode="decimal" data-fc="${this.esc(fc.id)}" data-field="Area_Fiscalizada_ha" value="${this.esc(fc.Area_Fiscalizada_ha ?? '')}" ${dis}></label>
            <label>Plantas avaliadas
              <input class="fz-mini" type="number" min="0" data-fc="${this.esc(fc.id)}" data-field="Quantidade_Plantas_Avaliadas" value="${this.esc(fc.Quantidade_Plantas_Avaliadas ?? '')}" ${dis}></label>
          </div>
        </div>

        ${fields.length ? `
          <div class="fz-dynamic">
            ${fields.map(c => this.dynamicField(fc, c, data.dados, editable)).join('')}
          </div>` : ''}

        ${pests.doPrograma.length ? `
          <div class="fz-pest-group">
            <div class="fz-group-title">Pragas do(s) programa(s)</div>
            ${pestRows(pests.doPrograma)}
          </div>` : ''}

        ${pests.outras.length ? `
          <details class="fz-pest-group" id="fzOther_${this.esc(fc.id)}" ${!pests.doPrograma.length || pests.outras.some(p => occs.find(o => String(o.ID_Praga) === p.id)) ? 'open' : ''}>
            <summary class="fz-group-title">${pests.doPrograma.length ? 'Outras pragas associadas à cultura' : 'Pragas associadas à cultura'} (${pests.outras.length})</summary>
            ${pestRows(pests.outras)}
          </details>` : ''}

        ${extraOccs.map(o => this.pestRow(fc, {
          id: o.ID_Praga || '', nome: o.Nome_Praga, cientifico: o.Nome_Cientifico, extra: true
        }, o, editable)).join('')}

        ${!pests.doPrograma.length && !pests.outras.length && !extraOccs.length ? `
          <div class="empty-state">Nenhuma praga vinculada a esta cultura na aba Praga_Cultura.</div>` : ''}

        ${editable ? `
          <div class="fz-add-other">
            <input list="fzAllPests" placeholder="Registrar outra praga nesta cultura..." id="fzOther_in_${this.esc(fc.id)}">
            <button type="button" class="btn btn-secondary fz-small" data-add-pest="${this.esc(fc.id)}">Adicionar</button>
          </div>` : ''}
      </div>`;
  },

  pestRow(fc, pest, occ, editable) {
    const result = occ?.Resultado_Avaliacao || 'NAO_AVALIADA';
    const positive = result === 'SUSPEITA' || result === 'DETECTADA';
    const key = `${fc.id}__${pest.id || occ?.id}`;
    const prog = pest.programa ? this.cat.programas.get(pest.programa) : null;

    return `
      <div class="fz-pest ${positive ? 'fz-pest-positive' : ''}">
        <div class="fz-pest-main">
          <div>
            <strong>${this.esc(pest.nome)}</strong> ${pest.cientifico ? `<em>${this.esc(pest.cientifico)}</em>` : ''}
            <small>${[prog?.sigla, pest.classificacao, pest.extra ? 'registrada manualmente' : ''].filter(Boolean).map(v => this.esc(v)).join(' • ')}</small>
          </div>
          <select class="fz-result fz-result-${result}" data-result-key="${this.esc(key)}"
            data-fc="${this.esc(fc.id)}" data-pest="${this.esc(pest.id)}" data-occ="${this.esc(occ?.id || '')}"
            ${editable ? '' : 'disabled'}>
            ${this.options(this.RESULTADOS, result, null)}
          </select>
        </div>
        ${positive && occ ? this.occurrenceDetails(occ, editable) : ''}
      </div>`;
  },

  occurrenceDetails(o, editable) {
    const dis = editable ? '' : 'disabled';
    const summary = [
      o.Nivel_Infestacao ? 'Nível ' + this.label(this.NIVEIS, o.Nivel_Infestacao).toLowerCase() : '',
      o.Distribuicao_Ocorrencia ? this.label(this.DISTRIBUICAO, o.Distribuicao_Ocorrencia) : '',
      o.Incidencia_Percentual !== '' && o.Incidencia_Percentual != null ? o.Incidencia_Percentual + '%' : '',
      o.Latitude_Ocorrencia ? '📍 ponto registrado' : ''
    ].filter(Boolean).join(' • ');

    return `
      <details class="fz-occ" id="fzOcc_${this.esc(o.id)}" ${!o.Sintomas_Observados && editable ? 'open' : ''}>
        <summary>Detalhes da ocorrência${summary ? ' — ' + this.esc(summary) : ''}</summary>
        <form class="fz-occ-form" data-occ-form="${this.esc(o.id)}">
          <div class="form-grid">
            <div class="field field-wide">
              <label>Sintomas / sinais observados *</label>
              <textarea name="Sintomas_Observados" rows="2" maxlength="1000" ${dis}>${this.esc(o.Sintomas_Observados || '')}</textarea>
            </div>
            <div class="field"><label>Nível de infestação</label>
              <select name="Nivel_Infestacao" ${dis}>${this.options(this.NIVEIS, o.Nivel_Infestacao)}</select></div>
            <div class="field"><label>Distribuição</label>
              <select name="Distribuicao_Ocorrencia" ${dis}>${this.options(this.DISTRIBUICAO, o.Distribuicao_Ocorrencia)}</select></div>
            <div class="field"><label>Incidência estimada (%)</label>
              <input name="Incidencia_Percentual" type="number" min="0" max="100" step="0.1" value="${this.esc(o.Incidencia_Percentual ?? '')}" ${dis}></div>
            <div class="field"><label>Há quanto tempo ocorre</label>
              <input name="Tempo_Ocorrencia" maxlength="100" value="${this.esc(o.Tempo_Ocorrencia || '')}" ${dis}></div>
            <div class="field"><label>Método de controle utilizado</label>
              <input name="Metodo_Controle" maxlength="200" value="${this.esc(o.Metodo_Controle || '')}" ${dis}></div>
            <div class="field"><label>Coleta de amostra</label>
              <select name="Coleta_Amostra" ${dis}>${this.options([['SIM', 'Sim'], ['NAO', 'Não']], o.Coleta_Amostra)}</select></div>
            <div class="field"><label>Latitude do foco</label>
              <input name="Latitude_Ocorrencia" id="lat_${this.esc(o.id)}" inputmode="decimal" value="${this.esc(o.Latitude_Ocorrencia ?? '')}" ${dis}></div>
            <div class="field"><label>Longitude do foco</label>
              <input name="Longitude_Ocorrencia" id="lng_${this.esc(o.id)}" inputmode="decimal" value="${this.esc(o.Longitude_Ocorrencia ?? '')}" ${dis}></div>
            <div class="field field-wide"><label>Observações</label>
              <input name="Observacoes" maxlength="500" value="${this.esc(o.Observacoes || '')}" ${dis}></div>
          </div>
          ${o.Legislacao ? `<p class="fz-legal">⚖️ ${this.esc(o.Legislacao)}</p>` : ''}
          ${editable ? `
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.captureGPS('lat_${this.esc(o.id)}','lng_${this.esc(o.id)}','gps_${this.esc(o.id)}')">📍 Ponto do foco</button>
              <small id="gps_${this.esc(o.id)}"></small>
              <button type="submit" class="btn btn-primary">Salvar detalhes</button>
            </div>` : ''}
        </form>
      </details>`;
  },

  dynamicField(fc, campo, dados, editable) {
    const existing = dados.find(d => d.ID_Fiscalizacao_Cultura_Local === fc.id && String(d.ID_Campo) === String(campo.ID_Campo));
    const value = existing?.Valor ?? '';
    const name = `dyn_${fc.id}_${campo.ID_Campo}`;
    const tipo = String(campo.Tipo_Campo || 'TEXTO').toUpperCase();
    const opts = this.fieldOptions(campo);
    const dis = editable ? '' : 'disabled';
    const req = this.yes(campo.Obrigatorio) ? ' *' : '';
    const unit = this.clean(campo.Unidade);
    const common = `class="fz-dyn" data-fc="${this.esc(fc.id)}" data-campo="${this.esc(campo.ID_Campo)}" id="${this.esc(name)}" ${dis}`;

    let input;
    if ((tipo === 'SELECAO_UNICA' || tipo === 'SIM_NAO') && (opts.length || tipo === 'SIM_NAO')) {
      input = `<select ${common}>${this.options(opts.length ? opts : [['SIM', 'Sim'], ['NAO', 'Não']], value)}</select>`;
    } else if (tipo === 'TEXTO_LONGO') {
      input = `<textarea rows="2" ${common}>${this.esc(value)}</textarea>`;
    } else if (tipo === 'NUMERO' || tipo === 'NUMERICO' || tipo === 'DECIMAL' || tipo === 'INTEIRO') {
      input = `<input type="number" step="any" value="${this.esc(value)}" ${common}>`;
    } else if (tipo === 'DATA') {
      input = `<input type="date" value="${this.esc(value)}" ${common}>`;
    } else {
      input = `<input maxlength="300" value="${this.esc(value)}" ${common}>`;
    }

    const cond = this.clean(campo.ID_Campo_Condicao);
    return `
      <div class="field" data-dyn-wrap="${this.esc(fc.id)}" data-cond="${this.esc(cond)}"
        data-cond-val="${this.esc(this.clean(campo.Valor_Condicao))}" data-cond-op="${this.esc(this.clean(campo.Operador_Condicao) || 'IGUAL_A')}">
        <label for="${this.esc(name)}">${this.esc(this.clean(campo.Rotulo_Campo) || campo.Nome_Campo)}${req}${unit ? ` (${this.esc(unit)})` : ''}</label>
        ${input}
      </div>`;
  },

  applyConditions() {
    document.querySelectorAll('[data-dyn-wrap]').forEach(wrap => {
      const cond = wrap.dataset.cond;
      if (!cond) return;
      const source = document.querySelector(`.fz-dyn[data-fc="${wrap.dataset.dynWrap}"][data-campo="${cond}"]`);
      const current = source ? source.value : '';
      const target = wrap.dataset.condVal;
      const op = (wrap.dataset.condOp || 'IGUAL_A').toUpperCase();
      const visible = op === 'DIFERENTE_DE'
        ? current !== '' && current !== target
        : current === target;
      wrap.hidden = !visible;
    });
  },

  async saveDynamic(el) {
    const fc = await dbGet('fiscalizacaoCulturas', el.dataset.fc);
    const campo = this.cat.campos.find(c => String(c.ID_Campo) === el.dataset.campo);
    const dados = await this.getChildren('dadosFiscalizacao');
    const existing = dados.find(d => d.ID_Fiscalizacao_Cultura_Local === fc.id && String(d.ID_Campo) === el.dataset.campo);
    const id = existing?.id || createUUID();
    const user = Auth.getUser();

    await this.saveChild('dadosFiscalizacao', {
      ...(existing || {}),
      id,
      ID_Dado_Fiscalizacao: id,
      ID_Cultura: fc.ID_Cultura,
      ID_Cultura_Local: fc.ID_Cultura_Local,
      ID_Fiscalizacao_Cultura_Local: fc.id,
      ID_Programa: this.clean(campo?.ID_Programa),
      ID_Campo: el.dataset.campo,
      Nome_Campo: campo?.Nome_Campo || '',
      Rotulo_Campo: this.clean(campo?.Rotulo_Campo),
      Valor: el.value,
      Unidade: this.clean(campo?.Unidade),
      ID_Servidor_Registro: user?.ID_Servidor || ''
    }, [{ entity: 'fiscalizacaoCulturas', recordId: fc.id }]);
  },

  async saveCultureMetric(el) {
    const fc = await dbGet('fiscalizacaoCulturas', el.dataset.fc);
    if (!fc) return;
    const raw = el.value.replace(',', '.');
    fc[el.dataset.field] = raw === '' ? '' : Number(raw);
    await this.saveChild('fiscalizacaoCulturas', fc);
  },

  async setResult(el) {
    const fc = await dbGet('fiscalizacaoCulturas', el.dataset.fc);
    const result = el.value;
    let occ = el.dataset.occ ? await dbGet('ocorrenciasPragas', el.dataset.occ) : null;

    if (!occ && result === 'NAO_AVALIADA') return;

    const pest = el.dataset.pest ? this.cat.pragas.get(el.dataset.pest) : null;
    const rel = pest ? this.pestsForCulture(fc.ID_Tipo_Cultura, this.selectedPrograms()) : null;
    const relInfo = rel ? [...rel.doPrograma, ...rel.outras].find(p => p.id === pest.id) : null;

    if (!occ) {
      const id = createUUID();
      occ = {
        id,
        ID_Ocorrencia: id,
        ID_Cultura: fc.ID_Cultura,
        ID_Cultura_Local: fc.ID_Cultura_Local,
        ID_Fiscalizacao_Cultura_Local: fc.id,
        Nome_Cultura_Local: fc.Nome_Cultura_Local,
        ID_Praga: pest?.id || '',
        Nome_Praga: pest?.nome || '',
        Nome_Cientifico: pest?.cientifico || '',
        ID_Programa: relInfo?.inProgram ? relInfo.programa : '',
        Legislacao: relInfo?.legislacao || pest?.legislacao || ''
      };
    }
    occ.Resultado_Avaliacao = result;

    await this.saveChild('ocorrenciasPragas', occ, [{ entity: 'fiscalizacaoCulturas', recordId: fc.id }]);
    if (result === 'SUSPEITA' || result === 'DETECTADA' || el.dataset.occ === '') {
      await this.renderWorkspace();
    }
  },

  async addOtherPest(fcId) {
    const input = document.getElementById('fzOther_in_' + fcId);
    const name = String(input?.value || '').trim();
    if (!name) {
      App.showMessage('Digite o nome da praga.', 'warning');
      return;
    }
    const fc = await dbGet('fiscalizacaoCulturas', fcId);
    const pest = [...this.cat.pragas.values()].find(p =>
      p.nome.toLowerCase() === name.toLowerCase() || (p.cientifico && p.cientifico.toLowerCase() === name.toLowerCase()));
    const occs = await this.getChildren('ocorrenciasPragas');
    if (pest && occs.some(o => o.ID_Fiscalizacao_Cultura_Local === fcId && String(o.ID_Praga) === pest.id)) {
      App.showMessage('Essa praga já está na lista desta cultura.', 'warning');
      return;
    }
    const id = createUUID();
    await this.saveChild('ocorrenciasPragas', {
      id,
      ID_Ocorrencia: id,
      ID_Cultura: fc.ID_Cultura,
      ID_Cultura_Local: fc.ID_Cultura_Local,
      ID_Fiscalizacao_Cultura_Local: fc.id,
      Nome_Cultura_Local: fc.Nome_Cultura_Local,
      ID_Praga: pest?.id || '',
      Nome_Praga: pest?.nome || name,
      Nome_Cientifico: pest?.cientifico || '',
      Praga_Catalogada: pest ? 'SIM' : 'NAO',
      Legislacao: pest?.legislacao || '',
      Resultado_Avaliacao: 'SUSPEITA'
    }, [{ entity: 'fiscalizacaoCulturas', recordId: fc.id }]);
    App.showMessage('Praga registrada como suspeita. Complete os detalhes.', 'success');
    await this.renderWorkspace();
  },

  async saveOccurrenceDetails(form) {
    const occ = await dbGet('ocorrenciasPragas', form.dataset.occForm);
    if (!occ) return;
    const fd = new FormData(form);
    for (const [key, value] of fd.entries()) {
      const v = String(value).trim();
      occ[key] = ['Incidencia_Percentual', 'Latitude_Ocorrencia', 'Longitude_Ocorrencia'].includes(key)
        ? (v === '' ? '' : Number(v.replace(',', '.')))
        : v;
    }
    await this.saveChild('ocorrenciasPragas', occ, [{ entity: 'fiscalizacaoCulturas', recordId: occ.ID_Fiscalizacao_Cultura_Local }]);
    App.showMessage('Detalhes da ocorrência salvos.', 'success');
    await this.renderWorkspace();
  },

  positiveOccs(data) {
    return data.occs.filter(o => o.Resultado_Avaliacao === 'SUSPEITA' || o.Resultado_Avaliacao === 'DETECTADA');
  },

  occLabel(o) {
    return `${o.Nome_Praga} — ${o.Nome_Cultura_Local}`;
  },


  /* ---------- AMOSTRAS ---------- */

  sectionSamples(data, editable) {
    const occs = this.positiveOccs(data);
    return `
      <section class="subsection">
        ${this.sectionHeader('🧪 Amostras', data.samples.length, 'fzSampleForm', editable)}
        <form id="fzSampleForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field field-wide">
              <label for="fzSmpOcc">Ocorrência / cultura *</label>
              <select id="fzSmpOcc" required>
                ${this.options(occs.map(o => ['occ:' + o.id, this.occLabel(o)]).concat(data.cults.map(c => ['fc:' + c.id, 'Sem ocorrência — ' + c.Nome_Cultura_Local])))}
              </select>
            </div>
            <div class="field"><label for="fzSmpCod">Identificação da amostra *</label>
              <input id="fzSmpCod" required maxlength="60"></div>
            <div class="field"><label for="fzSmpLacre">Nº do lacre</label>
              <input id="fzSmpLacre" maxlength="60"></div>
            <div class="field"><label for="fzSmpMat">Material coletado *</label>
              <select id="fzSmpMat" required>${this.options(this.MATERIAIS)}</select></div>
            <div class="field"><label for="fzSmpQtd">Quantidade</label>
              <div class="fz-row">
                <input id="fzSmpQtd" type="number" min="0" step="any">
                <select id="fzSmpUn" class="fz-select">${this.options(['UN', 'PLANTA', 'FRUTO', 'INSETO', 'KG', 'AMOSTRA'], 'UN', null)}</select>
              </div></div>
            <div class="field"><label for="fzSmpLab">Laboratório de destino</label>
              <input id="fzSmpLab" maxlength="150"></div>
            <div class="field"><label for="fzSmpObs">Observações</label>
              <input id="fzSmpObs" maxlength="500"></div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzSampleForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar amostra</button>
          </div>
        </form>
        ${data.samples.length ? data.samples.map(s => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(s.Identificacao_Amostra)} — ${this.esc(s.Tipo_Material)}</strong>
              <span>${[s.Nome_Praga_Relacionada, s.Nome_Cultura_Local,
                s.Quantidade !== '' && s.Quantidade != null ? s.Quantidade + ' ' + (s.Unidade || '') : '',
                s.Numero_Lacre ? 'Lacre ' + s.Numero_Lacre : '', s.Laboratorio_Destino].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
            </div>
            ${this.removeButton('amostras', s.id, editable)}
          </div>`).join('') : `<div class="empty-state">Nenhuma amostra coletada.</div>`}
      </section>`;
  },

  async saveSample() {
    const ref = this.val('fzSmpOcc');
    if (!ref || !this.val('fzSmpCod') || !this.val('fzSmpMat')) {
      App.showMessage('Informe a ocorrência/cultura, a identificação e o material.', 'warning');
      return;
    }
    const [kind, refId] = ref.split(':');
    const occ = kind === 'occ' ? await dbGet('ocorrenciasPragas', refId) : null;
    const fc = await dbGet('fiscalizacaoCulturas', occ ? occ.ID_Fiscalizacao_Cultura_Local : refId);
    const user = Auth.getUser();
    const id = createUUID();

    await this.saveChild('amostras', {
      id,
      ID_Amostra: id,
      ID_Ocorrencia: occ?.ID_Ocorrencia || '',
      ID_Ocorrencia_Local: occ?.id || '',
      ID_Cultura: fc?.ID_Cultura || '',
      ID_Fiscalizacao_Cultura_Local: fc?.id || '',
      Nome_Cultura_Local: fc?.Nome_Cultura_Local || '',
      ID_Praga: occ?.ID_Praga || '',
      Nome_Praga_Relacionada: occ?.Nome_Praga || '',
      Tipo_Material: this.val('fzSmpMat'),
      Quantidade: this.num('fzSmpQtd'),
      Unidade: this.val('fzSmpUn'),
      Data_Hora_Coleta: this.localNow(),
      Numero_Lacre: this.val('fzSmpLacre'),
      Identificacao_Amostra: this.val('fzSmpCod'),
      Laboratorio_Destino: this.val('fzSmpLab'),
      Status_Amostra: 'COLETADA',
      Observacoes: this.val('fzSmpObs'),
      ID_Servidor_Coleta: user?.ID_Servidor || ''
    }, occ ? [{ entity: 'ocorrenciasPragas', recordId: occ.id }] : []);

    if (occ && occ.Coleta_Amostra !== 'SIM') {
      occ.Coleta_Amostra = 'SIM';
      await this.saveChild('ocorrenciasPragas', occ);
    }
    App.showMessage('Amostra registrada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- PROVIDÊNCIAS ---------- */

  sectionActions(data, editable) {
    const occs = this.positiveOccs(data);
    return `
      <section class="subsection">
        ${this.sectionHeader('📄 Providências', data.actions.length, 'fzActForm', editable)}
        <form id="fzActForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field"><label for="fzActTipo">Tipo *</label>
              <select id="fzActTipo" required>${this.options(this.PROVIDENCIAS)}</select></div>
            <div class="field"><label for="fzActOcc">Ocorrência relacionada</label>
              <select id="fzActOcc">${this.options(occs.map(o => [o.id, this.occLabel(o)]), '', 'Nenhuma')}</select></div>
            <div class="field field-wide"><label for="fzActDesc">Descrição / medida determinada *</label>
              <textarea id="fzActDesc" rows="3" required maxlength="1500"></textarea></div>
            <div class="field"><label for="fzActPrazo">Prazo para cumprimento</label>
              <input id="fzActPrazo" type="date"></div>
            <div class="field"><label for="fzActNum">Nº do documento</label>
              <input id="fzActNum" maxlength="60"></div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzActForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar providência</button>
          </div>
        </form>
        ${data.actions.length ? data.actions.map(a => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(this.label(this.PROVIDENCIAS, a.Tipo_Providencia))}${a.Numero_Documento ? ' nº ' + this.esc(a.Numero_Documento) : ''}</strong>
              <span>${this.esc(a.Descricao)}</span>
              <span>${[a.Nome_Praga_Relacionada, a.Prazo ? 'Prazo: ' + this.formatDate(a.Prazo) : ''].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
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
    const occ = this.val('fzActOcc') ? await dbGet('ocorrenciasPragas', this.val('fzActOcc')) : null;
    const id = createUUID();
    await this.saveChild('providencias', {
      id,
      ID_Providencia: id,
      ID_Ocorrencia: occ?.ID_Ocorrencia || '',
      ID_Ocorrencia_Local: occ?.id || '',
      Nome_Praga_Relacionada: occ?.Nome_Praga || '',
      Tipo_Providencia: this.val('fzActTipo'),
      Descricao: this.val('fzActDesc'),
      Data_Hora: this.localNow(),
      ID_Servidor: Auth.currentServerId(),
      Prazo: this.val('fzActPrazo'),
      Status_Providencia: 'PENDENTE',
      Numero_Documento: this.val('fzActNum')
    }, occ ? [{ entity: 'ocorrenciasPragas', recordId: occ.id }] : []);
    App.showMessage('Providência registrada.', 'success');
    await this.renderWorkspace();
  },


  /* ---------- EVIDÊNCIAS FOTOGRÁFICAS ---------- */

  sectionPhotos(data, editable) {
    const occs = this.positiveOccs(data);
    return `
      <section class="subsection">
        ${this.sectionHeader('📷 Evidências fotográficas', data.photos.length, 'fzPhotoForm', editable)}
        <form id="fzPhotoForm" class="fz-inline-form" hidden>
          <div class="form-grid">
            <div class="field field-wide"><label for="fzPhotoFile">Foto *</label>
              <input id="fzPhotoFile" type="file" accept="image/*" capture="environment" required>
              <small>A foto é reduzida no aparelho (máx. 1280 px).</small></div>
            <div class="field"><label for="fzPhotoRef">Relacionada a</label>
              <select id="fzPhotoRef">${this.options(occs.map(o => ['occ:' + o.id, this.occLabel(o)]).concat(data.cults.map(c => ['fc:' + c.id, 'Cultura — ' + c.Nome_Cultura_Local])), '', 'Fiscalização em geral')}</select></div>
            <div class="field"><label for="fzPhotoDesc">Legenda</label>
              <input id="fzPhotoDesc" maxlength="200"></div>
            <div class="field field-wide">
              <label class="fz-check-inline"><input type="checkbox" id="fzPhotoPdf" checked> Incluir no Termo</label>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.toggle('fzPhotoForm')">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="fzPhotoBtn">Salvar foto</button>
          </div>
        </form>
        ${data.photos.length ? `<div class="fz-gallery">${data.photos.map(p => `
          <figure class="fz-photo">
            ${p.Foto ? `<img src="${this.esc(p.Foto)}" alt="${this.esc(p.Legenda || 'Evidência')}">`
              : (p.Arquivo_URL || p.Foto_URL) ? `<a href="${this.esc(p.Arquivo_URL || p.Foto_URL)}" target="_blank" rel="noopener" class="fz-photo-link">Ver foto no Drive</a>`
              : '<div class="fz-photo-link">Foto indisponível</div>'}
            <figcaption>${this.esc(p.Legenda || p.Descricao || 'Sem legenda')}
              ${p.Nome_Praga_Relacionada ? `<br><small>${this.esc(p.Nome_Praga_Relacionada)}</small>` : ''}
              ${this.removeButton('evidencias', p.id, editable)}</figcaption>
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

  async savePhoto() {
    const file = document.getElementById('fzPhotoFile')?.files?.[0];
    if (!file) {
      App.showMessage('Selecione ou tire uma foto.', 'warning');
      return;
    }
    const btn = document.getElementById('fzPhotoBtn');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
      const [dataUrl, coords] = await Promise.all([this.compressImage(file), this.getPositionQuick()]);
      const [kind, refId] = (this.val('fzPhotoRef') || ':').split(':');
      const occ = kind === 'occ' ? await dbGet('ocorrenciasPragas', refId) : null;
      const fc = kind === 'fc' ? await dbGet('fiscalizacaoCulturas', refId)
        : occ ? await dbGet('fiscalizacaoCulturas', occ.ID_Fiscalizacao_Cultura_Local) : null;
      const id = createUUID();

      await this.saveChild('evidencias', {
        id,
        ID_Evidencia: id,
        ID_Ocorrencia: occ?.ID_Ocorrencia || '',
        ID_Ocorrencia_Local: occ?.id || '',
        ID_Cultura: fc?.ID_Cultura || '',
        Nome_Praga_Relacionada: occ?.Nome_Praga || '',
        Tipo_Evidencia: 'FOTO',
        Legenda: this.val('fzPhotoDesc'),
        Foto: dataUrl,
        Arquivo_URL: '',
        Nome_Arquivo: `${this.current.Numero_Fiscalizacao}_${Date.now()}.jpg`,
        Incluir_PDF: document.getElementById('fzPhotoPdf').checked ? 'SIM' : 'NAO',
        Latitude: coords ? Number(coords.latitude.toFixed(6)) : '',
        Longitude: coords ? Number(coords.longitude.toFixed(6)) : '',
        Data_Hora_Registro: new Date().toISOString(),
        ID_Servidor: Auth.currentServerId()
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


  /* ---------- CONCLUSÃO, ASSINATURAS E TERMO ---------- */

  suggestSituation(data) {
    if (data.occs.some(o => o.Resultado_Avaliacao === 'DETECTADA')) return 'COM_OCORRENCIA';
    if (data.occs.some(o => o.Resultado_Avaliacao === 'SUSPEITA')) return 'SUSPEITA';
    return 'SEM_OCORRENCIA';
  },

  async getDocument() {
    const docs = await this.getChildren('documentos');
    return docs
      .filter(d => d.Status_Documento === 'EMITIDO')
      .sort((a, b) => Number(b.Versao_Documento || 0) - Number(a.Versao_Documento || 0))[0] || null;
  },

  sectionConclusion(f, data, editable, doc) {
    if (!editable) {
      return `
        <section class="subsection">
          <div class="fz-section-header"><h4>✅ Conclusão</h4></div>
          <div class="mini-card">
            <strong>${this.esc(this.label(this.SITUACOES, f.Situacao_Fitossanitaria))}</strong>
            <span>${this.esc(f.Observacoes || 'Sem observações.')}</span>
            <span>${this.status(f) === 'CANCELADA'
              ? 'Cancelada: ' + this.esc(f.Motivo_Cancelamento || '')
              : `Finalizada em ${this.formatDateTime(f.Data_Hora_Final || f.Data_Finalizacao)}${doc ? ` • Termo nº ${this.esc(doc.Numero_Documento)} (versão ${this.esc(doc.Versao_Documento)})` : ''}`}</span>
          </div>
        </section>`;
    }

    const suggested = f.Situacao_Fitossanitaria || this.suggestSituation(data);
    const responsible = f.Responsavel_Presente || '';

    return `
      <section class="subsection">
        <div class="fz-section-header"><h4>✅ Conclusão e assinaturas</h4></div>
        <form id="fzConclForm" class="fz-inline-form">
          <div class="form-grid">
            <div class="field field-wide"><label for="fzSituacao">Situação fitossanitária *</label>
              <select id="fzSituacao" required>${this.options(this.SITUACOES, suggested)}</select>
              <small>Sugerida a partir dos resultados das pragas avaliadas.</small></div>
            <div class="field field-wide"><label for="fzObs">Relato da fiscalização / observações</label>
              <textarea id="fzObs" rows="4" maxlength="4000">${this.esc(f.Observacoes || '')}</textarea></div>

            <div class="field">
              <label>Assinatura do fiscal — ${this.esc(f.Nome_Servidor || '')}</label>
              <canvas class="fz-sign" id="fzSignFiscal" width="600" height="180"></canvas>
              <button type="button" class="fz-link" onclick="FiscalizacoesModule.clearSign('fzSignFiscal')">Limpar</button>
            </div>
            <div class="field">
              <label>Assinatura do responsável — ${this.esc(responsible)}</label>
              <canvas class="fz-sign" id="fzSignResp" width="600" height="180"></canvas>
              <div class="fz-row">
                <button type="button" class="fz-link" onclick="FiscalizacoesModule.clearSign('fzSignResp')">Limpar</button>
                <label class="fz-check-inline"><input type="checkbox" id="fzRecusa"> Recusou-se a assinar</label>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary fz-danger" onclick="FiscalizacoesModule.cancelInspection()">Cancelar fiscalização</button>
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.saveConclusion(false)">Salvar rascunho</button>
            <button type="submit" class="btn btn-primary">Finalizar e emitir termo</button>
          </div>
        </form>
      </section>`;
  },

  initSignaturePad(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    canvas.dataset.signed = '';
    let drawing = false;

    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
    };
    canvas.onpointerdown = e => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(...pos(e));
    };
    canvas.onpointermove = e => {
      if (!drawing) return;
      ctx.lineTo(...pos(e));
      ctx.stroke();
      canvas.dataset.signed = '1';
    };
    canvas.onpointerup = canvas.onpointercancel = () => { drawing = false; };
  },

  clearSign(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.signed = '';
  },

  signatureData(id) {
    const canvas = document.getElementById(id);
    return canvas && canvas.dataset.signed ? canvas.toDataURL('image/png') : '';
  },

  async saveConclusion(finish) {
    const situacao = this.val('fzSituacao');
    const data = await this.loadAll();

    if (finish) {
      const problems = [];
      const progIds = this.selectedPrograms();

      if (!data.cults.length) problems.push('nenhuma cultura fiscalizada');

      data.cults.forEach(fc => {
        const { doPrograma } = this.pestsForCulture(fc.ID_Tipo_Cultura, progIds);
        const pending = doPrograma.filter(p => {
          const o = data.occs.find(x => x.ID_Fiscalizacao_Cultura_Local === fc.id && String(x.ID_Praga) === p.id);
          return !o || o.Resultado_Avaliacao === 'NAO_AVALIADA';
        });
        if (pending.length) problems.push(`${fc.Nome_Cultura_Local}: praga(s) do programa sem avaliação (${pending.map(p => p.nome).join(', ')})`);

        this.fieldsForCulture(fc.ID_Tipo_Cultura, progIds)
          .filter(c => this.yes(c.Obrigatorio))
          .forEach(c => {
            const wrap = document.querySelector(`[data-dyn-wrap="${fc.id}"] .fz-dyn[data-campo="${c.ID_Campo}"]`)?.closest('[data-dyn-wrap]');
            if (wrap && wrap.hidden) return;
            const d = data.dados.find(x => x.ID_Fiscalizacao_Cultura_Local === fc.id && String(x.ID_Campo) === String(c.ID_Campo));
            if (!d || d.Valor === '') problems.push(`${fc.Nome_Cultura_Local}: “${this.clean(c.Rotulo_Campo) || c.Nome_Campo}” não respondido`);
          });
      });

      this.positiveOccs(data).filter(o => !o.Sintomas_Observados)
        .forEach(o => problems.push(`${this.occLabel(o)}: sintomas não descritos`));

      const hasPositive = this.positiveOccs(data).length > 0;
      if (situacao === 'SEM_OCORRENCIA' && hasPositive) problems.push('há pragas suspeitas/detectadas, mas a situação indica “sem ocorrência”');
      if (situacao !== 'SEM_OCORRENCIA' && !hasPositive) problems.push('a situação indica praga, mas nenhuma foi marcada como suspeita/detectada');

      if (!this.signatureData('fzSignFiscal')) problems.push('assinatura do fiscal não coletada');
      if (!this.signatureData('fzSignResp') && !document.getElementById('fzRecusa').checked) problems.push('assinatura do responsável não coletada');

      if (problems.length && !confirm('Atenção:\n- ' + problems.join('\n- ') + '\n\nFinalizar mesmo assim?')) return;
      if (!problems.length && !confirm('Finalizar a fiscalização e emitir o Termo de Fiscalização?')) return;
    }

    const now = new Date().toISOString();
    const record = {
      ...this.current,
      Situacao_Fitossanitaria: situacao,
      Observacoes: this.val('fzObs'),
      Data_Atualizacao: now
    };
    if (finish) {
      record.Status_Fiscalizacao = 'FINALIZADA';
      record.Data_Hora_Final = this.localNow();
      record.Data_Finalizacao = now;
    }

    const signFiscal = finish ? this.signatureData('fzSignFiscal') : '';
    const signResp = finish ? this.signatureData('fzSignResp') : '';
    const recusa = finish ? document.getElementById('fzRecusa').checked : false;

    this.current = await saveLocalRecord('fiscalizacoes', record, {
      operation: 'UPDATE',
      dependsOn: [{ entity: 'propriedades', recordId: record.ID_Propriedade_Local }]
    });

    if (finish) {
      await this.emitDocument(data, { signFiscal, signResp, recusa });
    }

    await App.updateSyncStatus();
    App.showMessage(finish ? 'Fiscalização finalizada. Termo emitido.' : 'Rascunho salvo.', 'success');

    if (finish && navigator.onLine && apiIsConfigured()) {
      syncAll().catch(err => console.warn('Sincronização após finalização falhou:', err));
    }
    await this.renderWorkspace();
    if (finish) this.printTerm();
  },

  async emitDocument(data, { signFiscal, signResp, recusa }) {
    const f = this.current;
    const user = Auth.getUser();
    const previous = (await this.getChildren('documentos')).filter(d => d.Tipo_Documento === 'TERMO_FISCALIZACAO');
    const version = previous.reduce((max, d) => Math.max(max, Number(d.Versao_Documento || 0)), 0) + 1;

    for (const old of previous.filter(d => d.Status_Documento === 'EMITIDO')) {
      old.Status_Documento = 'SUBSTITUIDO';
      await this.saveChild('documentos', old);
    }

    const content = JSON.stringify({
      fiscalizacao: f.Numero_Fiscalizacao, versao: version, propriedade: f.ID_Propriedade,
      situacao: f.Situacao_Fitossanitaria,
      culturas: data.cults.map(c => [c.ID_Cultura, c.Area_Fiscalizada_ha, c.Quantidade_Plantas_Avaliadas]),
      ocorrencias: data.occs.map(o => [o.ID_Praga || o.Nome_Praga, o.ID_Cultura, o.Resultado_Avaliacao]),
      amostras: data.samples.map(s => s.Identificacao_Amostra),
      providencias: data.actions.map(a => [a.Tipo_Providencia, a.Descricao])
    });

    const docId = createUUID();
    const doc = await this.saveChild('documentos', {
      id: docId,
      ID_Documento: docId,
      Tipo_Documento: 'TERMO_FISCALIZACAO',
      ID_Propriedade: f.ID_Propriedade,
      Numero_Documento: f.Numero_Fiscalizacao + (version > 1 ? '-V' + version : ''),
      Versao_Documento: version,
      Data_Hora_Emissao: now(),
      ID_Servidor_Emissor: user?.ID_Servidor || f.ID_Servidor || '',
      Nome_Servidor_Emissor: f.Nome_Servidor || user?.Nome_Completo || '',
      Status_Documento: 'EMITIDO',
      PDF_URL: '',
      Hash_Documento: await this.digest(content),
      Observacoes: ''
    });

    function now() { return new Date().toISOString(); }

    const coords = await this.getPositionQuick();
    const signature = async (tipo, nome, cpf, qualificacao, img, status, servidor) => {
      const id = createUUID();
      await this.saveChild('assinaturas', {
        id,
        ID_Assinatura: id,
        ID_Documento: doc.ID_Documento,
        ID_Documento_Local: doc.id,
        Tipo_Assinante: tipo,
        ID_Servidor: servidor || '',
        Nome_Assinante: nome,
        CPF_Assinante: cpf || '',
        Qualificacao_Assinante: qualificacao,
        Assinatura: img,
        Assinatura_URL: '',
        Data_Hora_Assinatura: now(),
        Latitude_Assinatura: coords ? Number(coords.latitude.toFixed(6)) : '',
        Longitude_Assinatura: coords ? Number(coords.longitude.toFixed(6)) : '',
        Status_Assinatura: status
      }, [{ entity: 'documentos', recordId: doc.id }]);
    };

    await signature('SERVIDOR', f.Nome_Servidor || user?.Nome_Completo || '', '',
      user?.Cargo_Funcao || 'Fiscal', signFiscal, signFiscal ? 'ASSINADO' : 'PENDENTE', f.ID_Servidor);
    await signature(f.Vinculo_Responsavel || 'RESPONSAVEL', f.Responsavel_Presente || '', f.CPF_Responsavel,
      this.label(this.VINCULOS, f.Vinculo_Responsavel), signResp,
      signResp ? 'ASSINADO' : (recusa ? 'RECUSADO' : 'PENDENTE'), '');
  },

  async cancelInspection() {
    const reason = prompt('Motivo do cancelamento da fiscalização:');
    if (reason === null) return;
    if (!reason.trim()) {
      App.showMessage('Informe o motivo do cancelamento.', 'warning');
      return;
    }
    await saveLocalRecord('fiscalizacoes', {
      ...this.current,
      Status_Fiscalizacao: 'CANCELADA',
      Motivo_Cancelamento: reason.trim(),
      Data_Atualizacao: new Date().toISOString()
    }, { operation: 'UPDATE' });
    await App.updateSyncStatus();
    App.showMessage('Fiscalização cancelada. O registro foi preservado.', 'success');
    await this.renderWorkspace();
  },

  async reopen() {
    if (!confirm('Reabrir para edição? Ao finalizar novamente, será emitida uma nova versão do termo e a atual ficará como substituída.')) return;
    await saveLocalRecord('fiscalizacoes', {
      ...this.current,
      Status_Fiscalizacao: 'EM_ANDAMENTO',
      Data_Atualizacao: new Date().toISOString()
    }, { operation: 'UPDATE' });
    await App.updateSyncStatus();
    await this.renderWorkspace();
  },


  /* =======================================================
     EVENTOS
  ======================================================= */

  bindWorkspace(data) {
    const bindForm = (id, fn) => {
      const form = document.getElementById(id);
      if (!form) return;
      form.onsubmit = async event => {
        event.preventDefault();
        const submit = form.querySelector('[type=submit]');
        if (submit) submit.disabled = true;
        try {
          await fn(form);
        } catch (error) {
          console.error(error);
          App.showMessage('Não foi possível salvar. Tente novamente.', 'error');
        }
        if (submit && document.body.contains(submit)) submit.disabled = false;
      };
    };

    bindForm('fzSampleForm', () => this.saveSample());
    bindForm('fzActForm', () => this.saveAction());
    bindForm('fzPhotoForm', () => this.savePhoto());
    bindForm('fzConclForm', () => this.saveConclusion(true));
    document.querySelectorAll('[data-occ-form]').forEach(form => {
      form.onsubmit = async e => {
        e.preventDefault();
        await this.saveOccurrenceDetails(form);
      };
    });

    if (!this.isEditable()) return;

    document.querySelectorAll('.fz-result').forEach(el => {
      el.onchange = async () => {
        el.className = `fz-result fz-result-${el.value}`;
        await this.setResult(el);
      };
    });

    document.querySelectorAll('.fz-mini').forEach(el => {
      el.onchange = () => this.saveCultureMetric(el);
    });

    document.querySelectorAll('.fz-dyn').forEach(el => {
      el.onchange = async () => {
        await this.saveDynamic(el);
        this.applyConditions();
      };
    });
    this.applyConditions();

    document.querySelectorAll('[data-add-pest]').forEach(btn => {
      btn.onclick = () => this.addOtherPest(btn.dataset.addPest);
    });

    if (!document.getElementById('fzAllPests')) {
      const dl = document.createElement('datalist');
      dl.id = 'fzAllPests';
      document.getElementById('fzWorkspace').appendChild(dl);
    }
    document.getElementById('fzAllPests').innerHTML = [...this.cat.pragas.values()]
      .map(p => `<option value="${this.esc(p.nome)}">${this.esc(p.cientifico)}</option>`).join('');

    const code = document.getElementById('fzSmpCod');
    if (code) {
      const base = String(this.current.Numero_Fiscalizacao || '').replace(/^TF-/, 'AM-');
      code.value = `${base}-${String(data.samples.length + 1).padStart(2, '0')}`;
    }

    this.initSignaturePad('fzSignFiscal');
    this.initSignaturePad('fzSignResp');
  },


  /* =======================================================
     TERMO DE FISCALIZAÇÃO (impressão / PDF)
  ======================================================= */

  async printTerm() {
    const win = window.open('', '_blank');
    if (!win) {
      App.showMessage('Permita pop-ups para abrir o termo.', 'warning');
      return;
    }

    const f = this.current;
    const data = await this.loadAll();
    const doc = await this.getDocument();
    const signs = doc ? (await dbGetAll('assinaturas')).filter(a => a.ID_Documento_Local === doc.id) : [];
    const e = v => this.esc(v ?? '');
    const table = (headers, rows) => rows.length
      ? `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<p class="none">Nenhum registro.</p>';

    const programs = this.selectedPrograms().map(id => this.cat.programas.get(id)).filter(Boolean);
    const evaluated = data.occs.filter(o => o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA');
    const sign = tipo => signs.find(s => (tipo === 'SERVIDOR') === (s.Tipo_Assinante === 'SERVIDOR'));
    const signBlock = (s, fallbackName, role) => `
      <div class="sig">
        ${s?.Assinatura ? `<img src="${e(s.Assinatura)}">` : `<div class="sig-empty">${s?.Status_Assinatura === 'RECUSADO' ? 'Recusou-se a assinar' : ''}</div>`}
        <div class="line">${e(s?.Nome_Assinante || fallbackName)}<br><small>${e(role)}</small></div>
      </div>`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${e(doc?.Numero_Documento || f.Numero_Fiscalizacao)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
        h1{font-size:16px;margin:0}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
        .head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #176b3a;padding-bottom:8px}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
        th{background:#eef5f0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}.none{color:#666}
        .photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.photos img{width:100%;border:1px solid #ccc}
        .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;text-align:center}
        .sig img{height:70px;max-width:100%}.sig-empty{height:70px;display:flex;align-items:flex-end;justify-content:center;color:#a00}
        .line{border-top:1px solid #000;padding-top:4px}.draft{color:#a00;font-weight:bold}
        .foot{margin-top:24px;font-size:10px;color:#555;word-break:break-all}
        @media print{button{display:none}body{margin:10mm}}
      </style></head><body>
      <button onclick="print()" style="float:right;padding:8px 14px">Imprimir / salvar PDF</button>
      <div class="head">
        <div><h1>TERMO DE FISCALIZAÇÃO FITOSSANITÁRIA</h1><div>Gerência de Defesa Vegetal — Estado do Amazonas</div></div>
        <div style="text-align:right"><strong>Nº ${e(doc?.Numero_Documento || f.Numero_Fiscalizacao)}</strong><br>
          ${doc ? `Versão ${e(doc.Versao_Documento)} • emitido em ${this.formatDateTime(doc.Data_Hora_Emissao)}` : '<span class="draft">PRÉVIA — NÃO EMITIDO</span>'}</div>
      </div>

      <h2>1. Identificação</h2>
      <div class="grid">
        <div><b>Produtor:</b> ${e(f.Nome_Produtor_Local)}</div>
        <div><b>CPF/CNPJ:</b> ${e(this.producer?.CPF_CNPJ || '')}</div>
        <div><b>Propriedade:</b> ${e(f.Nome_Propriedade_Local)}</div>
        <div><b>Código oficial:</b> ${e(this.property?.Codigo_Propriedade_Oficial || '—')}</div>
        <div><b>Município/UF:</b> ${e(f.Municipio)} - AM</div>
        <div><b>Localidade:</b> ${e(this.property?.Comunidade_Localidade || '—')}</div>
        <div><b>Início:</b> ${this.formatDateTime(f.Data_Hora_Inicio)}</div>
        <div><b>Término:</b> ${this.formatDateTime(f.Data_Hora_Final)}</div>
        <div><b>Tipo de ação:</b> ${e(this.label(this.TIPOS_ACAO, f.Tipo_Acao))}</div>
        <div><b>Coordenadas:</b> ${f.Latitude_Fiscalizacao !== '' && f.Latitude_Fiscalizacao != null ? e(f.Latitude_Fiscalizacao) + ', ' + e(f.Longitude_Fiscalizacao) : '—'}</div>
        <div><b>Responsável presente:</b> ${e(f.Responsavel_Presente)} (${e(this.label(this.VINCULOS, f.Vinculo_Responsavel))})</div>
        <div><b>Fiscal:</b> ${e(f.Nome_Servidor)}${f.Matricula_Servidor ? ' — mat. ' + e(f.Matricula_Servidor) : ''}</div>
      </div>
      ${programs.length ? `<p><b>Programa(s):</b> ${programs.map(p => e(this.programLabel(p)) + (p.legislacao ? ` (${e(p.legislacao)})` : '')).join('; ')}</p>` : ''}
      ${f.Finalidade ? `<p><b>Finalidade:</b> ${e(f.Finalidade)}</p>` : ''}

      <h2>2. Culturas fiscalizadas</h2>
      ${table(['Cultura', 'Área fiscalizada (ha)', 'Plantas avaliadas'],
        data.cults.map(c => [c.Nome_Cultura_Local, c.Area_Fiscalizada_ha, c.Quantidade_Plantas_Avaliadas]))}
      ${data.dados.filter(d => d.Valor !== '').length ? table(['Cultura', 'Item verificado', 'Resposta'],
        data.dados.filter(d => d.Valor !== '').map(d => [data.cults.find(c => c.id === d.ID_Fiscalizacao_Cultura_Local)?.Nome_Cultura_Local || '', d.Rotulo_Campo || d.Nome_Campo, d.Valor])) : ''}

      <h2>3. Pragas avaliadas</h2>
      ${table(['Cultura', 'Praga', 'Resultado', 'Nível', 'Sintomas / observações'],
        evaluated.map(o => [o.Nome_Cultura_Local, `${o.Nome_Praga}${o.Nome_Cientifico ? ' (' + o.Nome_Cientifico + ')' : ''}`,
          this.label(this.RESULTADOS, o.Resultado_Avaliacao), this.label(this.NIVEIS, o.Nivel_Infestacao) === '—' ? '' : this.label(this.NIVEIS, o.Nivel_Infestacao),
          [o.Sintomas_Observados, o.Observacoes].filter(Boolean).join(' — ')]))}

      <h2>4. Amostras coletadas</h2>
      ${table(['Identificação', 'Lacre', 'Material', 'Qtde.', 'Praga / cultura', 'Laboratório'],
        data.samples.map(s => [s.Identificacao_Amostra, s.Numero_Lacre, s.Tipo_Material, `${s.Quantidade ?? ''} ${s.Unidade || ''}`, [s.Nome_Praga_Relacionada, s.Nome_Cultura_Local].filter(Boolean).join(' — '), s.Laboratorio_Destino]))}

      <h2>5. Providências determinadas</h2>
      ${table(['Tipo', 'Nº', 'Descrição', 'Prazo'],
        data.actions.map(a => [this.label(this.PROVIDENCIAS, a.Tipo_Providencia), a.Numero_Documento, a.Descricao, a.Prazo ? this.formatDate(a.Prazo) : '']))}

      <h2>6. Conclusão</h2>
      <p><b>Situação fitossanitária:</b> ${e(this.label(this.SITUACOES, f.Situacao_Fitossanitaria))}</p>
      <p>${e(f.Observacoes || '')}</p>

      ${data.photos.some(p => p.Foto && p.Incluir_PDF !== 'NAO') ? `<h2>7. Evidências fotográficas</h2><div class="photos">${
        data.photos.filter(p => p.Foto && p.Incluir_PDF !== 'NAO').map(p => `<figure style="margin:0"><img src="${e(p.Foto)}"><figcaption>${e(p.Legenda)}</figcaption></figure>`).join('')}</div>` : ''}

      <div class="sigs">
        ${signBlock(sign('SERVIDOR'), f.Nome_Servidor, 'Fiscal responsável')}
        ${signBlock(sign('OUTRO'), f.Responsavel_Presente, this.label(this.VINCULOS, f.Vinculo_Responsavel))}
      </div>

      ${doc?.Hash_Documento ? `<div class="foot">Código de integridade (SHA-256): ${e(doc.Hash_Documento)}</div>` : ''}
      </body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }
};
