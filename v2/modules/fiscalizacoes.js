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

  ENTREGA_VIA: [
    ['EM_MAOS', 'Entregue impressa, em mãos'],
    ['DIGITAL', 'Enviada em formato digital (WhatsApp / e-mail)'],
    ['POSTERIOR', 'Será entregue posteriormente'],
    ['RECUSOU', 'Recusou-se a receber']
  ],

  CARGO_PADRAO: 'Fiscal Estadual Agropecuário',

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
      return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(', ', ' ');
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
    return this.current && this.status(this.current) === 'EM_ANDAMENTO' && this.canManage(this.current);
  },

  /* Perfil: gerência altera qualquer; fiscal, as próprias ou em que está na equipe */
  canManage(f) {
    if (!Auth.can('fiscalizar')) return false;
    if (Auth.can('gestao')) return true;
    const me = Auth.currentServerId();
    if (!f.ID_Servidor || f.ID_Servidor === me) return true;
    return this.getTeam(f).some(m => m.ID_Servidor && m.ID_Servidor === me);
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
    const listas = await dbGetAll('listasApoio');

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
      campoCult: campoCult.filter(r => this.yes(r.Ativo)),
      listas
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
          <button type="button" class="btn btn-secondary" onclick="Nav.back()">← Voltar</button>
          <div>
            <h2>Fiscalizações</h2>
            <p>Termos de fiscalização vinculados ao produtor, à propriedade e às culturas cadastradas.</p>
          </div>
        </div>

        <div id="fzListControls">
          <div class="module-actions">
            ${Auth.can('fiscalizar') ? '' : '<div class="fz-hint-card">👁 Seu perfil permite consultar as fiscalizações. Para registrar, peça ao administrador o perfil Fiscal.</div>'}
            <button type="button" class="action-card" onclick="FiscalizacoesModule.startNew()" ${Auth.can('fiscalizar') ? '' : 'hidden'}>
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
    if (!Auth.can('fiscalizar')) {
      App.showMessage('Seu perfil não permite registrar fiscalizações.', 'warning');
      return;
    }
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
    NumberPool.available().then(n => {
      el.textContent += ` • ${n} nº de termo reservado(s)`;
    });
  },

  async refreshCatalogs() {
    if (!navigator.onLine) {
      App.showMessage('Sem internet. O app usa o catálogo já salvo no aparelho.', 'warning');
      return;
    }
    try {
      await syncCatalogs();
      await NumberPool.ensure();
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
    if (!Auth.can('fiscalizar')) {
      App.showMessage('Seu perfil não permite registrar fiscalizações.', 'warning');
      return;
    }
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
          <button type="button" class="btn btn-secondary" onclick="Nav.back()">Cancelar</button>
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

    this._servers = (await dbGetAll('servidores'))
      .filter(sv => sv.Nome_Completo && String(sv.Status || 'ATIVO').toUpperCase() !== 'INATIVO')
      .sort((a, b) => String(a.Nome_Completo).localeCompare(String(b.Nome_Completo), 'pt-BR'));
    this._team = this.getTeam(f);

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
                <small>${this.esc(existing ? (existing.Cargo_Servidor || this.CARGO_PADRAO) : (user?.Cargo_Funcao || this.CARGO_PADRAO))}${(existing ? existing.Matricula_Servidor : user?.Matricula) ? ' • mat. ' + this.esc(existing ? existing.Matricula_Servidor : user?.Matricula) : ''}</small>
                <small></small>
              </div>
            </div>

            <div class="field field-wide">
              <label for="fzTeamSel">Outros servidores na atividade</label>
              <div id="fzTeamChips" class="fz-chips"></div>
              <div class="fz-row">
                <select id="fzTeamSel" class="fz-select" style="flex:1">
                  <option value="">Selecione um servidor</option>
                  ${(this._servers || []).filter(sv => sv.ID_Servidor !== (existing?.ID_Servidor || user?.ID_Servidor)).map(sv => `<option value="${this.esc(sv.ID_Servidor)}">${this.esc(sv.Nome_Completo)}${sv.Matricula ? ' — ' + this.esc(sv.Matricula) : ''}</option>`).join('')}
                  <option value="__OUTRO__">Outro (digitar nome)</option>
                </select>
                <button type="button" class="btn btn-secondary fz-small" id="fzTeamAdd">Adicionar</button>
              </div>
              <div class="fz-row fz-mt" id="fzTeamManual" hidden>
                <input id="fzTeamNome" placeholder="Nome completo" maxlength="150" style="flex:2">
                <input id="fzTeamMat" placeholder="Matrícula" maxlength="40" style="flex:1">
              </div>
              <small>Servidores que acompanharam a fiscalização. Aparecem no termo junto ao fiscal responsável.</small>
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

    this.renderTeamChips();
    const teamSel = document.getElementById('fzTeamSel');
    teamSel.onchange = () => {
      document.getElementById('fzTeamManual').hidden = teamSel.value !== '__OUTRO__';
    };
    document.getElementById('fzTeamAdd').onclick = () => this.addTeamMember();

    document.getElementById('fzGeneralForm').onsubmit = event => {
      event.preventDefault();
      this.saveGeneral(existing, cultures);
    };
  },

  /* Área e nº de plantas vindos do cadastro da cultura (editáveis) */
  cultureDefaults(culture) {
    const n = v => {
      const t = String(v ?? '').trim().replace(',', '.');
      return t === '' || isNaN(Number(t)) ? '' : Number(t);
    };
    return {
      Area_Fiscalizada_ha: n(culture?.Area_Plantada_ha) !== '' ? n(culture.Area_Plantada_ha) : n(culture?.Area_Producao_ha),
      Quantidade_Plantas_Avaliadas: n(culture?.Quantidade_Plantas)
    };
  },

  /* Completa culturas já incluídas que ficaram sem área/plantas */
  async fillCultureDefaults() {
    if (!this.isEditable()) return;
    for (const fc of await this.getChildren('fiscalizacaoCulturas')) {
      if ((fc.Area_Fiscalizada_ha !== '' && fc.Area_Fiscalizada_ha != null) ||
          (fc.Quantidade_Plantas_Avaliadas !== '' && fc.Quantidade_Plantas_Avaliadas != null)) continue;
      const culture = await dbGet('culturas', fc.ID_Cultura_Local);
      const def = this.cultureDefaults(culture);
      if (def.Area_Fiscalizada_ha === '' && def.Quantidade_Plantas_Avaliadas === '') continue;
      await this.saveChild('fiscalizacaoCulturas', { ...fc, ...def });
    }
  },

  /* ---------- Equipe ---------- */

  getTeam(f) {
    const raw = f?.Equipe_Servidores;
    if (Array.isArray(raw)) return raw.slice();
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  teamNames(f) {
    return this.getTeam(f).map(m => m.Nome_Completo + (m.Matricula ? ` (mat. ${m.Matricula})` : '')).join('; ');
  },

  renderTeamChips() {
    const box = document.getElementById('fzTeamChips');
    if (!box) return;
    box.innerHTML = this._team.length
      ? this._team.map((m, i) => `<span class="fz-chip">👤 ${this.esc(m.Nome_Completo)}${m.Matricula ? ' <small>' + this.esc(m.Matricula) + '</small>' : ''}
          <button type="button" aria-label="Remover" onclick="FiscalizacoesModule.removeTeamMember(${i})">✕</button></span>`).join('')
      : '<span class="fz-muted">Nenhum outro servidor vinculado.</span>';
  },

  addTeamMember() {
    const sel = document.getElementById('fzTeamSel');
    let member = null;
    if (sel.value === '__OUTRO__') {
      const nome = this.val('fzTeamNome');
      if (!nome) {
        App.showMessage('Informe o nome do servidor.', 'warning');
        return;
      }
      member = { ID_Servidor: '', Nome_Completo: nome, Matricula: this.val('fzTeamMat'), Cargo_Funcao: '' };
      document.getElementById('fzTeamNome').value = '';
      document.getElementById('fzTeamMat').value = '';
    } else if (sel.value) {
      const sv = this._servers.find(x => String(x.ID_Servidor) === sel.value);
      member = { ID_Servidor: sv.ID_Servidor, Nome_Completo: sv.Nome_Completo, Matricula: sv.Matricula || '', Cargo_Funcao: sv.Cargo_Funcao || '' };
    } else {
      App.showMessage('Selecione o servidor.', 'warning');
      return;
    }
    if (this._team.some(m => (m.ID_Servidor && m.ID_Servidor === member.ID_Servidor) || m.Nome_Completo.toLowerCase() === member.Nome_Completo.toLowerCase())) {
      App.showMessage('Esse servidor já está na equipe.', 'warning');
      return;
    }
    this._team.push(member);
    sel.value = '';
    document.getElementById('fzTeamManual').hidden = true;
    this.renderTeamChips();
  },

  removeTeamMember(i) {
    this._team.splice(i, 1);
    this.renderTeamChips();
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
      Cargo_Servidor: existing ? (existing.Cargo_Servidor || this.CARGO_PADRAO) : (user?.Cargo_Funcao || this.CARGO_PADRAO),
      Equipe_Servidores: this._team || [],
      Nomes_Equipe: (this._team || []).map(m => m.Nome_Completo + (m.Matricula ? ` (mat. ${m.Matricula})` : '')).join('; '),

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
          ...this.cultureDefaults(culture),
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
    await this.fillCultureDefaults();
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
    this.pendingResp = await getMeta(this.respSignKey());
    this.pendingWitnesses = (await getMeta(this.witnessKey())) || [];
    this.poolCount = await NumberPool.available();

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
          <button type="button" class="btn btn-secondary" onclick="Nav.back()">← Voltar</button>
          ${editable ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.editGeneral()">✏️ Dados gerais e culturas</button>` : ''}
          <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.printTerm()">🖨️ ${doc ? 'Termo de Fiscalização' : 'Prévia do termo'}</button>
          ${!editable && this.status(f) === 'FINALIZADA' && this.canManage(f) ? `<button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.reopen()">Reabrir para edição</button>` : ''}
          ${this.status(f) === 'EM_ANDAMENTO' && !this.canManage(f) ? `<span class="fz-muted">Em andamento por ${this.esc(f.Nome_Servidor || 'outro servidor')} — somente consulta.</span>` : ''}
        </div>

        ${this.sectionCultures(data, editable)}
        ${this.positiveOccs(data).length || data.samples.length || data.actions.length
          ? this.sectionSamples(data, editable) + this.sectionActions(data, editable)
          : `<section class="subsection"><div class="fz-hint-card">🧪📄 <span><b>Amostras e providências</b> ficam disponíveis quando alguma praga for marcada como <b>suspeita</b> ou <b>detectada</b>.</span></div></section>`}
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

  sectionHeader(title, count, action, actionLabel, editable) {
    return `
      <div class="fz-section-header">
        <h4>${title} <span class="fz-count">${count}</span></h4>
        ${editable && action ? `<button type="button" class="btn btn-secondary fz-small" onclick="${action}">${actionLabel || '+ Adicionar'}</button>` : ''}
      </div>`;
  },

  /*
    Janela (folha) para formulários secundários.
    Em celular ocupa a tela inteira; no computador fica centralizada.
  */
  openSheet({ title, subtitle = '', body, submitLabel = 'Salvar', submitId = '', onSubmit, readOnly = false }) {
    const overlay = document.createElement('div');
    overlay.className = 'fz-sheet-overlay';
    overlay.innerHTML = `
      <form class="fz-sheet" novalidate>
        <div class="fz-sheet-head">
          <div>
            <h3>${title}</h3>
            ${subtitle ? `<p>${subtitle}</p>` : ''}
          </div>
          <button type="button" class="fz-sheet-close" aria-label="Fechar">✕</button>
        </div>
        <div class="fz-sheet-body">${body}</div>
        <div class="fz-sheet-foot">
          <button type="button" class="btn btn-secondary" data-close>${readOnly ? 'Fechar' : 'Cancelar'}</button>
          ${readOnly ? '' : `<button type="submit" class="btn btn-primary" ${submitId ? `id="${submitId}"` : ''}>${submitLabel}</button>`}
        </div>
      </form>`;

    document.body.appendChild(overlay);
    document.body.classList.add('fz-sheet-open');

    const form = overlay.querySelector('form');
    const close = () => {
      overlay.remove();
      if (!document.querySelector('.fz-sheet-overlay')) document.body.classList.remove('fz-sheet-open');
    };

    overlay.querySelector('.fz-sheet-close').onclick = close;
    overlay.querySelector('[data-close]').onclick = close;

    form.onsubmit = async event => {
      event.preventDefault();
      if (readOnly) return;
      const missing = [...form.querySelectorAll('[required]')].find(el => !String(el.value || '').trim());
      if (missing) {
        missing.focus();
        App.showMessage('Preencha os campos obrigatórios (*).', 'warning');
        return;
      }
      const submit = form.querySelector('[type=submit]');
      if (submit) submit.disabled = true;
      try {
        const result = await onSubmit(form);
        if (result !== false) {
          close();
          return;
        }
      } catch (error) {
        console.error(error);
        App.showMessage('Não foi possível salvar. Tente novamente.', 'error');
      }
      if (submit) submit.disabled = false;
    };

    setTimeout(() => {
      const first = form.querySelector('.fz-sheet-body input:not([type=hidden]), .fz-sheet-body select, .fz-sheet-body textarea');
      if (first && !first.value) first.focus();
    }, 50);

    return { overlay, form, close };
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
      return this.pestRow(fc, p, occ, editable, data);
    }).join('');

    return `
      <div class="fz-culture">
        <div class="fz-culture-head">
          <strong>${this.esc(fc.Nome_Cultura_Local)}</strong>
          <div class="fz-row fz-culture-metrics">
            <label title="Preenchido a partir do cadastro da cultura; pode ser alterado">Área fiscalizada (ha)
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
        }, o, editable, data)).join('')}

        ${!pests.doPrograma.length && !pests.outras.length && !extraOccs.length ? `
          <div class="empty-state">Nenhuma praga vinculada a esta cultura na aba Praga_Cultura.</div>` : ''}

        ${editable ? `
          <div class="fz-add-other">
            <input list="fzAllPests" placeholder="Outra praga nesta cultura..." id="fzOther_in_${this.esc(fc.id)}">
            <button type="button" class="btn btn-secondary fz-small" data-add-pest="${this.esc(fc.id)}">Adicionar</button>
          </div>` : ''}
      </div>`;
  },

  pestRow(fc, pest, occ, editable, data) {
    const result = occ?.Resultado_Avaliacao || 'NAO_AVALIADA';
    const positive = result === 'SUSPEITA' || result === 'DETECTADA';
    const key = `${fc.id}__${pest.id || occ?.id}`;
    const prog = pest.programa ? this.cat.programas.get(pest.programa) : null;

    let detail = '';
    if (positive && occ) {
      const samples = (data?.samples || []).filter(s => s.ID_Ocorrencia_Local === occ.id).length;
      const summary = [
        occ.Nivel_Infestacao ? 'Nível ' + this.label(this.NIVEIS, occ.Nivel_Infestacao).toLowerCase() : '',
        occ.Distribuicao_Ocorrencia ? this.label(this.DISTRIBUICAO, occ.Distribuicao_Ocorrencia) : '',
        occ.Incidencia_Percentual !== '' && occ.Incidencia_Percentual != null ? occ.Incidencia_Percentual + '% incidência' : '',
        occ.Latitude_Ocorrencia ? '📍 foco georreferenciado' : '',
        samples ? `🧪 ${samples} amostra(s)` : ''
      ].filter(Boolean).join(' • ');

      detail = `
        <div class="fz-occ-bar">
          <span class="${occ.Sintomas_Observados ? '' : 'fz-missing'}">${occ.Sintomas_Observados
            ? this.esc(summary || 'Detalhes registrados')
            : '⚠️ Detalhes da ocorrência não preenchidos'}</span>
          <div class="fz-occ-actions">
            <button type="button" class="btn btn-secondary fz-small" data-occ-detail="${this.esc(occ.id)}">📝 ${editable ? 'Detalhar' : 'Ver detalhes'}</button>
            ${editable ? `<button type="button" class="btn btn-secondary fz-small" data-occ-sample="${this.esc(occ.id)}">🧪 Coletar amostra</button>` : ''}
          </div>
        </div>`;
    }

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
        ${detail}
      </div>`;
  },

  async openOccurrenceSheet(occId) {
    const o = await dbGet('ocorrenciasPragas', occId);
    if (!o) return;
    const editable = this.isEditable();
    const dis = editable ? '' : 'disabled';

    this.openSheet({
      title: `${this.esc(o.Nome_Praga)} — ${this.label(this.RESULTADOS, o.Resultado_Avaliacao)}`,
      subtitle: `${this.esc(o.Nome_Cultura_Local)}${o.Nome_Cientifico ? ' • <em>' + this.esc(o.Nome_Cientifico) + '</em>' : ''}`,
      submitLabel: 'Salvar detalhes',
      readOnly: !editable,
      body: `
        <div class="form-grid">
          <div class="field field-wide">
            <label>Sintomas / sinais observados *</label>
            <textarea name="Sintomas_Observados" rows="3" maxlength="1000" required ${dis}>${this.esc(o.Sintomas_Observados || '')}</textarea>
          </div>
          <div class="field"><label>Nível de infestação</label>
            <select name="Nivel_Infestacao" ${dis}>${this.options(this.NIVEIS, o.Nivel_Infestacao)}</select></div>
          <div class="field"><label>Distribuição</label>
            <select name="Distribuicao_Ocorrencia" ${dis}>${this.options(this.DISTRIBUICAO, o.Distribuicao_Ocorrencia)}</select></div>
          <div class="field"><label>Incidência estimada (%)</label>
            <input name="Incidencia_Percentual" type="number" min="0" max="100" step="0.1" value="${this.esc(o.Incidencia_Percentual ?? '')}" ${dis}></div>
          <div class="field"><label>Há quanto tempo ocorre</label>
            <input name="Tempo_Ocorrencia" maxlength="100" value="${this.esc(o.Tempo_Ocorrencia || '')}" ${dis}></div>
          <div class="field field-wide"><label>Método de controle utilizado pelo produtor</label>
            <input name="Metodo_Controle" maxlength="200" value="${this.esc(o.Metodo_Controle || '')}" ${dis}></div>
          <div class="field"><label>Latitude do foco</label>
            <input name="Latitude_Ocorrencia" id="occLat" inputmode="decimal" value="${this.esc(o.Latitude_Ocorrencia ?? '')}" ${dis}></div>
          <div class="field"><label>Longitude do foco</label>
            <input name="Longitude_Ocorrencia" id="occLng" inputmode="decimal" value="${this.esc(o.Longitude_Ocorrencia ?? '')}" ${dis}></div>
          ${editable ? `<div class="field field-wide">
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.captureGPS('occLat','occLng','occGps')">📍 Capturar ponto do foco</button>
            <small id="occGps"></small></div>` : ''}
          <div class="field field-wide"><label>Observações</label>
            <input name="Observacoes" maxlength="500" value="${this.esc(o.Observacoes || '')}" ${dis}></div>
        </div>
        ${o.Legislacao ? `<p class="fz-legal">⚖️ ${this.esc(o.Legislacao)}</p>` : ''}`,
      onSubmit: form => this.saveOccurrenceDetails(form, occId)
    });
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
    const wasPositive = occ.Resultado_Avaliacao === 'SUSPEITA' || occ.Resultado_Avaliacao === 'DETECTADA';
    occ.Resultado_Avaliacao = result;
    const isPositive = result === 'SUSPEITA' || result === 'DETECTADA';

    const saved = await this.saveChild('ocorrenciasPragas', occ, [{ entity: 'fiscalizacaoCulturas', recordId: fc.id }]);
    if (isPositive || wasPositive || el.dataset.occ === '') {
      await this.renderWorkspace();
    }
    // Ao marcar suspeita/detectada, já abre a janela de detalhes
    if (isPositive && !wasPositive && !saved.Sintomas_Observados) {
      await this.openOccurrenceSheet(saved.id);
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
    await this.renderWorkspace();
    await this.openOccurrenceSheet(id);
  },

  async saveOccurrenceDetails(form, occId) {
    const occ = await dbGet('ocorrenciasPragas', occId);
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
    return `
      <section class="subsection">
        ${this.sectionHeader('🧪 Amostras', data.samples.length, 'FiscalizacoesModule.openSampleSheet()', '🧪 Coletar amostra', editable)}
        ${data.samples.length ? data.samples.map(s => `
          <div class="mini-card fz-item">
            <div>
              <strong>${this.esc(s.Identificacao_Amostra)} — ${this.esc(s.Tipo_Material)}</strong>
              <span>${[s.Nome_Praga_Relacionada, s.Nome_Cultura_Local,
                s.Quantidade !== '' && s.Quantidade != null ? s.Quantidade + ' ' + (s.Unidade || '') : '',
                s.Numero_Lacre ? 'Lacre ' + s.Numero_Lacre : '', s.Laboratorio_Destino].filter(Boolean).map(v => this.esc(v)).join(' • ')}</span>
            </div>
            ${this.removeButton('amostras', s.id, editable)}
          </div>`).join('') + `
          <button type="button" class="btn btn-secondary fz-small fz-mt" onclick="FiscalizacoesModule.printSampleTerm()">🖨️ Termo de Coleta de Amostra</button>`
        : `<div class="empty-state">Nenhuma amostra coletada.</div>`}
      </section>`;
  },

  async openSampleSheet(preselectOccId = '') {
    const data = await this.loadAll();
    const occs = this.positiveOccs(data);
    const base = String(this.current.Numero_Fiscalizacao || '').replace(/^TF-/, 'AM-');
    const pre = preselectOccId ? 'occ:' + preselectOccId : (occs.length === 1 ? 'occ:' + occs[0].id : '');

    this.openSheet({
      title: '🧪 Coleta de amostra',
      subtitle: `${this.esc(this.current.Nome_Propriedade_Local)} • ${this.esc(this.current.Numero_Fiscalizacao)}`,
      submitLabel: 'Registrar amostra',
      body: `
        <div class="form-grid">
          <div class="field field-wide">
            <label for="fzSmpOcc">Praga suspeita / detectada *</label>
            <select id="fzSmpOcc" required>
              ${this.options(occs.map(o => ['occ:' + o.id, this.occLabel(o)]), pre)}
            </select>
          </div>
          <div class="field"><label for="fzSmpCod">Identificação da amostra *</label>
            <input id="fzSmpCod" required maxlength="60" value="${this.esc(`${base}-${String(data.samples.length + 1).padStart(2, '0')}`)}"></div>
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
          <div class="field"><label for="fzSmpAnalise">Análise solicitada</label>
            <input id="fzSmpAnalise" maxlength="150" placeholder="Ex.: diagnose, identificação"></div>
          <div class="field field-wide"><label for="fzSmpObs">Observações (acondicionamento, conservação)</label>
            <input id="fzSmpObs" maxlength="500"></div>
        </div>`,
      onSubmit: () => this.saveSample()
    });
  },

  async saveSample() {
    const ref = this.val('fzSmpOcc');
    if (!ref || !this.val('fzSmpCod') || !this.val('fzSmpMat')) {
      App.showMessage('Informe a ocorrência/cultura, a identificação e o material.', 'warning');
      return false;
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
      Analise_Solicitada: this.val('fzSmpAnalise'),
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
    return `
      <section class="subsection">
        ${this.sectionHeader('📄 Providências', data.actions.length, 'FiscalizacoesModule.openActionSheet()', '+ Providência', editable)}
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

  async openActionSheet() {
    const data = await this.loadAll();
    const occs = this.positiveOccs(data);
    this.openSheet({
      title: '📄 Nova providência',
      subtitle: this.esc(this.current.Nome_Propriedade_Local),
      submitLabel: 'Registrar providência',
      body: `
        <div class="form-grid">
          <div class="field"><label for="fzActTipo">Tipo *</label>
            <select id="fzActTipo" required>${this.options(this.PROVIDENCIAS)}</select></div>
          <div class="field"><label for="fzActOcc">Ocorrência relacionada</label>
            <select id="fzActOcc">${this.options(occs.map(o => [o.id, this.occLabel(o)]), occs.length === 1 ? occs[0].id : '', 'Nenhuma')}</select></div>
          <div class="field field-wide"><label for="fzActDesc">Descrição / medida determinada *</label>
            <textarea id="fzActDesc" rows="4" required maxlength="1500"></textarea></div>
          <div class="field"><label for="fzActPrazo">Prazo para cumprimento</label>
            <input id="fzActPrazo" type="date"></div>
          <div class="field"><label for="fzActNum">Nº do documento</label>
            <input id="fzActNum" maxlength="60"></div>
        </div>`,
      onSubmit: () => this.saveAction()
    });
  },

  async saveAction() {
    if (!this.val('fzActTipo') || !this.val('fzActDesc')) {
      App.showMessage('Informe tipo e descrição.', 'warning');
      return false;
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
    return `
      <section class="subsection">
        ${this.sectionHeader('📷 Evidências fotográficas', data.photos.length, 'FiscalizacoesModule.openPhotoSheet()', '📷 Registrar evidência', editable)}
        ${data.photos.length ? `<div class="fz-gallery">${data.photos.map(p => `
          <figure class="fz-photo">
            ${p.Foto ? `<img src="${this.esc(p.Foto)}" alt="${this.esc(p.Legenda || 'Evidência')}">`
              : (p.Arquivo_URL || p.Foto_URL) ? `<a href="${this.esc(p.Arquivo_URL || p.Foto_URL)}" target="_blank" rel="noopener" class="fz-photo-link">Ver foto no Drive</a>`
              : '<div class="fz-photo-link">Foto indisponível</div>'}
            <figcaption>${this.esc(p.Legenda || p.Descricao || 'Sem legenda')}
              ${p.Nome_Praga_Relacionada ? `<br><small>${this.esc(p.Nome_Praga_Relacionada)}</small>` : ''}
              <br><small>${p.Data_Hora_Captura ? this.formatDateTime(p.Data_Hora_Captura) : ''}${p.Latitude !== '' && p.Latitude != null ? ` • ${p.Latitude}, ${p.Longitude}` : ''}</small>
              ${this.removeButton('evidencias', p.id, editable)}</figcaption>
          </figure>`).join('')}</div>` : `<div class="empty-state">Nenhuma foto registrada.</div>`}
      </section>`;
  },

  async openPhotoSheet() {
    const data = await this.loadAll();
    const occs = this.positiveOccs(data);
    this._photo = null;

    const { form } = this.openSheet({
      title: '📷 Evidência fotográfica',
      subtitle: this.esc(this.current.Nome_Propriedade_Local),
      submitLabel: 'Salvar evidência',
      submitId: 'fzPhotoBtn',
      body: `
        <div class="fz-pick-row" id="fzPickRow">
          <label class="fz-pick">
            <input type="file" accept="image/*" capture="environment" id="fzCam" hidden>
            <span class="fz-pick-icon">📸</span><strong>Tirar foto</strong><small>Usa a câmera e a localização atual</small>
          </label>
          <label class="fz-pick">
            <input type="file" accept="image/*" id="fzGal" hidden>
            <span class="fz-pick-icon">🖼️</span><strong>Enviar da galeria</strong><small>Usa a data e o GPS da foto, quando houver</small>
          </label>
        </div>

        <div id="fzPhotoStage" hidden>
          <img id="fzPhotoPreview" class="fz-photo-preview fz-photo-stage" alt="">
          <div class="fz-photo-meta" id="fzPhotoMeta"></div>
          <button type="button" class="fz-link" id="fzPhotoRedo">↺ Escolher outra foto</button>
        </div>

        <div class="form-grid fz-mt">
          <div class="field"><label for="fzPhotoRef">Relacionada a</label>
            <select id="fzPhotoRef">${this.options(occs.map(o => ['occ:' + o.id, this.occLabel(o)]).concat(data.cults.map(c => ['fc:' + c.id, 'Cultura — ' + c.Nome_Cultura_Local])), occs.length === 1 ? 'occ:' + occs[0].id : '', 'Fiscalização em geral')}</select></div>
          <div class="field"><label for="fzPhotoDesc">Legenda</label>
            <input id="fzPhotoDesc" maxlength="200" placeholder="Ex.: frutos com sintomas"></div>
          <div class="field field-wide">
            <label class="fz-check-inline"><input type="checkbox" id="fzPhotoPdf" checked> Incluir no Termo</label>
          </div>
        </div>`,
      onSubmit: () => this.savePhoto()
    });

    const handle = async (input, origem) => {
      const file = input.files?.[0];
      if (!file) return;
      form.querySelector('#fzPickRow').hidden = true;
      form.querySelector('#fzPhotoStage').hidden = false;
      form.querySelector('#fzPhotoMeta').textContent = 'Processando foto e localização...';
      try {
        this._photo = await this.preparePhoto(file, origem);
        form.querySelector('#fzPhotoPreview').src = this._photo.dataUrl;
        const m = this._photo;
        form.querySelector('#fzPhotoMeta').innerHTML = `
          <span>🕒 ${this.esc(this.formatDateTime(m.when))}${m.whenSource === 'ARQUIVO' ? ' <small>(data do arquivo)</small>' : ''}</span>
          <span>📍 ${m.lat !== '' ? `${m.lat}, ${m.lng}${m.acc ? ' (±' + m.acc + ' m)' : ''} <small>${m.coordSource === 'EXIF' ? '(GPS da foto)' : '(GPS do aparelho)'}</small>` : '<b>sem coordenadas</b> — ative a localização do aparelho'}</span>`;
      } catch (error) {
        console.error(error);
        App.showMessage('Não foi possível processar a foto.', 'error');
        form.querySelector('#fzPickRow').hidden = false;
        form.querySelector('#fzPhotoStage').hidden = true;
      }
      input.value = '';
    };

    form.querySelector('#fzCam').onchange = e => handle(e.target, 'CAMERA');
    form.querySelector('#fzGal').onchange = e => handle(e.target, 'GALERIA');
    form.querySelector('#fzPhotoRedo').onclick = () => {
      this._photo = null;
      form.querySelector('#fzPickRow').hidden = false;
      form.querySelector('#fzPhotoStage').hidden = true;
    };
  },

  /* Lê data e GPS do EXIF de fotos JPEG (sem bibliotecas) */
  readExif(buffer) {
    try {
      const view = new DataView(buffer);
      if (view.getUint16(0) !== 0xFFD8) return {};
      let offset = 2;
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset);
        const size = view.getUint16(offset + 2);
        if (marker === 0xFFE1 && view.getUint32(offset + 4) === 0x45786966) {
          const tiff = offset + 10;
          const little = view.getUint16(tiff) === 0x4949;
          const u16 = o => view.getUint16(o, little);
          const u32 = o => view.getUint32(o, little);
          const readIfd = start => {
            const tags = {};
            const n = u16(start);
            for (let i = 0; i < n; i++) {
              const e = start + 2 + i * 12;
              tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
            }
            return tags;
          };
          const valueOffset = t => (t.type === 2 && t.count <= 4) || (t.type === 5 && false) ? t.at : tiff + u32(t.at);
          const ascii = t => {
            const o = t.count <= 4 ? t.at : tiff + u32(t.at);
            let s = '';
            for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(view.getUint8(o + i));
            return s;
          };
          const rationals = t => {
            const o = tiff + u32(t.at);
            const out = [];
            for (let i = 0; i < t.count; i++) out.push(u32(o + i * 8) / (u32(o + i * 8 + 4) || 1));
            return out;
          };
          const ifd0 = readIfd(tiff + u32(tiff + 4));
          const result = {};
          if (ifd0[0x8769]) {
            const exif = readIfd(tiff + u32(ifd0[0x8769].at));
            const dt = exif[0x9003] || exif[0x9004];
            if (dt) {
              const m = ascii(dt).match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
              if (m) result.when = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
            }
          } else if (ifd0[0x0132]) {
            const m = ascii(ifd0[0x0132]).match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
            if (m) result.when = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
          }
          if (ifd0[0x8825]) {
            const gps = readIfd(tiff + u32(ifd0[0x8825].at));
            if (gps[2] && gps[4]) {
              const toDeg = a => a[0] + a[1] / 60 + a[2] / 3600;
              const latRef = String.fromCharCode(view.getUint8(gps[1].at));
              const lngRef = String.fromCharCode(view.getUint8(gps[3].at));
              let lat = toDeg(rationals(gps[2]));
              let lng = toDeg(rationals(gps[4]));
              if (latRef === 'S') lat = -lat;
              if (lngRef === 'W') lng = -lng;
              if (lat || lng) Object.assign(result, { lat, lng });
            }
          }
          void valueOffset;
          return result;
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        offset += 2 + size;
      }
    } catch (error) {
      console.warn('EXIF não lido:', error);
    }
    return {};
  },

  async preparePhoto(file, origem) {
    const exif = this.readExif(await file.arrayBuffer());
    let when, whenSource, lat = '', lng = '', acc = '', coordSource = '';

    if (origem === 'GALERIA' && exif.when) {
      when = exif.when; whenSource = 'EXIF';
    } else if (origem === 'GALERIA') {
      const d = new Date(file.lastModified || Date.now());
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      when = d.toISOString().slice(0, 19); whenSource = 'ARQUIVO';
    } else {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      when = d.toISOString().slice(0, 19); whenSource = 'CAPTURA';
    }

    if (origem === 'GALERIA' && exif.lat !== undefined) {
      lat = Number(exif.lat.toFixed(6)); lng = Number(exif.lng.toFixed(6)); coordSource = 'EXIF';
    } else {
      const coords = await new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => resolve(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
      });
      if (coords) {
        lat = Number(coords.latitude.toFixed(6)); lng = Number(coords.longitude.toFixed(6));
        acc = Math.round(coords.accuracy); coordSource = 'APARELHO';
      }
    }

    const dataUrl = await this.stampImage(file, [
      `${this.formatDateTime(when)}${lat !== '' ? `  •  ${lat}, ${lng}${acc ? ' (±' + acc + ' m)' : ''}` : '  •  sem coordenadas'}`,
      `${this.current.Numero_Fiscalizacao}  •  ${this.current.Nome_Propriedade_Local} — ${this.current.Municipio}/AM`
    ]);

    return { dataUrl, when, whenSource, lat, lng, acc, coordSource, origem };
  },

  /* Reduz a foto e grava a tarja com data, hora e coordenadas */
  stampImage(file, lines, maxSize = 1600, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMAGEM_INVALIDA')); };
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        const fs = Math.max(12, Math.round(w / 48));
        const pad = Math.round(fs * 0.6);
        const band = lines.length * fs * 1.35 + pad * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, h - band, w, band);
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
          ctx.font = `${i === 0 ? '600 ' : ''}${fs}px system-ui, Arial, sans-serif`;
          let text = line;
          while (ctx.measureText(text).width > w - pad * 2 && text.length > 10) text = text.slice(0, -2);
          if (text !== line) text = text.slice(0, -1) + '…';
          ctx.fillText(text, pad, h - band + pad + i * fs * 1.35);
        });
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = url;
    });
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
    const ph = this._photo;
    if (!ph) {
      App.showMessage('Tire uma foto ou escolha uma da galeria.', 'warning');
      return false;
    }
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
      Foto: ph.dataUrl,
      Arquivo_URL: '',
      Nome_Arquivo: `${this.current.Numero_Fiscalizacao}_${Date.now()}.jpg`,
      Incluir_PDF: document.getElementById('fzPhotoPdf').checked ? 'SIM' : 'NAO',
      Origem_Foto: ph.origem,
      Data_Hora_Captura: ph.when,
      Fonte_Data_Hora: ph.whenSource,
      Latitude: ph.lat,
      Longitude: ph.lng,
      Precisao_GPS_m: ph.acc,
      Fonte_Coordenadas: ph.coordSource,
      Data_Hora_Registro: new Date().toISOString(),
      ID_Servidor: Auth.currentServerId()
    }, occ ? [{ entity: 'ocorrenciasPragas', recordId: occ.id }] : []);

    this._photo = null;
    App.showMessage('Evidência salva.', 'success');
    await this.renderWorkspace();
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

  /* Assinatura do servidor: usa a imagem cadastrada no perfil (Auth) */
  fiscalSignature(f) {
    const user = Auth.getUser();
    const same = user && (
      (f.ID_Servidor && user.ID_Servidor === f.ID_Servidor) ||
      (!f.ID_Servidor && user.Nome_Completo === f.Nome_Servidor)
    );
    return same && user.Assinatura ? user.Assinatura : '';
  },

  respSignKey() {
    return 'assinatura_resp_' + this.current.id;
  },

  witnessKey() {
    return 'testemunhas_' + this.current.id;
  },

  /* Guarda os textos digitados na conclusão antes de redesenhar a tela */
  async keepConclusionDraft() {
    if (!document.getElementById('fzSituacao')) return;
    this.current = await saveLocalRecord('fiscalizacoes', {
      ...this.current,
      Situacao_Fitossanitaria: this.val('fzSituacao'),
      Descricao_Acao: this.val('fzDescricao'),
      Enquadramento_Legal: this.val('fzEnquadramento'),
      Observacoes: this.val('fzObs'),
      Forma_Entrega_Via: this.val('fzEntrega') || this.current.Forma_Entrega_Via || '',
      Contato_Entrega_Via: this.val('fzEntregaContato')
    }, { operation: 'UPDATE' });
  },

  async setResponsibleMode(mode) {
    await this.keepConclusionDraft();
    const prev = await getMeta(this.respSignKey());
    const next = { status: mode, at: new Date().toISOString() };
    if (mode === 'ASSINADO' && prev?.status === 'ASSINADO' && prev.image) next.image = prev.image;
    await setMeta(this.respSignKey(), next);
    if (mode === 'AUSENTE' && !['POSTERIOR', 'DIGITAL'].includes(this.current.Forma_Entrega_Via)) {
      this.current = await saveLocalRecord('fiscalizacoes', { ...this.current, Forma_Entrega_Via: 'POSTERIOR' }, { operation: 'UPDATE' });
    }
    await this.renderWorkspace();
    if (mode === 'ASSINADO' && !next.image) await this.collectResponsibleSignature();
  },

  async markResponsibleAbsent() {
    if (!confirm('Registrar que o responsável está ausente? Serão solicitadas duas testemunhas.')) return;
    await this.keepConclusionDraft();
    await setMeta(this.respSignKey(), { status: 'AUSENTE', at: new Date().toISOString() });
    await this.renderWorkspace();
  },

  /* Gravações em fila, para um campo não sobrescrever o outro */
  saveWitnessField(el) {
    this._witQueue = (this._witQueue || Promise.resolve()).then(async () => {
      const list = (await getMeta(this.witnessKey())) || [];
      const i = Number(el.dataset.wit);
      list[i] = { ...(list[i] || {}), [el.dataset.witField]: el.value.trim() };
      await setMeta(this.witnessKey(), list);
      this.pendingWitnesses = list;
    });
    return this._witQueue;
  },

  async collectWitnessSignature(i) {
    const list = (await getMeta(this.witnessKey())) || [];
    const w = list[i] || {};
    if (!w.nome) {
      App.showMessage('Informe o nome da testemunha antes da assinatura.', 'warning');
      return;
    }
    const result = await SignaturePad.capture({
      title: `Assinatura — testemunha ${i + 1}`,
      name: w.nome,
      detail: [w.doc ? 'CPF/RG ' + w.doc : '', 'Termo ' + this.current.Numero_Fiscalizacao].filter(Boolean).join(' • ')
    });
    if (!result || !result.image) return;
    list[i] = { ...w, image: result.image, at: new Date().toISOString() };
    await setMeta(this.witnessKey(), list);
    await this.keepConclusionDraft();
    await this.renderWorkspace();
  },

  sectionConclusion(f, data, editable, doc) {
    if (!editable) {
      return `
        <section class="subsection">
          <div class="fz-section-header"><h4>✅ Conclusão</h4></div>
          <div class="mini-card">
            <strong>${this.esc(this.label(this.SITUACOES, f.Situacao_Fitossanitaria))}</strong>
            <span>${this.status(f) === 'CANCELADA'
              ? 'Cancelada: ' + this.esc(f.Motivo_Cancelamento || '')
              : `Finalizada em ${this.formatDateTime(f.Data_Hora_Final || f.Data_Finalizacao)}`}</span>
            ${doc ? `<span>Termo nº <b>${this.esc(doc.Numero_Documento)}</b>${doc.Numero_Provisorio === 'SIM' ? ' (provisório — o definitivo sai na sincronização)' : ''} • versão ${this.esc(doc.Versao_Documento)}</span>
              ${doc.PDF_URL ? `<a class="btn btn-secondary fz-small fz-mt" href="${this.esc(doc.PDF_URL)}" target="_blank" rel="noopener">📄 Abrir PDF oficial no Drive</a>` : '<span class="fz-muted">O PDF oficial será gerado no Drive na próxima sincronização.</span>'}` : ''}
          </div>
        </section>`;
    }

    const suggested = f.Situacao_Fitossanitaria || this.suggestSituation(data);
    const fiscalImg = this.fiscalSignature(f);
    const resp = this.pendingResp;
    const needWitness = resp && (resp.status === 'RECUSADO' || resp.status === 'AUSENTE');
    const wits = this.pendingWitnesses || [];

    return `
      <section class="subsection">
        <div class="fz-section-header"><h4>✅ Conclusão e Termo de Fiscalização</h4></div>
        <form id="fzConclForm" class="fz-inline-form">
          <div class="form-grid">
            <div class="field field-wide"><label for="fzSituacao">Situação fitossanitária *</label>
              <select id="fzSituacao" required>${this.options(this.SITUACOES, suggested)}</select>
              <small>Sugerida a partir dos resultados das pragas avaliadas.</small></div>

            <div class="field field-wide">
              <div class="fz-label-row">
                <label for="fzDescricao">2 – Descrição da ação (o que foi constatado) *</label>
                <button type="button" class="fz-link" id="fzGenDesc">↻ Gerar a partir dos registros</button>
              </div>
              <textarea id="fzDescricao" rows="7" maxlength="6000">${this.esc(f.Descricao_Acao || this.generateDescription(data))}</textarea>
              <small>Texto que sai no termo após “Em __/__/____ às __:__ ao realizar fiscalização no(a) … constatei:”. Pode editar à vontade.</small>
            </div>

            <div class="field field-wide">
              <div class="fz-label-row">
                <label for="fzEnquadramento">3 – Enquadramento legal</label>
                <button type="button" class="fz-link" id="fzGenLegal">↻ Sugerir pela legislação cadastrada</button>
              </div>
              <textarea id="fzEnquadramento" rows="3" maxlength="3000">${this.esc(f.Enquadramento_Legal ?? this.generateLegal(data))}</textarea>
            </div>

            <div class="field field-wide"><label for="fzObs">Observações internas (não saem no termo)</label>
              <textarea id="fzObs" rows="2" maxlength="2000">${this.esc(f.Observacoes || '')}</textarea></div>
          </div>

          <div class="fz-signs">
            <div class="fz-sign-card">
              <small>Servidor da ADAF</small>
              <strong>${this.esc(f.Nome_Servidor || '')}</strong>
              <small>${this.esc(f.Cargo_Servidor || this.CARGO_PADRAO)}${f.Matricula_Servidor ? ' • mat. ' + this.esc(f.Matricula_Servidor) : ''}</small>
              ${this.getTeam(f).length ? `<small>Equipe: ${this.esc(this.teamNames(f))}</small>` : ''}
              ${fiscalImg
                ? `<img src="${this.esc(fiscalImg)}" alt="Assinatura do fiscal"><span class="fz-sign-ok">✓ Assinatura aplicada automaticamente</span>`
                : `<span class="fz-sign-ok">✓ Assinatura eletrônica (nome, matrícula, data e hora)</span>
                   <button type="button" class="fz-link" onclick="Auth.showIdentification().then(()=>FiscalizacoesModule.renderWorkspace())">Cadastrar imagem da minha assinatura</button>`}
            </div>

            <div class="fz-sign-card ${resp && (resp.status !== 'ASSINADO' || resp.image) ? '' : 'fz-sign-pending'}">
              <small>Ciência do fiscalizado — ${this.esc(this.label(this.VINCULOS, f.Vinculo_Responsavel))}</small>
              <strong>${this.esc(f.Responsavel_Presente || '')}</strong>
              <div class="fz-seg" role="radiogroup" aria-label="Ciência do fiscalizado">
                ${[['ASSINADO', '✍️ Assina'], ['RECUSADO', 'Recusou-se a assinar'], ['AUSENTE', 'Ausente']].map(([v, l]) => `
                  <button type="button" role="radio" aria-checked="${resp?.status === v}" class="${resp?.status === v ? 'on' : ''}" data-resp-mode="${v}">${l}</button>`).join('')}
              </div>
              ${resp?.status === 'ASSINADO' && resp.image ? `<img src="${this.esc(resp.image)}" alt="Assinatura do fiscalizado"><span class="fz-sign-ok">✓ Assinatura coletada</span>` : ''}
              ${resp?.status === 'ASSINADO' ? `<button type="button" class="btn ${resp.image ? 'btn-secondary' : 'btn-primary'} fz-sign-btn" id="fzRespSignBtn">✍️ ${resp.image ? 'Refazer assinatura' : 'Coletar assinatura (tela cheia)'}</button>` : ''}
              ${resp?.status === 'RECUSADO' ? '<span class="fz-sign-refused">Recusou-se a assinar — registre duas testemunhas abaixo.</span>' : ''}
              ${resp?.status === 'AUSENTE' ? '<span class="fz-sign-refused">Fiscalizado ausente — registre duas testemunhas abaixo.</span>' : ''}
              ${!resp ? '<span class="fz-muted">Escolha uma opção. A assinatura declara ciência do termo, não o recebimento da via.</span>' : ''}
            </div>

            <div class="fz-sign-card">
              <small>Entrega da 2ª via ao interessado</small>
              <select id="fzEntrega">${this.options(this.ENTREGA_VIA.filter(([v]) => resp?.status !== 'AUSENTE' || v === 'POSTERIOR' || v === 'DIGITAL'), f.Forma_Entrega_Via || (resp?.status === 'AUSENTE' ? 'POSTERIOR' : 'EM_MAOS'), null)}</select>
              <input id="fzEntregaContato" placeholder="WhatsApp ou e-mail do interessado" maxlength="120" value="${this.esc(f.Contato_Entrega_Via || this.producer?.Telefone || '')}" ${(f.Forma_Entrega_Via || '') === 'DIGITAL' ? '' : 'hidden'}>
              <span class="fz-muted">Se for entregue depois, registre a entrega no Histórico.</span>
            </div>
          </div>

          ${needWitness ? `
            <div class="fz-witnesses">
              <strong>4 – Testemunhas</strong>
              <small>Necessárias porque o fiscalizado ${resp.status === 'AUSENTE' ? 'está ausente' : 'se recusou a assinar'}.</small>
              ${[0, 1].map(i => `
                <div class="fz-witness">
                  <div class="form-grid">
                    <div class="field"><label>Testemunha ${i + 1} — nome</label>
                      <input data-wit="${i}" data-wit-field="nome" maxlength="150" value="${this.esc(wits[i]?.nome || '')}"></div>
                    <div class="field"><label>CPF / RG</label>
                      <input data-wit="${i}" data-wit-field="doc" maxlength="30" value="${this.esc(wits[i]?.doc || '')}"></div>
                  </div>
                  ${wits[i]?.image ? `<img src="${this.esc(wits[i].image)}" alt="Assinatura da testemunha">` : ''}
                  <button type="button" class="btn btn-secondary" data-wit-sign="${i}">✍️ ${wits[i]?.image ? 'Refazer assinatura' : 'Coletar assinatura'} da testemunha ${i + 1}</button>
                </div>`).join('')}
            </div>` : ''}

          <div class="form-actions">
            <button type="button" class="btn btn-secondary fz-danger" onclick="FiscalizacoesModule.cancelInspection()">Cancelar fiscalização</button>
            <button type="button" class="btn btn-secondary" onclick="FiscalizacoesModule.saveConclusion(false)">Salvar rascunho</button>
            <button type="submit" class="btn btn-primary">Finalizar e emitir termo</button>
          </div>
        </form>
      </section>`;
  },

  /* ---------- Textos automáticos do termo ---------- */

  fmtNum(v) {
    return v === '' || v == null ? '' : String(v).replace('.', ',');
  },

  joinPt(list) {
    const items = list.filter(Boolean);
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1];
  },

  generateDescription(data) {
    const f = this.current;
    const parts = [];
    const programs = this.selectedPrograms().map(id => this.cat.programas.get(id)).filter(Boolean);

    const evaluated = data.occs.filter(o => o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA');
    const detected = evaluated.filter(o => o.Resultado_Avaliacao === 'DETECTADA');
    const suspect = evaluated.filter(o => o.Resultado_Avaliacao === 'SUSPEITA');
    const negatives = evaluated.filter(o => o.Resultado_Avaliacao === 'NAO_DETECTADA');
    const situacao = this.val('fzSituacao') || f.Situacao_Fitossanitaria || this.suggestSituation(data);

    /* 1. Situação fitossanitária */
    if (situacao === 'COM_OCORRENCIA') parts.push('Situação fitossanitária: ocorrência de praga confirmada no momento da fiscalização.');
    else if (situacao === 'SUSPEITA') parts.push('Situação fitossanitária: suspeita de ocorrência de praga, aguardando diagnóstico.');
    else if (evaluated.length) parts.push('Situação fitossanitária: sem ocorrência das pragas avaliadas no momento da fiscalização.');

    /* 2. Culturas inspecionadas */
    if (data.cults.length) {
      parts.push('Foram inspecionadas as culturas de ' + this.joinPt(data.cults.map(c => {
        const extra = [
          c.Area_Fiscalizada_ha !== '' && c.Area_Fiscalizada_ha != null ? this.fmtNum(c.Area_Fiscalizada_ha) + ' ha fiscalizados' : '',
          c.Quantidade_Plantas_Avaliadas ? c.Quantidade_Plantas_Avaliadas + ' plantas avaliadas' : ''
        ].filter(Boolean).join(', ');
        return c.Nome_Cultura_Local + (extra ? ` (${extra})` : '');
      })) + '.');
    }

    /* 3. Pragas: detectadas, suspeitas e não detectadas */
    [...detected, ...suspect].forEach(o => {
      const det = [
        o.Nivel_Infestacao ? 'nível de infestação ' + this.label(this.NIVEIS, o.Nivel_Infestacao).toLowerCase() : '',
        o.Incidencia_Percentual !== '' && o.Incidencia_Percentual != null ? 'incidência estimada de ' + this.fmtNum(o.Incidencia_Percentual) + '%' : '',
        o.Distribuicao_Ocorrencia ? 'distribuição: ' + this.label(this.DISTRIBUICAO, o.Distribuicao_Ocorrencia).toLowerCase() : ''
      ].filter(Boolean).join(', ');
      parts.push(`${o.Resultado_Avaliacao === 'DETECTADA' ? 'Constatou-se a ocorrência' : 'Constatou-se suspeita de ocorrência'} de ${o.Nome_Praga}${o.Nome_Cientifico ? ' (' + o.Nome_Cientifico + ')' : ''} na cultura de ${o.Nome_Cultura_Local}${det ? ', com ' + det : ''}${o.Sintomas_Observados ? '. Sintomas observados: ' + o.Sintomas_Observados.replace(/\.$/, '') : ''}.`);
    });

    if (negatives.length) {
      parts.push('Não foram detectados sinais ou sintomas de ' + this.joinPt(negatives.map(o => `${o.Nome_Praga} (${o.Nome_Cultura_Local})`)) + '.');
    }

    /* 4. Amostras e providências */
    if (data.samples.length) {
      parts.push(`Foram coletadas ${data.samples.length} amostra(s) para análise laboratorial: ` + this.joinPt(data.samples.map(s =>
        `${s.Identificacao_Amostra}${s.Numero_Lacre ? ' (lacre ' + s.Numero_Lacre + ')' : ''} — ${s.Tipo_Material.toLowerCase()}${s.Nome_Cultura_Local ? ' de ' + s.Nome_Cultura_Local.toLowerCase() : ''}`)) + '.');
    }

    data.actions.forEach(a => {
      parts.push(`Providência: ${this.label(this.PROVIDENCIAS, a.Tipo_Providencia)}${a.Numero_Documento ? ' nº ' + a.Numero_Documento : ''} — ${a.Descricao.replace(/\.$/, '')}${a.Prazo ? ', com prazo até ' + this.formatDate(a.Prazo) : ''}.`);
    });

    /* 5. Programa / tipo de ação e finalidade */
    parts.push(`${this.label(this.TIPOS_ACAO, f.Tipo_Acao)}${programs.length ? ' no âmbito do(s) programa(s) ' + this.joinPt(programs.map(p => this.programLabel(p))) : ''}${f.Finalidade ? ', com a finalidade de ' + f.Finalidade.replace(/\.$/, '') : ''}.`);

    return parts.join(' ');
  },

  generateLegal(data) {
    const laws = [];
    const add = text => {
      const t = this.clean(text);
      if (t && !laws.some(l => l.toLowerCase() === t.toLowerCase())) laws.push(t);
    };
    this.selectedPrograms().forEach(id => add(this.cat.programas.get(id)?.legislacao));
    data.occs
      .filter(o => o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA')
      .forEach(o => add(o.Legislacao || this.cat.pragas.get(String(o.ID_Praga))?.legislacao));
    return laws.join(';\n');
  },

  async collectResponsibleSignature() {
    const f = this.current;
    const result = await SignaturePad.capture({
      title: `Assinatura — ${this.label(this.VINCULOS, f.Vinculo_Responsavel)}`,
      name: f.Responsavel_Presente || '',
      detail: [f.CPF_Responsavel ? 'CPF ' + f.CPF_Responsavel : '', `Ciente do Termo ${f.Numero_Fiscalizacao}`].filter(Boolean).join(' • '),
      allowRefusal: false
    });
    if (!result) return;
    await this.keepConclusionDraft();
    await setMeta(this.respSignKey(), { ...result, at: new Date().toISOString() });
    App.showMessage('Assinatura coletada.', 'success');
    await this.renderWorkspace();
  },




  async saveConclusion(finish) {
    const situacao = this.val('fzSituacao');
    const data = await this.loadAll();
    const resp = await getMeta(this.respSignKey());

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
        .forEach(o => problems.push(`${this.occLabel(o)}: detalhes da ocorrência não preenchidos`));

      const hasPositive = this.positiveOccs(data).length > 0;
      if (situacao === 'SEM_OCORRENCIA' && hasPositive) problems.push('há pragas suspeitas/detectadas, mas a situação indica “sem ocorrência”');
      if (situacao !== 'SEM_OCORRENCIA' && !hasPositive) problems.push('a situação indica praga, mas nenhuma foi marcada como suspeita/detectada');

      if (!resp) problems.push('ciência do fiscalizado não registrada (assinou, recusou-se ou ausente)');
      if (resp?.status === 'ASSINADO' && !resp.image) problems.push('assinatura do fiscalizado não coletada');
      if (this.val('fzEntrega') === 'DIGITAL' && !this.val('fzEntregaContato')) problems.push('informe o WhatsApp ou e-mail para o envio digital da 2ª via');
      if (!this.val('fzDescricao')) problems.push('descrição da ação (item 2 do termo) em branco');
      if (resp && (resp.status === 'RECUSADO' || resp.status === 'AUSENTE')) {
        const wits = ((await getMeta(this.witnessKey())) || []).filter(w => w && w.nome && w.image);
        if (wits.length < 2) problems.push(`responsável ${resp.status === 'AUSENTE' ? 'ausente' : 'recusou-se a assinar'}: são necessárias 2 testemunhas com assinatura (há ${wits.length})`);
      }
      if (!(await NumberPool.available())) problems.push('não há número de termo reservado neste aparelho: será usado número provisório até a sincronização');

      if (problems.length && !confirm('Atenção:\n- ' + problems.join('\n- ') + '\n\nFinalizar mesmo assim?')) return;
      if (!problems.length && !confirm('Finalizar a fiscalização e emitir o Termo de Fiscalização?')) return;
    }

    const now = new Date().toISOString();
    const record = {
      ...this.current,
      Situacao_Fitossanitaria: situacao,
      Descricao_Acao: this.val('fzDescricao'),
      Enquadramento_Legal: this.val('fzEnquadramento'),
      Observacoes: this.val('fzObs'),
      Forma_Entrega_Via: this.val('fzEntrega'),
      Contato_Entrega_Via: this.val('fzEntrega') === 'DIGITAL' ? this.val('fzEntregaContato') : '',
      Data_Atualizacao: now
    };
    if (finish) {
      record.Status_Fiscalizacao = 'FINALIZADA';
      record.Data_Hora_Final = this.localNow();
      record.Data_Finalizacao = now;
    }

    this.current = await saveLocalRecord('fiscalizacoes', record, {
      operation: 'UPDATE',
      dependsOn: [{ entity: 'propriedades', recordId: record.ID_Propriedade_Local }]
    });

    if (finish) {
      await this.emitDocument(data, resp, (await getMeta(this.witnessKey())) || []);
      await setMeta(this.respSignKey(), null);
      await setMeta(this.witnessKey(), null);
    }

    await App.updateSyncStatus();
    App.showMessage(finish ? 'Fiscalização finalizada. Termo emitido.' : 'Rascunho salvo.', 'success');

    if (finish && navigator.onLine && apiIsConfigured()) {
      syncAll().catch(err => console.warn('Sincronização após finalização falhou:', err));
    }
    await this.renderWorkspace();
    if (finish) this.printTerm();
  },

  async emitDocument(data, resp, witnesses = []) {
    const f = this.current;
    const user = Auth.getUser();
    const now = () => new Date().toISOString();
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

    /* Numeração estadual: N° sequencial - Ano - Unidade */
    const unidade = this.unitCode(this.property?.Municipio || f.Municipio);
    const reserved = await NumberPool.take();
    const ano = reserved ? reserved.ano : new Date().getFullYear();
    const seq = reserved ? String(reserved.seq).padStart(4, '0') : 'PROV';

    const docId = createUUID();
    const doc = await this.saveChild('documentos', {
      id: docId,
      ID_Documento: docId,
      Tipo_Documento: 'TERMO_FISCALIZACAO',
      ID_Propriedade: f.ID_Propriedade,
      Numero_Sequencial: reserved ? reserved.seq : '',
      Ano_Documento: ano,
      Unidade_Documento: unidade,
      Numero_Provisorio: reserved ? 'NAO' : 'SIM',
      Numero_Documento: reserved ? `${seq}-${ano}-${unidade}` : `PROV-${f.Numero_Fiscalizacao}`,
      Versao_Documento: version,
      Data_Hora_Emissao: now(),
      ID_Servidor_Emissor: f.ID_Servidor || user?.ID_Servidor || '',
      Nome_Servidor_Emissor: f.Nome_Servidor || user?.Nome_Completo || '',
      Status_Documento: 'EMITIDO',
      Forma_Entrega_Via: f.Forma_Entrega_Via || '',
      Contato_Entrega_Via: f.Contato_Entrega_Via || '',
      Status_Entrega_Via: { EM_MAOS: 'ENTREGUE', DIGITAL: 'ENVIADA', RECUSOU: 'RECUSADA' }[f.Forma_Entrega_Via] || 'PENDENTE',
      Data_Entrega_Via: ['EM_MAOS', 'DIGITAL'].includes(f.Forma_Entrega_Via) ? now() : '',
      PDF_URL: '',
      Hash_Documento: await this.digest(content),
      Observacoes: ''
    });

    const coords = await this.getPositionQuick();
    const signature = async (fields) => {
      const id = createUUID();
      await this.saveChild('assinaturas', {
        id,
        ID_Assinatura: id,
        ID_Documento: doc.ID_Documento,
        ID_Documento_Local: doc.id,
        Assinatura_URL: '',
        Data_Hora_Assinatura: now(),
        Latitude_Assinatura: coords ? Number(coords.latitude.toFixed(6)) : '',
        Longitude_Assinatura: coords ? Number(coords.longitude.toFixed(6)) : '',
        ...fields
      }, [{ entity: 'documentos', recordId: doc.id }]);
    };

    const fiscalImg = this.fiscalSignature(f);
    await signature({
      Tipo_Assinante: 'SERVIDOR',
      ID_Servidor: f.ID_Servidor || '',
      Nome_Assinante: f.Nome_Servidor || user?.Nome_Completo || '',
      CPF_Assinante: '',
      Qualificacao_Assinante: [f.Cargo_Servidor || user?.Cargo_Funcao || this.CARGO_PADRAO, f.Matricula_Servidor ? 'mat. ' + f.Matricula_Servidor : ''].filter(Boolean).join(' — '),
      Assinatura: fiscalImg,
      Status_Assinatura: fiscalImg ? 'ASSINADO' : 'ASSINADO_ELETRONICAMENTE'
    });

    await signature({
      Tipo_Assinante: f.Vinculo_Responsavel || 'RESPONSAVEL',
      ID_Servidor: '',
      Nome_Assinante: f.Responsavel_Presente || '',
      CPF_Assinante: f.CPF_Responsavel || '',
      Qualificacao_Assinante: this.label(this.VINCULOS, f.Vinculo_Responsavel),
      Assinatura: resp?.status === 'ASSINADO' ? (resp.image || '') : '',
      Status_Assinatura: resp?.status === 'ASSINADO' ? (resp.image ? 'ASSINADO' : 'PENDENTE') : (resp?.status || 'PENDENTE')
    });

    for (const [ordem, w] of witnesses.filter(x => x && x.nome).entries()) {
      await signature({
        Ordem_Assinatura: ordem + 1,
        Tipo_Assinante: 'TESTEMUNHA',
        ID_Servidor: '',
        Nome_Assinante: w.nome,
        CPF_Assinante: w.doc || '',
        Qualificacao_Assinante: 'Testemunha',
        Assinatura: w.image || '',
        Status_Assinatura: w.image ? 'ASSINADO' : 'PENDENTE'
      });
    }

    /* HTML do termo: o Apps Script converte em PDF no Drive */
    const html = await this.buildTermHTML(doc, false);
    await this.saveChild('documentos', { ...(await dbGet('documentos', doc.id)), Termo_HTML: html });
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
    document.querySelectorAll('[data-occ-detail]').forEach(btn => {
      btn.onclick = () => this.openOccurrenceSheet(btn.dataset.occDetail);
    });

    const concl = document.getElementById('fzConclForm');
    if (concl) {
      concl.onsubmit = async event => {
        event.preventDefault();
        await this.saveConclusion(true);
      };
    }

    if (!this.isEditable()) return;

    document.querySelectorAll('[data-occ-sample]').forEach(btn => {
      btn.onclick = () => this.openSampleSheet(btn.dataset.occSample);
    });

    const signBtn = document.getElementById('fzRespSignBtn');
    if (signBtn) signBtn.onclick = () => this.collectResponsibleSignature();

    document.querySelectorAll('[data-resp-mode]').forEach(btn => {
      btn.onclick = () => this.setResponsibleMode(btn.dataset.respMode);
    });

    const entrega = document.getElementById('fzEntrega');
    if (entrega) entrega.onchange = () => {
      document.getElementById('fzEntregaContato').hidden = entrega.value !== 'DIGITAL';
    };

    document.querySelectorAll('[data-wit-field]').forEach(el => {
      el.onchange = () => this.saveWitnessField(el);
    });
    document.querySelectorAll('[data-wit-sign]').forEach(btn => {
      btn.onclick = async () => {
        for (const el of document.querySelectorAll('[data-wit-field]')) {
          await this.saveWitnessField(el);
        }
        await this.collectWitnessSignature(Number(btn.dataset.witSign));
      };
    });

    const genDesc = document.getElementById('fzGenDesc');
    if (genDesc) genDesc.onclick = async () => {
      const box = document.getElementById('fzDescricao');
      if (box.value.trim() && !confirm('Substituir o texto atual pelo texto gerado a partir dos registros?')) return;
      box.value = this.generateDescription(await this.loadAll());
    };
    const genLegal = document.getElementById('fzGenLegal');
    if (genLegal) genLegal.onclick = async () => {
      const box = document.getElementById('fzEnquadramento');
      const text = this.generateLegal(await this.loadAll());
      if (!text) {
        App.showMessage('Não há legislação cadastrada para os programas/pragas desta fiscalização.', 'warning');
        return;
      }
      if (box.value.trim() && !confirm('Substituir o texto atual pela legislação cadastrada?')) return;
      box.value = text;
    };

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
  },


  /* =======================================================
     TERMO DE FISCALIZAÇÃO (impressão / PDF)
  ======================================================= */

  signatureCss() {
    return `.sig img{height:70px;max-width:100%;object-fit:contain}
      .sig-empty{height:70px;display:flex;align-items:flex-end;justify-content:center;color:#a00}
      .sig-elec{height:70px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;font-size:10px;color:#176b3a;border:1px dashed #176b3a;border-radius:6px;padding:4px;margin:0 10px 4px}`;
  },

  /* Blocos de assinatura (fiscal + responsável) para os documentos impressos */
  async signatureBlocks(doc, signs) {
    const f = this.current;
    const e = v => this.esc(v ?? '');
    const fiscalSig = signs?.find(s => s.Tipo_Assinante === 'SERVIDOR');
    const respSig = signs?.find(s => s.Tipo_Assinante !== 'SERVIDOR' && s.Tipo_Assinante !== 'TESTEMUNHA');
    const pending = doc ? null : await getMeta(this.respSignKey());

    const fiscalImg = fiscalSig ? fiscalSig.Assinatura : this.fiscalSignature(f);
    const fiscalWhen = fiscalSig?.Data_Hora_Assinatura || doc?.Data_Hora_Emissao;
    const fiscalTop = fiscalImg
      ? `<img src="${e(fiscalImg)}">`
      : doc
        ? `<div class="sig-elec"><b>Assinado eletronicamente</b>${e(f.Nome_Servidor)}${f.Matricula_Servidor ? ' — mat. ' + e(f.Matricula_Servidor) : ''}<br>${this.formatDateTime(fiscalWhen)}</div>`
        : '<div class="sig-empty"></div>';

    const respImg = respSig ? respSig.Assinatura : (pending?.status === 'ASSINADO' ? pending.image : '');
    const respStatus = respSig ? respSig.Status_Assinatura : pending?.status;
    const respTop = respImg
      ? `<img src="${e(respImg)}">`
      : `<div class="sig-empty">${respStatus === 'RECUSADO' ? 'Recusou-se a assinar' : ''}</div>`;

    return {
      fiscalBlock: `<div class="sig">${fiscalTop}<div class="line">${e(f.Nome_Servidor)}<br><small>Fiscal responsável${f.Matricula_Servidor ? ' — mat. ' + e(f.Matricula_Servidor) : ''}</small></div></div>`,
      respBlock: `<div class="sig">${respTop}<div class="line">${e(f.Responsavel_Presente)}<br><small>${e(this.label(this.VINCULOS, f.Vinculo_Responsavel))}${f.CPF_Responsavel ? ' — CPF ' + e(f.CPF_Responsavel) : ''}</small></div></div>`
    };
  },

  /* =======================================================
     TERMO DE COLETA DE AMOSTRA
  ======================================================= */

  async printSampleTerm() {
    const win = window.open('', '_blank');
    if (!win) {
      App.showMessage('Permita pop-ups para abrir o termo.', 'warning');
      return;
    }

    const f = this.current;
    const doc = await this.getDocument();
    await this.ensureDocumentImages(doc);
    const data = await this.loadAll();
    const signs = doc ? (await dbGetAll('assinaturas')).filter(a => a.ID_Documento_Local === doc.id) : [];
    const { fiscalBlock, respBlock } = await this.signatureBlocks(doc, signs);
    const e = v => this.esc(v ?? '');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Coleta de amostra ${e(f.Numero_Fiscalizacao)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
        h1{font-size:16px;margin:0}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
        .head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #176b3a;padding-bottom:8px}
        table{width:100%;border-collapse:collapse;table-layout:fixed;word-break:break-word}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
        th{background:#eef5f0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
        .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;text-align:center}
        .line{border-top:1px solid #000;padding-top:4px}
        ${this.signatureCss()}
        @page{size:A4;margin:0}
        @media print{button{display:none}body{margin:0;padding:10mm 12mm;-webkit-box-decoration-break:clone;box-decoration-break:clone}}
      </style></head><body>
      <button onclick="print()" style="float:right;padding:8px 14px">Imprimir / salvar PDF</button>
      <div class="head">
        <div><h1>TERMO DE COLETA DE AMOSTRA</h1><div>Gerência de Defesa Vegetal — Estado do Amazonas</div></div>
        <div style="text-align:right"><strong>Ref. ${e(f.Numero_Fiscalizacao)}</strong><br>${this.formatDateTime(f.Data_Hora_Inicio)}</div>
      </div>

      <h2>1. Identificação</h2>
      <div class="grid">
        <div><b>Produtor:</b> ${e(f.Nome_Produtor_Local)}</div>
        <div><b>CPF/CNPJ:</b> ${e(this.producer?.CPF_CNPJ || '')}</div>
        <div><b>Propriedade:</b> ${e(f.Nome_Propriedade_Local)}</div>
        <div><b>Município/UF:</b> ${e(f.Municipio)} - AM</div>
        <div><b>Localidade:</b> ${e(this.property?.Comunidade_Localidade || '—')}</div>
        <div><b>Coordenadas:</b> ${f.Latitude_Fiscalizacao !== '' && f.Latitude_Fiscalizacao != null ? e(f.Latitude_Fiscalizacao) + ', ' + e(f.Longitude_Fiscalizacao) : '—'}</div>
      </div>

      <h2>2. Amostras coletadas</h2>
      <table><thead><tr><th>Identificação</th><th>Lacre</th><th>Material</th><th>Qtde.</th><th>Cultura</th><th>Praga suspeita</th><th>Laboratório / análise</th><th>Coleta</th></tr></thead><tbody>
        ${data.samples.map(s => `<tr><td>${e(s.Identificacao_Amostra)}</td><td>${e(s.Numero_Lacre)}</td><td>${e(s.Tipo_Material)}</td>
          <td>${e(s.Quantidade)} ${e(s.Unidade)}</td><td>${e(s.Nome_Cultura_Local)}</td><td>${e(s.Nome_Praga_Relacionada)}</td>
          <td>${e([s.Laboratorio_Destino, s.Analise_Solicitada].filter(Boolean).join(' — '))}</td><td>${this.formatDateTime(s.Data_Hora_Coleta)}</td></tr>`).join('')}
      </tbody></table>
      ${data.samples.some(s => s.Observacoes) ? `<p><b>Observações:</b> ${data.samples.filter(s => s.Observacoes).map(s => e(s.Identificacao_Amostra + ': ' + s.Observacoes)).join('; ')}</p>` : ''}

      <h2>3. Declaração</h2>
      <p>Declaro que a(s) amostra(s) acima descrita(s) foi(ram) coletada(s) na minha presença, devidamente identificada(s)
      e lacrada(s), para fins de análise fitossanitária, recebendo cópia deste termo.</p>

      <div class="sigs">${fiscalBlock}${respBlock}</div>
      </body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  },

  /*
    Assinaturas e fotos feitas em OUTRO aparelho ficam só no
    Drive. Antes de montar o termo, busca as que faltarem.
  */
  async ensureDocumentImages(doc) {
    if (!doc) return true;
    const signs = (await dbGetAll('assinaturas')).filter(a => a.ID_Documento_Local === doc.id && a.Excluido !== 'SIM');
    const photos = await this.getChildren('evidencias');
    const missing =
      signs.some(a => !a.Assinatura && (a.Assinatura_URL || a.Status_Assinatura === 'ASSINADO')) ||
      photos.some(p => !p.Foto && (p.Arquivo_URL || p.Foto_URL) && p.Incluir_PDF !== 'NAO');
    if (!missing) return true;

    if (!navigator.onLine || !apiIsConfigured()) {
      App.showMessage('Sem internet: assinaturas e fotos coletadas em outro aparelho não aparecerão nesta impressão.', 'warning');
      return false;
    }

    try {
      const result = await apiRequest('getDocumentImages', {
        ID_Documento: doc.ID_Documento || doc.id,
        ID_Fiscalizacao: this.current.ID_Fiscalizacao || this.current.id
      });
      for (const a of result.assinaturas || []) {
        const local = await dbGet('assinaturas', a.id);
        if (local && a.Assinatura) await dbPut('assinaturas', { ...local, Assinatura: a.Assinatura });
      }
      for (const e of result.evidencias || []) {
        const local = await dbGet('evidencias', e.id);
        if (local && e.Foto) await dbPut('evidencias', { ...local, Foto: e.Foto });
      }
      return true;
    } catch (error) {
      console.warn('Imagens do termo não obtidas:', error);
      App.showMessage('Não foi possível buscar as assinaturas no servidor. Tente de novo com internet.', 'warning');
      return false;
    }
  },

  async printTerm() {
    const win = window.open('', '_blank');
    if (!win) {
      App.showMessage('Permita pop-ups para abrir o termo.', 'warning');
      return;
    }
    win.document.write('<p style="font-family:sans-serif;padding:20px">Preparando o termo...</p>');
    const doc = await this.getDocument();
    await this.ensureDocumentImages(doc);
    const html = await this.buildTermHTML(doc, true);
    win.document.open();
    win.document.write(html);
    win.document.close();
  },

  /* Texto sobre a entrega da 2ª via (separado da ciência) */
  deliveryText(d) {
    const when = d.Data_Entrega_Via ? this.formatDateTime(d.Data_Entrega_Via) : '';
    switch (d.Forma_Entrega_Via) {
      case 'EM_MAOS': return `Entregue impressa, em mãos${when ? ', em ' + when : ''}.`;
      case 'DIGITAL': return `Enviada em formato digital${d.Contato_Entrega_Via ? ' para ' + d.Contato_Entrega_Via : ''}${when ? ', em ' + when : ''}.`;
      case 'RECUSOU': return 'O interessado recusou-se a receber a 2ª via.';
      case 'POSTERIOR': return when ? `Entregue posteriormente, em ${when}.` : 'A ser entregue posteriormente.';
      default: return '';
    }
  },

  unitCode(municipio) {
    const name = String(municipio || '').trim();
    const list = this.cat?.listas || [];
    const found = list.find(l => String(l.Categoria) === 'MUNICIPIO_AM' &&
      String(l.Rotulo).toLowerCase() === name.toLowerCase());
    if (found) return String(found.Valor);
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'AM';
  },

  formatDoc(value) {
    const d = String(value || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return value || '';
  },

  /* Monta os dados do termo e devolve o HTML (modelo ADAF) */
  async buildTermHTML(doc, forPrint) {
    const f = this.current;
    const data = await this.loadAll();
    const p = this.property || {};
    const pr = this.producer || {};
    const signs = doc ? (await dbGetAll('assinaturas')).filter(a => a.ID_Documento_Local === doc.id) : [];
    const pendingResp = doc ? null : await getMeta(this.respSignKey());
    const pendingWits = doc ? [] : ((await getMeta(this.witnessKey())) || []);
    const user = Auth.getUser();

    const isPJ = String(pr.Tipo_Pessoa || '').toUpperCase() === 'JURIDICA';
    const culturas = [...new Set(data.cults.map(c => c.Nome_Cultura_Local))];
    const atividade = 'Produção agrícola' + (culturas.length ? ' — ' + culturas.join(', ') : '');
    const [dia, hora] = String(f.Data_Hora_Inicio || '').split('T');
    const lat = f.Latitude_Fiscalizacao !== '' && f.Latitude_Fiscalizacao != null ? f.Latitude_Fiscalizacao : (p.Latitude ?? '');
    const lng = f.Longitude_Fiscalizacao !== '' && f.Longitude_Fiscalizacao != null ? f.Longitude_Fiscalizacao : (p.Longitude ?? '');

    const fiscalSig = signs.find(s => s.Tipo_Assinante === 'SERVIDOR');
    const respSig = signs.find(s => s.Tipo_Assinante !== 'SERVIDOR' && s.Tipo_Assinante !== 'TESTEMUNHA');
    const witSigs = signs.filter(s => s.Tipo_Assinante === 'TESTEMUNHA')
      .sort((x, y) => Number(x.Ordem_Assinatura || 0) - Number(y.Ordem_Assinatura || 0));

    const fiscalImg = fiscalSig ? fiscalSig.Assinatura : this.fiscalSignature(f);
    const electronic = doc && !fiscalImg
      ? `${f.Nome_Servidor}${f.Matricula_Servidor ? ' — mat. ' + f.Matricula_Servidor : ''} — ${this.formatDateTime(fiscalSig?.Data_Hora_Assinatura || doc.Data_Hora_Emissao)}`
      : '';

    const respStatus = respSig ? respSig.Status_Assinatura : pendingResp?.status;
    const respImg = respSig ? respSig.Assinatura : (pendingResp?.status === 'ASSINADO' ? pendingResp.image : '');
    const respWhen = respSig?.Data_Hora_Assinatura || pendingResp?.at || '';

    const numero = doc
      ? (doc.Numero_Provisorio === 'SIM'
          ? { seq: 'PROV', ano: doc.Ano_Documento, unidade: doc.Unidade_Documento, provisorio: true }
          : { seq: String(doc.Numero_Sequencial).padStart(4, '0'), ano: doc.Ano_Documento, unidade: doc.Unidade_Documento })
      : { seq: '', ano: '', unidade: this.unitCode(p.Municipio || f.Municipio) };

    const evaluated = data.occs.filter(o => o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA');
    const programs = this.selectedPrograms().map(id => this.cat.programas.get(id)).filter(Boolean);

    const ctx = {
      forPrint,
      preview: !doc,
      numero,
      ident: {
        nome: isPJ ? (f.Responsavel_Presente || '') : (pr.Nome_Razao_Social || f.Nome_Produtor_Local || ''),
        cpf: isPJ ? this.formatDoc(f.CPF_Responsavel) : this.formatDoc(pr.CPF_CNPJ),
        atividade: isPJ ? '' : atividade,
        empresa: isPJ ? pr.Nome_Razao_Social : '',
        cnpj: isPJ ? this.formatDoc(pr.CPF_CNPJ) : '',
        atividadeEmpresa: isPJ ? atividade : '',
        endereco: [p.Nome_Propriedade, p.Endereco, p.Comunidade_Localidade, p.Via_Acesso].filter(Boolean).join(', '),
        municipio: p.Municipio || f.Municipio || '',
        uf: 'AM',
        telefone: pr.Telefone || '',
        lat: lat === '' ? '' : String(lat),
        lng: lng === '' ? '' : String(lng)
      },
      acao: {
        data: dia ? this.formatDate(dia) : '',
        hora: hora ? hora.slice(0, 5) : '',
        local: [p.Nome_Propriedade || f.Nome_Propriedade_Local, p.Comunidade_Localidade, `município de ${p.Municipio || f.Municipio}/AM`].filter(Boolean).join(', '),
        descricao: (doc ? f.Descricao_Acao : (this.val('fzDescricao') || f.Descricao_Acao)) || this.generateDescription(data)
      },
      enquadramento: (doc ? f.Enquadramento_Legal : (document.getElementById('fzEnquadramento') ? this.val('fzEnquadramento') : f.Enquadramento_Legal)) ?? this.generateLegal(data),
      testemunhasAplicaveis: respStatus === 'RECUSADO' || respStatus === 'AUSENTE',
      testemunhas: witSigs.length
        ? witSigs.map(w => ({ nome: w.Nome_Assinante, doc: w.CPF_Assinante, image: w.Assinatura }))
        : pendingWits.filter(Boolean),
      ciencia: {
        quando: respStatus === 'ASSINADO' && respImg && respWhen ? this.formatDateTime(respWhen) : '',
        local: (p.Municipio || f.Municipio || '') + '/AM',
        assinatura: respImg ? { image: respImg } : (respStatus && respStatus !== 'ASSINADO' ? { status: respStatus } : null),
        nome: f.Responsavel_Presente || '',
        qualificacao: this.label(this.VINCULOS, f.Vinculo_Responsavel) + (f.CPF_Responsavel ? ' — CPF ' + this.formatDoc(f.CPF_Responsavel) : ''),
        detalhes: [this.label(this.VINCULOS, f.Vinculo_Responsavel), f.CPF_Responsavel ? 'CPF ' + this.formatDoc(f.CPF_Responsavel) : '']
      },
      entrega: this.deliveryText(doc || { Forma_Entrega_Via: this.val('fzEntrega') || f.Forma_Entrega_Via, Contato_Entrega_Via: this.val('fzEntregaContato') || f.Contato_Entrega_Via }),
      servidor: {
        nome: f.Nome_Servidor || '',
        matricula: f.Matricula_Servidor || '',
        cargo: f.Cargo_Servidor || (user && user.Nome_Completo === f.Nome_Servidor ? user.Cargo_Funcao : '') || this.CARGO_PADRAO,
        equipe: this.teamNames(f),
        equipeLista: this.getTeam(f).map(m => ({ nome: m.Nome_Completo, cargo: m.Cargo_Funcao || '', matricula: m.Matricula || '' })),
        assinatura: fiscalImg ? { image: fiscalImg } : (electronic ? { electronic } : null)
      },
      anexo: {
        titulo: `${f.Nome_Propriedade_Local} — ${dia ? this.formatDate(dia) : ''}`,
        secoes: [
          {
            titulo: 'Dados da fiscalização',
            colunas: ['Item', 'Informação'],
            linhas: [
              ['Registro interno', f.Numero_Fiscalizacao],
              ['Tipo de ação', this.label(this.TIPOS_ACAO, f.Tipo_Acao)],
              ['Fiscal responsável', `${f.Nome_Servidor || ''} — ${f.Cargo_Servidor || this.CARGO_PADRAO}${f.Matricula_Servidor ? ', mat. ' + f.Matricula_Servidor : ''}`],
              this.getTeam(f).length ? ['Equipe', this.getTeam(f).map(m => m.Nome_Completo + (m.Matricula ? ' (mat. ' + m.Matricula + ')' : '') + (m.Cargo_Funcao ? ' — ' + m.Cargo_Funcao : '')).join('\n')] : null,
              programs.length ? ['Programa(s)', programs.map(pg => this.programLabel(pg) + (pg.legislacao ? ` (${pg.legislacao})` : '')).join('\n')] : null,
              f.Finalidade ? ['Finalidade', f.Finalidade] : null,
              ['Início / término', `${this.formatDateTime(f.Data_Hora_Inicio)}${f.Data_Hora_Final ? ' — ' + this.formatDateTime(f.Data_Hora_Final) : ''}`],
              ['Situação fitossanitária', this.label(this.SITUACOES, f.Situacao_Fitossanitaria || this.suggestSituation(data))]
            ].filter(Boolean)
          },
          {
            titulo: 'Culturas fiscalizadas',
            colunas: ['Cultura', 'Área fiscalizada (ha)', 'Plantas avaliadas'],
            linhas: data.cults.map(c => [c.Nome_Cultura_Local, this.fmtNum(c.Area_Fiscalizada_ha), c.Quantidade_Plantas_Avaliadas])
          },
          {
            titulo: 'Itens verificados',
            colunas: ['Cultura', 'Item', 'Resposta'],
            linhas: data.dados.filter(d => d.Valor !== '').map(d => [data.cults.find(c => c.id === d.ID_Fiscalizacao_Cultura_Local)?.Nome_Cultura_Local || '', d.Rotulo_Campo || d.Nome_Campo, d.Valor])
          },
          {
            titulo: 'Pragas avaliadas',
            colunas: ['Cultura', 'Praga', 'Resultado', 'Nível / incidência', 'Sintomas / observações'],
            linhas: evaluated.map(o => [
              o.Nome_Cultura_Local,
              `${o.Nome_Praga}${o.Nome_Cientifico ? '\n' + o.Nome_Cientifico : ''}`,
              this.label(this.RESULTADOS, o.Resultado_Avaliacao),
              [o.Nivel_Infestacao ? this.label(this.NIVEIS, o.Nivel_Infestacao) : '', o.Incidencia_Percentual !== '' && o.Incidencia_Percentual != null ? this.fmtNum(o.Incidencia_Percentual) + '%' : ''].filter(Boolean).join(' / '),
              [o.Sintomas_Observados, o.Latitude_Ocorrencia ? `Foco: ${o.Latitude_Ocorrencia}, ${o.Longitude_Ocorrencia}` : '', o.Observacoes].filter(Boolean).join('\n')
            ])
          },
          {
            titulo: 'Amostras coletadas',
            colunas: ['Identificação', 'Lacre', 'Material', 'Qtde.', 'Praga / cultura', 'Laboratório'],
            linhas: data.samples.map(s => [s.Identificacao_Amostra, s.Numero_Lacre, s.Tipo_Material, `${s.Quantidade ?? ''} ${s.Unidade || ''}`.trim(), [s.Nome_Praga_Relacionada, s.Nome_Cultura_Local].filter(Boolean).join(' — '), s.Laboratorio_Destino])
          },
          {
            titulo: 'Providências determinadas',
            colunas: ['Tipo', 'Nº', 'Descrição', 'Prazo'],
            linhas: data.actions.map(a => [this.label(this.PROVIDENCIAS, a.Tipo_Providencia), a.Numero_Documento, a.Descricao, a.Prazo ? this.formatDate(a.Prazo) : ''])
          }
        ],
        fotos: data.photos.filter(ph => ph.Foto && ph.Incluir_PDF !== 'NAO').map(ph => ({ src: ph.Foto, legenda: ph.Legenda || '' })),
        hash: doc?.Hash_Documento || ''
      }
    };

    return TermoFiscalizacao.build(ctx);
  },
};
