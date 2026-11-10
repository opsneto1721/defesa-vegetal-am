/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: HISTÓRICO E DOCUMENTOS

   - Documentos: todos os termos emitidos (deste e de outros
     aparelhos, após sincronizar). O PDF oficial é baixado
     do servidor e fica guardado no aparelho para consulta
     offline.
   - Linha do tempo: tudo o que aconteceu com um produtor /
     propriedade (cadastros, fiscalizações, termos,
     amostras, providências).
========================================================= */

const HistoricoModule = {

  tab: 'documentos',
  selectedProperty: null,

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  },

  fmt(value) {
    return typeof FiscalizacoesModule !== 'undefined'
      ? FiscalizacoesModule.formatDateTime(value)
      : String(value || '');
  },

  active(list) {
    return list.filter(item => item.Excluido !== 'SIM');
  },

  async load() {
    const [produtores, propriedades, culturas, fiscs, docs, amostras, provs, occs] = await Promise.all([
      dbGetAll('produtores'), dbGetAll('propriedades'), dbGetAll('culturas'),
      dbGetAll('fiscalizacoes'), dbGetAll('documentos'), dbGetAll('amostras'),
      dbGetAll('providencias'), dbGetAll('ocorrenciasPragas')
    ]);
    this.data = {
      produtores, propriedades, culturas,
      fiscs: this.active(fiscs), docs: this.active(docs),
      amostras: this.active(amostras), provs: this.active(provs), occs: this.active(occs)
    };
    this.fiscById = new Map(this.data.fiscs.map(f => [f.id, f]));
    this.cached = new Set((await dbGetAll('meta'))
      .filter(m => String(m.id).startsWith('pdf_') && m.value)
      .map(m => String(m.id).slice(4)));
  },


  /* =======================================================
     ABRIR
  ======================================================= */

  async open(tab = this.tab) {
    this.tab = tab;
    const main = document.querySelector('main');

    main.innerHTML = `
      <section class="module-page">
        <div class="module-header">
          <button type="button" class="btn btn-secondary" onclick="Nav.back()">← Voltar</button>
          <div>
            <h2>Histórico e documentos</h2>
            <p>Termos emitidos e a linha do tempo de cada produtor e propriedade.</p>
          </div>
        </div>

        <div class="hs-tabs" role="tablist">
          <button type="button" role="tab" class="hs-tab ${tab === 'documentos' ? 'active' : ''}" onclick="HistoricoModule.open('documentos')">📄 Documentos</button>
          <button type="button" role="tab" class="hs-tab ${tab === 'linha' ? 'active' : ''}" onclick="HistoricoModule.open('linha')">🕒 Linha do tempo</button>
          <button type="button" role="tab" class="hs-tab ${tab === 'relatorios' ? 'active' : ''}" onclick="HistoricoModule.open('relatorios')">📊 Relatórios</button>
        </div>

        <div id="hsContent"><p>Carregando...</p></div>
      </section>`;

    await this.load();
    if (tab === 'documentos') this.renderDocumentsTab();
    else if (tab === 'relatorios') await this.renderReportsTab();
    else this.renderTimelineTab();
  },


  /* =======================================================
     DOCUMENTOS
  ======================================================= */

  renderDocumentsTab() {
    const muns = [...new Set(this.data.fiscs.map(f => f.Municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    document.getElementById('hsContent').innerHTML = `
      <div class="hs-toolbar">
        <input id="hsSearch" type="search" placeholder="Nº do termo, produtor, propriedade, CPF ou fiscal">
        <select id="hsStatus">
          <option value="EMITIDO">Vigentes</option>
          <option value="">Todos (inclui substituídos)</option>
          <option value="SUBSTITUIDO">Substituídos</option>
          <option value="CANCELADO">Cancelados</option>
        </select>
        <select id="hsMun"><option value="">Todos os municípios</option>${muns.map(m => `<option>${this.esc(m)}</option>`).join('')}</select>
      </div>
      <p class="hs-hint">${navigator.onLine
        ? 'Os PDFs oficiais são baixados do servidor e ficam guardados neste aparelho.'
        : 'Sem internet: só os PDFs já baixados (marcados com ✓) podem ser abertos.'}</p>
      <div id="hsDocs" class="hs-list"></div>`;

    ['hsSearch', 'hsStatus', 'hsMun'].forEach(id => {
      document.getElementById(id)[id === 'hsSearch' ? 'oninput' : 'onchange'] = () => this.renderDocuments();
    });
    this.renderDocuments();
  },

  docInfo(d) {
    const f = this.fiscById.get(d.ID_Fiscalizacao_Local) ||
      this.data.fiscs.find(x => x.ID_Fiscalizacao === d.ID_Fiscalizacao) || {};
    const producer = this.data.produtores.find(p => p.id === f.ID_Produtor_Local) || {};
    return { f, producer };
  },

  renderDocuments() {
    const box = document.getElementById('hsDocs');
    if (!box) return;
    const q = this.val('hsSearch').toLowerCase();
    const qd = q.replace(/\D/g, '');
    const status = this.val('hsStatus');
    const mun = this.val('hsMun');

    const list = this.data.docs
      .filter(d => !status || d.Status_Documento === status)
      .map(d => ({ d, ...this.docInfo(d) }))
      .filter(({ f }) => !mun || f.Municipio === mun)
      .filter(({ d, f, producer }) => {
        if (!q) return true;
        const text = [d.Numero_Documento, f.Nome_Propriedade_Local, f.Nome_Produtor_Local, f.Municipio, f.Nome_Servidor, f.Siglas_Programas].join(' ').toLowerCase();
        const doc = String(producer.CPF_CNPJ || '').replace(/\D/g, '');
        return text.includes(q) || (qd.length >= 3 && doc.includes(qd));
      })
      .sort((a, b) => String(b.d.Data_Hora_Emissao || '').localeCompare(String(a.d.Data_Hora_Emissao || '')));

    if (!list.length) {
      box.innerHTML = `<div class="empty-state">${this.data.docs.length
        ? 'Nenhum documento encontrado com esse filtro.'
        : 'Nenhum documento neste aparelho ainda. Termos emitidos em outros aparelhos aparecem aqui depois de sincronizar.'}</div>`;
      return;
    }

    box.innerHTML = list.map(({ d, f }) => this.docCard(d, f)).join('');
  },

  docCard(d, f) {
    const statusMap = {
      EMITIDO: ['Vigente', 'fz-ok'],
      SUBSTITUIDO: ['Substituído', ''],
      CANCELADO: ['Cancelado', 'fz-bad']
    };
    const [st, cls] = statusMap[d.Status_Documento] || [d.Status_Documento || '—', ''];
    const cached = this.cached.has(d.id);
    const hasPdf = !!d.PDF_URL || cached;
    const synced = d.syncStatus === 'SINCRONIZADO';
    const situacao = { SEM_OCORRENCIA: '✓ Sem ocorrência', SUSPEITA: '! Suspeita', COM_OCORRENCIA: '✕ Ocorrência confirmada' }[f.Situacao_Fitossanitaria] || '';

    return `
      <article class="hs-doc">
        <div class="hs-doc-icon">📄</div>
        <div class="hs-doc-body">
          <div class="hs-doc-top">
            <strong>Termo de Fiscalização nº ${this.esc(d.Numero_Documento)}</strong>
            <span class="fz-pill ${cls}">${st}</span>
            ${d.Numero_Provisorio === 'SIM' ? '<span class="fz-pill fz-wait">Nº provisório</span>' : ''}
            ${Number(d.Versao_Documento) > 1 ? `<span class="fz-pill">versão ${this.esc(d.Versao_Documento)}</span>` : ''}
            ${d.Status_Documento === 'EMITIDO' && d.Status_Entrega_Via === 'PENDENTE' ? '<span class="fz-pill fz-wait">2ª via pendente</span>' : ''}
          </div>
          <span>${this.esc(f.Nome_Propriedade_Local || '')}${f.Nome_Produtor_Local ? ' • ' + this.esc(f.Nome_Produtor_Local) : ''}${f.Municipio ? ' • ' + this.esc(f.Municipio) : ''}</span>
          <small>Emitido em ${this.fmt(d.Data_Hora_Emissao)} • ${this.esc(d.Nome_Servidor_Emissor || f.Nome_Servidor || '')}${f.Siglas_Programas ? ' • ' + this.esc(f.Siglas_Programas) : ''}${situacao ? ' • ' + situacao : ''}</small>
          <div class="hs-doc-actions">
            <button type="button" class="btn btn-primary fz-small" onclick="HistoricoModule.downloadPdf('${this.esc(d.id)}')" ${!hasPdf && !synced ? 'disabled' : ''}>
              ${cached ? '✓ Abrir PDF' : '⬇ Baixar PDF'}
            </button>
            ${d.Status_Documento === 'EMITIDO' && d.Status_Entrega_Via === 'PENDENTE' ? `<button type="button" class="btn btn-secondary fz-small" onclick="HistoricoModule.registerDelivery('${this.esc(d.id)}')">📬 Registrar entrega da 2ª via</button>` : ''}
            ${f.id ? `<button type="button" class="btn btn-secondary fz-small" onclick="FiscalizacoesModule.openFromAnywhere('${this.esc(f.id)}')">Abrir fiscalização</button>` : ''}
            ${f.id ? `<button type="button" class="btn btn-secondary fz-small" onclick="HistoricoModule.openTimeline('${this.esc(f.ID_Propriedade_Local)}')">Linha do tempo</button>` : ''}
          </div>
          ${!synced ? '<small class="fz-muted">Aguardando sincronização — o PDF oficial é gerado no servidor ao sincronizar. Use “Abrir fiscalização → Termo” para ver a versão do aparelho.</small>' : ''}
        </div>
      </article>`;
  },

  /* Entrega da 2ª via feita depois da emissão */
  async registerDelivery(docId) {
    const d = await dbGet('documentos', docId);
    if (!d) return;
    const { f, producer } = this.docInfo(d);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

    FiscalizacoesModule.openSheet({
      title: '📬 Entrega da 2ª via',
      subtitle: `Termo nº ${this.esc(d.Numero_Documento)} • ${this.esc(f.Nome_Produtor_Local || '')}`,
      submitLabel: 'Registrar entrega',
      body: `
        <div class="form-grid">
          <div class="field"><label for="hsEntForma">Forma de entrega *</label>
            <select id="hsEntForma" required>
              <option value="EM_MAOS">Entregue impressa, em mãos</option>
              <option value="DIGITAL">Enviada em formato digital</option>
              <option value="RECUSOU">Recusou-se a receber</option>
            </select></div>
          <div class="field"><label for="hsEntData">Data e hora *</label>
            <input id="hsEntData" type="datetime-local" required value="${now.toISOString().slice(0, 16)}"></div>
          <div class="field field-wide"><label for="hsEntContato">WhatsApp / e-mail (envio digital)</label>
            <input id="hsEntContato" maxlength="120" value="${this.esc(d.Contato_Entrega_Via || producer.Telefone || '')}"></div>
        </div>
        <p class="fz-muted">A entrega fica registrada no sistema e no Histórico. O PDF já emitido não é alterado.</p>`,
      onSubmit: async () => {
        const forma = this.val('hsEntForma');
        await saveLocalRecord('documentos', {
          ...d,
          Forma_Entrega_Via: forma,
          Contato_Entrega_Via: forma === 'DIGITAL' ? this.val('hsEntContato') : d.Contato_Entrega_Via || '',
          Status_Entrega_Via: { EM_MAOS: 'ENTREGUE', DIGITAL: 'ENVIADA', RECUSOU: 'RECUSADA' }[forma],
          Data_Entrega_Via: forma === 'RECUSOU' ? '' : this.val('hsEntData'),
          Data_Recusa_Via: forma === 'RECUSOU' ? this.val('hsEntData') : ''
        }, { operation: 'UPDATE' });
        await App.updateSyncStatus();
        App.showMessage('Entrega registrada.', 'success');
        await this.load();
        this.renderDocuments();
      }
    });
  },

  /* =======================================================
     RELATÓRIOS
  ======================================================= */

  async renderReportsTab() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const years = [...new Set(this.data.fiscs.map(f => String(f.Data_Hora_Inicio || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)).concat(String(now.getFullYear())))].sort().reverse();
    const muns = [...new Set(this.data.fiscs.map(f => f.Municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    /* Pragas: catálogo + as registradas nas fiscalizações */
    const pests = new Map();
    (await dbGetAll('cadastroPragas')).filter(p => p.ID_Praga).forEach(p => pests.set(String(p.ID_Praga), String(p.Nome_Comum || p.Nome_Cientifico || p.ID_Praga)));
    this.data.occs.forEach(o => {
      const k = Relatorios.pestKey(o);
      if (!pests.has(k) && o.Nome_Praga) pests.set(k, o.Nome_Praga);
    });
    const pestOpts = [...pests.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

    /* Servidores: catálogo + responsáveis/equipe das fiscalizações */
    const servers = new Map();
    (await dbGetAll('servidores')).filter(s => s.ID_Servidor && s.Nome_Completo).forEach(s => servers.set(String(s.ID_Servidor), s.Nome_Completo));
    this.data.fiscs.forEach(f => {
      if (f.ID_Servidor && f.Nome_Servidor && !servers.has(f.ID_Servidor)) servers.set(f.ID_Servidor, f.Nome_Servidor);
    });
    const me = Auth.currentServerId();
    if (me && !servers.has(me)) servers.set(me, Auth.currentServerName());
    const serverOpts = [...servers.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

    const pestSelect = id => `<select id="${id}"><option value="">Todas as pragas</option>${pestOpts.map(([k, n]) => `<option value="${this.esc(k)}">${this.esc(n)}</option>`).join('')}</select>`;
    const munSelect = id => `<select id="${id}"><option value="">Todos os municípios</option>${muns.map(m => `<option>${this.esc(m)}</option>`).join('')}</select>`;

    document.getElementById('hsContent').innerHTML = `
      <p class="hs-hint">Os relatórios usam os registros sincronizados neste aparelho. Sincronize antes para incluir o trabalho de todos os servidores.</p>
      <div class="rp-grid">
        <section class="rp-card">
          <div class="rp-icon">🐛</div>
          <h3>Por praga — mensal</h3>
          <p>Detecções, suspeitas, avaliações sem detecção, municípios, focos com coordenadas e amostras do mês.</p>
          <label>Mês<input type="month" id="rpMesP" value="${ym}"></label>
          <label>Praga${pestSelect('rpPragaM')}</label>
          <label>Município${munSelect('rpMunM')}</label>
          <button type="button" class="btn btn-primary" id="rpBtnPM">Gerar relatório</button>
        </section>

        <section class="rp-card">
          <div class="rp-icon">📅</div>
          <h3>Por praga — anual</h3>
          <p>Tudo do mensal, mais a evolução mês a mês (detecções / avaliações) de cada praga.</p>
          <label>Ano<select id="rpAno">${years.map(y => `<option>${y}</option>`).join('')}</select></label>
          <label>Praga${pestSelect('rpPragaA')}</label>
          <label>Município${munSelect('rpMunA')}</label>
          <button type="button" class="btn btn-primary" id="rpBtnPA">Gerar relatório</button>
        </section>

        <section class="rp-card">
          <div class="rp-icon">👤</div>
          <h3>Atividade por servidor — mensal</h3>
          <p>Prestação de contas: fiscalizações (responsável e equipe), termos, área, amostras, cadastros e municípios atendidos, com campo para visto da chefia.</p>
          <label>Mês<input type="month" id="rpMesS" value="${ym}"></label>
          <label>Servidor<select id="rpServ">${serverOpts.map(([id, n]) => `<option value="${this.esc(id)}" ${id === me ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select></label>
          <button type="button" class="btn btn-primary" id="rpBtnS">Gerar relatório</button>
        </section>
      </div>`;

    const ymParts = id => {
      const [y, m] = this.val(id).split('-').map(Number);
      return { ano: y, mes: m - 1 };
    };
    document.getElementById('rpBtnPM').onclick = () => {
      if (!this.val('rpMesP')) return App.showMessage('Escolha o mês.', 'warning');
      Relatorios.pestReport({ tipo: 'MENSAL', ...ymParts('rpMesP'), praga: this.val('rpPragaM'), municipio: this.val('rpMunM') });
    };
    document.getElementById('rpBtnPA').onclick = () => {
      Relatorios.pestReport({ tipo: 'ANUAL', ano: Number(this.val('rpAno')), mes: 0, praga: this.val('rpPragaA'), municipio: this.val('rpMunA') });
    };
    document.getElementById('rpBtnS').onclick = () => {
      if (!this.val('rpMesS') || !this.val('rpServ')) return App.showMessage('Escolha o mês e o servidor.', 'warning');
      Relatorios.activityReport({ servidor: this.val('rpServ'), ...ymParts('rpMesS') });
    };
  },

  base64ToBlob(base64, type = 'application/pdf') {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  },

  savePdfFile(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  async downloadPdf(docId) {
    const d = await dbGet('documentos', docId);
    if (!d) return;
    const name = `Termo_de_Fiscalizacao_${d.Numero_Documento}.pdf`;

    // 1) Já baixado: abre do aparelho (funciona offline)
    const cached = await getMeta('pdf_' + docId);
    if (cached) {
      this.savePdfFile(this.base64ToBlob(cached), name);
      return;
    }

    if (!navigator.onLine || !apiIsConfigured()) {
      App.showMessage('Sem internet. Este PDF ainda não foi baixado neste aparelho.', 'warning');
      return;
    }

    App.showMessage('Baixando PDF oficial...', 'info');
    try {
      const result = await apiRequest('getDocumentPdf', { id: d.ID_Documento || d.id });
      await setMeta('pdf_' + docId, result.pdf);
      this.cached.add(docId);
      this.savePdfFile(this.base64ToBlob(result.pdf), result.nome || name);
      App.showMessage('PDF baixado e guardado neste aparelho.', 'success');
      this.renderDocuments();
    } catch (error) {
      const msg = String(error.message || error);
      App.showMessage(msg.includes('PDF_AINDA_NAO_GERADO')
        ? 'O PDF oficial ainda não foi gerado. Sincronize o aparelho que emitiu o termo.'
        : 'Não foi possível baixar o PDF. Tente novamente.', 'warning');
    }
  },


  /* =======================================================
     LINHA DO TEMPO
  ======================================================= */

  async openTimeline(propertyId) {
    this.selectedProperty = propertyId;
    await this.open('linha');
  },

  renderTimelineTab() {
    document.getElementById('hsContent').innerHTML = `
      <div class="hs-toolbar">
        <input id="hsPropSearch" type="search" placeholder="Buscar produtor, propriedade, CPF/CNPJ ou município">
      </div>
      <div id="hsPropResults" class="search-results"></div>
      <div id="hsTimeline"></div>`;

    document.getElementById('hsPropSearch').oninput = () => this.renderPropertyResults();

    if (this.selectedProperty) this.renderTimeline(this.selectedProperty);
    else this.renderPropertyResults();
  },

  renderPropertyResults() {
    const box = document.getElementById('hsPropResults');
    const q = this.val('hsPropSearch').toLowerCase();
    const qd = q.replace(/\D/g, '');
    document.getElementById('hsTimeline').innerHTML = '';

    const rows = this.data.propriedades
      .map(p => ({ p, pr: this.data.produtores.find(x => x.id === p.ID_Produtor_Local) || {} }))
      .filter(({ p, pr }) => {
        if (!q) return true;
        const text = [p.Nome_Propriedade, p.Municipio, p.Comunidade_Localidade, pr.Nome_Razao_Social].join(' ').toLowerCase();
        return text.includes(q) || (qd.length >= 3 && String(pr.CPF_CNPJ || '').replace(/\D/g, '').includes(qd));
      })
      .map(row => ({ ...row, n: this.data.fiscs.filter(f => f.ID_Propriedade_Local === row.p.id).length }))
      .sort((a, b) => b.n - a.n || String(a.p.Nome_Propriedade).localeCompare(String(b.p.Nome_Propriedade), 'pt-BR'))
      .slice(0, 30);

    box.innerHTML = rows.length ? rows.map(({ p, pr, n }) => `
      <button type="button" class="result-card" onclick="HistoricoModule.renderTimeline('${this.esc(p.id)}')">
        <strong>${this.esc(p.Nome_Propriedade || 'Propriedade')}</strong>
        <span>${this.esc(pr.Nome_Razao_Social || '')} • ${this.esc(p.Municipio || '')}</span>
        <small>${n} fiscalização(ões)</small>
      </button>`).join('') : '<div class="empty-state">Nenhuma propriedade encontrada.</div>';
  },

  renderTimeline(propertyId) {
    this.selectedProperty = propertyId;
    const p = this.data.propriedades.find(x => x.id === propertyId);
    if (!p) return;
    const pr = this.data.produtores.find(x => x.id === p.ID_Produtor_Local) || {};
    document.getElementById('hsPropResults').innerHTML = '';

    const today = new Date().toISOString().slice(0, 10);
    const events = [];
    const add = (date, icon, title, detail, action = '', tone = '') => {
      if (date) events.push({ date: String(date), icon, title, detail, action, tone });
    };

    add(pr.Data_Cadastro || pr.localCreatedAt, '👤', 'Produtor cadastrado', pr.Nome_Razao_Social);
    add(p.Data_Cadastro || p.localCreatedAt, '🏡', 'Propriedade cadastrada', [p.Nome_Propriedade, p.Comunidade_Localidade].filter(Boolean).join(' — '));
    this.data.culturas.filter(c => c.ID_Propriedade_Local === p.id).forEach(c => {
      add(c.Data_Cadastro || c.localCreatedAt, '🌱', `Cultura cadastrada: ${c.Nome_Cultura_Local || c.ID_Tipo_Cultura}`,
        [c.Cultivar_Variedade, c.Area_Plantada_ha ? c.Area_Plantada_ha + ' ha' : '', c.Status === 'INATIVO' ? 'inativa' : ''].filter(Boolean).join(' • '));
    });

    const fiscs = this.data.fiscs.filter(f => f.ID_Propriedade_Local === p.id);
    fiscs.forEach(f => {
      const st = FiscalizacoesModule.status(f);
      const occ = this.data.occs.filter(o => o.ID_Fiscalizacao_Local === f.id && (o.Resultado_Avaliacao === 'DETECTADA' || o.Resultado_Avaliacao === 'SUSPEITA'));
      add(f.Data_Hora_Inicio, '📋', `Fiscalização ${st === 'FINALIZADA' ? 'finalizada' : st === 'CANCELADA' ? 'cancelada' : 'em andamento'}`,
        [f.Siglas_Programas || FiscalizacoesModule.label(FiscalizacoesModule.TIPOS_ACAO, f.Tipo_Acao), f.Nome_Servidor,
          occ.length ? occ.map(o => `${o.Nome_Praga} (${o.Resultado_Avaliacao === 'DETECTADA' ? 'detectada' : 'suspeita'})`).join(', ') : (st === 'FINALIZADA' ? 'sem ocorrência' : '')].filter(Boolean).join(' • '),
        `FiscalizacoesModule.openFromAnywhere('${this.esc(f.id)}')`,
        occ.some(o => o.Resultado_Avaliacao === 'DETECTADA') ? 'critical' : occ.length ? 'warning' : '');

      this.data.docs.filter(d => d.ID_Fiscalizacao_Local === f.id).forEach(d => {
        add(d.Data_Hora_Emissao, '📄', `Termo de Fiscalização nº ${d.Numero_Documento}`,
          d.Status_Documento === 'EMITIDO' ? 'vigente' : (d.Status_Documento || '').toLowerCase(),
          `HistoricoModule.downloadPdf('${this.esc(d.id)}')`);
      });

      this.data.amostras.filter(a => a.ID_Fiscalizacao_Local === f.id).forEach(a => {
        add(a.Data_Hora_Coleta, '🧪', `Amostra ${a.Identificacao_Amostra}`,
          [a.Tipo_Material, a.Nome_Praga_Relacionada, a.Laboratorio_Destino, a.Resultado_Diagnostico ? 'Resultado: ' + a.Resultado_Diagnostico : ''].filter(Boolean).join(' • '));
      });

      this.data.provs.filter(v => v.ID_Fiscalizacao_Local === f.id).forEach(v => {
        const late = v.Status_Providencia !== 'CUMPRIDA' && v.Prazo && v.Prazo < today;
        add(v.Data_Hora, late ? '⚠️' : '📌', `Providência: ${FiscalizacoesModule.label(FiscalizacoesModule.PROVIDENCIAS, v.Tipo_Providencia)}`,
          [v.Descricao, v.Prazo ? `prazo ${v.Prazo.split('-').reverse().join('/')}${late ? ' — VENCIDO' : ''}` : ''].filter(Boolean).join(' • '),
          '', late ? 'warning' : '');
      });
    });

    // Datas sem fuso (ex.: 2026-11-07T15:07) são horário local
    const ts = d => {
      const t = new Date(/T\d{2}:\d{2}(:\d{2})?$/.test(d) || /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + (d.length === 10 ? 'T00:00' : '') : d).getTime();
      return isNaN(t) ? 0 : t;
    };
    events.sort((a, b) => ts(b.date) - ts(a.date));

    const last = fiscs.filter(f => FiscalizacoesModule.status(f) === 'FINALIZADA')
      .sort((a, b) => String(b.Data_Hora_Inicio).localeCompare(String(a.Data_Hora_Inicio)))[0];

    document.getElementById('hsTimeline').innerHTML = `
      <div class="form-card hs-head">
        <div class="form-heading">
          <div>
            <h3>${this.esc(p.Nome_Propriedade)}</h3>
            <p>${this.esc(pr.Nome_Razao_Social || '')} • ${this.esc(p.Municipio || '')}${p.Comunidade_Localidade ? ' • ' + this.esc(p.Comunidade_Localidade) : ''}</p>
          </div>
          ${Auth.can('fiscalizar') ? `<button type="button" class="btn btn-primary fz-small" onclick="FiscalizacoesModule.startFromProperty('${this.esc(p.id)}')">📋 Nova fiscalização</button>` : ''}
        </div>
        <div class="summary-grid">
          <div><small>Fiscalizações</small><strong>${fiscs.length}</strong></div>
          <div><small>Última finalizada</small><strong>${last ? FiscalizacoesModule.formatDate(last.Data_Hora_Inicio) : '—'}</strong></div>
          <div><small>Situação na última</small><strong>${last ? this.esc(FiscalizacoesModule.label(FiscalizacoesModule.SITUACOES, last.Situacao_Fitossanitaria)) : '—'}</strong></div>
          <div><small>Termos</small><strong>${this.data.docs.filter(d => fiscs.some(f => f.id === d.ID_Fiscalizacao_Local) && d.Status_Documento === 'EMITIDO').length}</strong></div>
        </div>
      </div>

      <ol class="hs-timeline">
        ${events.map(e => `
          <li class="hs-event ${e.tone ? 'hs-' + e.tone : ''}">
            <span class="hs-dot">${e.icon}</span>
            <div class="hs-event-body ${e.action ? 'hs-clickable' : ''}" ${e.action ? `role="button" tabindex="0" onclick="${e.action}"` : ''}>
              <small>${this.fmt(e.date)}</small>
              <strong>${this.esc(e.title)}</strong>
              ${e.detail ? `<span>${this.esc(e.detail)}</span>` : ''}
            </div>
          </li>`).join('')}
      </ol>

      <button type="button" class="btn btn-secondary" onclick="HistoricoModule.selectedProperty=null;HistoricoModule.renderTimelineTab()">← Outra propriedade</button>`;
  }
};
