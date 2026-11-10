/* Defesa Vegetal AM — versão 2.0.0-alpha.15 */
/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: DASHBOARD

   Indicadores de fiscalização e de cadastros.
   Filtros (período, município, programa) no topo valem
   para todos os indicadores e gráficos abaixo.
   Cada gráfico tem valor no toque/hover e tabela.
========================================================= */

const DashboardModule = {

  produtores: [],
  propriedades: [],
  culturas: [],

  filters: {
    periodo: '365',
    municipio: '',
    programa: ''
  },


  /* =======================================================
     ABRIR DASHBOARD
  ======================================================= */

  async open() {
    const main = document.querySelector('main');
    if (!main) return;

    main.innerHTML = `
      <section class="module-page">
        <div class="module-header">
          <button type="button" class="btn btn-secondary" onclick="Nav.back()">← Voltar</button>
          <div>
            <h2>Dashboard</h2>
            <p>Indicadores de fiscalização, situação fitossanitária e cadastros.</p>
          </div>
        </div>

        <div class="db-filters" role="group" aria-label="Filtros do dashboard">
          <label>Período
            <select id="dbPeriodo">
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 12 meses</option>
              <option value="ano">Ano atual</option>
              <option value="">Todo o período</option>
            </select>
          </label>
          <label>Município
            <select id="dbMunicipio"><option value="">Todos</option></select>
          </label>
          <label>Programa
            <select id="dbPrograma"><option value="">Todos</option></select>
          </label>
        </div>

        <section id="dashboardContent"><p>Carregando indicadores...</p></section>
        <div id="dbTooltip" class="db-tooltip" role="tooltip" hidden></div>
      </section>`;

    await this.load();
  },


  /* =======================================================
     UTILITÁRIOS
  ======================================================= */

  num(value, digits = 0) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  },

  active(list) {
    return list.filter(item => item.Excluido !== 'SIM');
  },

  status(f) {
    if (f.Status_Fiscalizacao) return f.Status_Fiscalizacao;
    return { RASCUNHO: 'EM_ANDAMENTO', CONCLUIDA: 'FINALIZADA' }[f.Status] || f.Status || 'EM_ANDAMENTO';
  },

  dateOf(f) {
    const s = String(f.Data_Hora_Inicio || f.Data_Fiscalizacao || f.localCreatedAt || '');
    const d = new Date(s.length === 16 ? s + ':00' : s);
    return isNaN(d) ? null : d;
  },

  inPeriod(date) {
    const p = this.filters.periodo;
    if (!p || !date) return !p;
    const now = new Date();
    if (p === 'ano') return date.getFullYear() === now.getFullYear();
    return (now - date) / 86400000 <= Number(p);
  },

  count(list, keyFn) {
    const map = new Map();
    list.forEach(item => {
      const keys = [].concat(keyFn(item)).filter(Boolean);
      keys.forEach(k => map.set(k, (map.get(k) || 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  },


  /* =======================================================
     GRÁFICOS (HTML + CSS, sem bibliotecas)
  ======================================================= */

  /* Barras horizontais ranqueadas — uma série, uma cor */
  rankedBars(id, rows, { unit = '', max = 8, emptyText = 'Sem dados no período.' } = {}) {
    if (!rows.length) return `<p class="dashboard-empty">${emptyText}</p>`;
    const shown = rows.slice(0, max);
    const rest = rows.slice(max);
    if (rest.length) shown.push(['Outros', rest.reduce((t, r) => t + r[1], 0)]);
    const top = Math.max(...shown.map(r => r[1]), 1);

    return `
      <div class="db-hbars">
        ${shown.map(([label, value]) => `
          <div class="db-hbar" tabindex="0" data-tip-label="${this.escapeHtml(label)}" data-tip-value="${this.num(value)}${unit}">
            <span class="db-hbar-label">${this.escapeHtml(label)}</span>
            <span class="db-hbar-track"><span class="db-hbar-fill" style="width:${Math.max(2, value / top * 100)}%"></span></span>
            <span class="db-hbar-value">${this.num(value)}</span>
          </div>`).join('')}
      </div>
      ${this.tableView(id, ['Categoria', 'Quantidade'], rows.map(r => [r[0], this.num(r[1])]))}`;
  },

  /* Colunas por mês — uma série */
  monthColumns(id, months) {
    const raw = Math.max(...months.map(m => m.value), 1);
    const total = months.reduce((t, m) => t + m.value, 0);
    if (!total) return '<p class="dashboard-empty">Nenhuma fiscalização no período.</p>';
    // Escala "redonda" e par, para a linha do meio ser um número inteiro
    const step = raw <= 4 ? 2 : raw <= 10 ? 2 : raw <= 50 ? 10 : 50;
    const top = Math.ceil(raw / step) * step;
    const ticks = [top, top / 2, 0];

    return `
      <div class="db-cols-wrap">
        <div class="db-cols-axis">${ticks.map(t => `<span>${this.num(t)}</span>`).join('')}</div>
        <div class="db-cols">
          ${months.map(m => `
            <div class="db-col" tabindex="0" data-tip-label="${m.label}" data-tip-value="${this.num(m.value)} fiscalização(ões)">
              <span class="db-col-bar" style="height:${m.value ? Math.max(3, m.value / top * 100) : 0}%"></span>
              <span class="db-col-label">${m.short}</span>
            </div>`).join('')}
        </div>
      </div>
      ${this.tableView(id, ['Mês', 'Fiscalizações'], months.map(m => [m.label, this.num(m.value)]))}`;
  },

  /* Barra segmentada (parte do todo) — situação fitossanitária, cores de status */
  statusBar(id, parts) {
    const total = parts.reduce((t, p) => t + p.value, 0);
    if (!total) return '<p class="dashboard-empty">Nenhuma fiscalização finalizada no período.</p>';

    return `
      <div class="db-stack" role="img" aria-label="${parts.map(p => `${p.label}: ${p.value}`).join(', ')}">
        ${parts.filter(p => p.value).map(p => `
          <span class="db-stack-seg db-${p.key}" tabindex="0" style="flex:${p.value}"
            data-tip-label="${p.label}" data-tip-value="${this.num(p.value)} (${this.num(p.value / total * 100, 0)}%)"></span>`).join('')}
      </div>
      <div class="db-legend">
        ${parts.map(p => `
          <span><i class="db-key db-${p.key}"></i>${p.icon} ${p.label} <b>${this.num(p.value)}</b>
          <small>${this.num(p.value / total * 100, 0)}%</small></span>`).join('')}
      </div>
      ${this.tableView(id, ['Situação', 'Fiscalizações', '%'], parts.map(p => [p.label, this.num(p.value), this.num(p.value / total * 100, 1) + '%']))}`;
  },

  tableView(id, headers, rows) {
    if (!rows.length) return '';
    return `
      <details class="db-table">
        <summary>Ver tabela</summary>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${this.escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </details>`;
  },

  statTile(label, value, sub = '', tone = '') {
    return `
      <article class="dashboard-card db-stat ${tone}">
        <span>${label}</span>
        <strong>${value}</strong>
        ${sub ? `<small>${sub}</small>` : ''}
      </article>`;
  },

  card(title, subtitle, body, wide = false) {
    return `
      <section class="dashboard-section ${wide ? 'db-wide' : ''}">
        <div class="dashboard-section-header"><div>
          <h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}
        </div></div>
        ${body}
      </section>`;
  },

  bindTooltips(root = document) {
    const tip = document.getElementById('dbTooltip');
    if (!tip) return;
    const show = (el, x, y) => {
      tip.replaceChildren();
      const v = document.createElement('strong');
      v.textContent = el.dataset.tipValue;
      const l = document.createElement('span');
      l.textContent = el.dataset.tipLabel;
      tip.append(v, l);
      tip.hidden = false;
      const w = tip.offsetWidth;
      tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px';
      tip.style.top = (y - tip.offsetHeight - 12) + 'px';
    };
    root.querySelectorAll('[data-tip-value]').forEach(el => {
      el.addEventListener('pointermove', e => show(el, e.clientX, e.clientY));
      el.addEventListener('pointerdown', e => show(el, e.clientX, e.clientY));
      el.addEventListener('pointerleave', () => { tip.hidden = true; });
      el.addEventListener('focus', () => {
        const r = el.getBoundingClientRect();
        show(el, r.left + r.width / 2, r.top);
      });
      el.addEventListener('blur', () => { tip.hidden = true; });
    });
  },


  /* =======================================================
     CARREGAR DADOS
  ======================================================= */

  async load() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    container.classList.add('db-loading');

    try {
      const [produtores, propriedades, culturas, fiscs, fcs, occs, amostras, provs, docs, programas] = await Promise.all([
        dbGetAll('produtores'), dbGetAll('propriedades'), dbGetAll('culturas'),
        dbGetAll('fiscalizacoes'), dbGetAll('fiscalizacaoCulturas'), dbGetAll('ocorrenciasPragas'),
        dbGetAll('amostras'), dbGetAll('providencias'), dbGetAll('documentos'), dbGetAll('programasTecnicos')
      ]);

      this.produtores = produtores;
      this.propriedades = propriedades;
      this.culturas = culturas;

      const progName = new Map(programas.map(p => [String(p.ID_Programa), p.Sigla_Programa || p.ID_Programa]));

      /* Opções dos filtros (montadas uma vez) */
      const munSel = document.getElementById('dbMunicipio');
      const progSel = document.getElementById('dbPrograma');
      const perSel = document.getElementById('dbPeriodo');
      if (munSel && munSel.options.length === 1) {
        const muns = [...new Set([...propriedades.map(p => p.Municipio), ...fiscs.map(f => f.Municipio)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        munSel.innerHTML += muns.map(m => `<option>${this.escapeHtml(m)}</option>`).join('');
        progSel.innerHTML += [...progName.entries()].map(([id, sig]) => `<option value="${this.escapeHtml(id)}">${this.escapeHtml(sig)}</option>`).join('');
        perSel.value = this.filters.periodo;
        munSel.value = this.filters.municipio;
        progSel.value = this.filters.programa;
        const apply = () => {
          this.filters = { periodo: perSel.value, municipio: munSel.value, programa: progSel.value };
          this.load();
        };
        perSel.onchange = munSel.onchange = progSel.onchange = apply;
      }

      const F = this.filters;

      /* Fiscalizações no recorte */
      const fiscAll = this.active(fiscs);
      const fiscF = fiscAll.filter(f =>
        this.inPeriod(this.dateOf(f)) &&
        (!F.municipio || f.Municipio === F.municipio) &&
        (!F.programa || String(f.ID_Programa || '').split(',').includes(F.programa))
      );
      const ids = new Set(fiscF.map(f => f.id));
      const ofF = list => this.active(list).filter(x => ids.has(x.ID_Fiscalizacao_Local));

      const finalizadas = fiscF.filter(f => this.status(f) === 'FINALIZADA');
      const andamento = fiscF.filter(f => this.status(f) === 'EM_ANDAMENTO');
      const occF = ofF(occs);
      const detectadas = occF.filter(o => o.Resultado_Avaliacao === 'DETECTADA');
      const suspeitas = occF.filter(o => o.Resultado_Avaliacao === 'SUSPEITA');
      const amostrasF = ofF(amostras);
      const provF = ofF(provs);
      const hoje = new Date().toISOString().slice(0, 10);
      const provPend = provF.filter(p => p.Status_Providencia !== 'CUMPRIDA');
      const provVenc = provPend.filter(p => p.Prazo && p.Prazo < hoje);
      const termos = ofF(docs).filter(d => d.Tipo_Documento === 'TERMO_FISCALIZACAO' && d.Status_Documento === 'EMITIDO');
      const propsFisc = new Set(fiscF.map(f => f.ID_Propriedade_Local)).size;

      /* Fiscalizações por mês (últimos 12 meses ou ano) */
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          short: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
          value: 0
        });
      }
      fiscAll.filter(f =>
        (!F.municipio || f.Municipio === F.municipio) &&
        (!F.programa || String(f.ID_Programa || '').split(',').includes(F.programa))
      ).forEach(f => {
        const d = this.dateOf(f);
        if (!d) return;
        const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
        if (m) m.value++;
      });

      /* Situação fitossanitária das finalizadas */
      const sit = key => finalizadas.filter(f => f.Situacao_Fitossanitaria === key).length;
      const situacao = [
        { key: 'good', label: 'Sem ocorrência', icon: '✓', value: sit('SEM_OCORRENCIA') },
        { key: 'warning', label: 'Suspeita', icon: '!', value: sit('SUSPEITA') },
        { key: 'critical', label: 'Ocorrência confirmada', icon: '✕', value: sit('COM_OCORRENCIA') }
      ];

      /* Cadastros */
      const areaTotal = culturas.reduce((t, c) => t + Number(String(c.Area_Producao_ha || c.Area_Plantada_ha || 0).replace(',', '.')) || t, 0);

      /* Cobertura anual (ano corrente; respeita só o filtro de município) */
      const anoCob = now.getFullYear();
      const cobAll = Relatorios.coverage({ propriedades, fiscalizacoes: fiscAll, produtores }, anoCob);
      const cob = F.municipio ? Relatorios.coverage({ propriedades, fiscalizacoes: fiscAll, produtores }, anoCob, { municipio: F.municipio }) : cobAll;
      this.cobertura = cobAll;
      const emDia = cob.visitadas >= cob.metaAteMes;

      container.innerHTML = `
        <h3 class="db-group-title">Cobertura anual de propriedades — ${anoCob}${F.municipio ? ' • ' + this.escapeHtml(F.municipio) : ''}</h3>
        <div class="dashboard-summary">
          ${this.statTile('Cobertura do ano', this.num(cob.pct * 100, 0) + '%', `${this.num(cob.visitadas)} de ${this.num(cob.total)} propriedade(s) visitadas`)}
          ${this.statTile('Faltam visitar', this.num(cob.faltam), cob.mesesRestantes ? `${this.num(cob.mesesRestantes)} mês(es) até dezembro` : 'ano encerrado')}
          ${this.statTile('Meta até este mês', this.num(cob.metaAteMes), cob.total ? (emDia ? '✓ em dia' : `! ${this.num(cob.metaAteMes - cob.visitadas)} abaixo da meta`) : 'sem propriedades', cob.total && !emDia ? 'db-warning-tile' : '')}
          ${this.statTile('Ritmo necessário', cob.mesesRestantes ? this.num(cob.ritmo) : '—', 'propriedades por mês')}
        </div>
        <div class="db-grid">
          ${this.card('Mapa de cobertura por município', `Propriedades ativas com ao menos uma fiscalização finalizada em ${anoCob}. Toque num município para ver os números.`, `
            <div id="dbMapa" class="db-map"><p class="dashboard-empty">Carregando mapa...</p></div>
            <div class="db-map-actions">
              <button type="button" class="btn btn-secondary" onclick="Relatorios.coverageReport({ ano: ${anoCob}, municipio: DashboardModule.filters.municipio })">📄 Relatório de cobertura${F.municipio ? ' — ' + this.escapeHtml(F.municipio) : ''}</button>
            </div>`, true)}
        </div>

        <h3 class="db-group-title">Fiscalização</h3>
        <div class="dashboard-summary">
          ${this.statTile('Fiscalizações', this.num(fiscF.length), `${this.num(propsFisc)} propriedade(s)`)}
          ${this.statTile('Finalizadas', this.num(finalizadas.length), `${this.num(andamento.length)} em andamento`)}
          ${this.statTile('Termos emitidos', this.num(termos.length))}
          ${this.statTile('Pragas detectadas', this.num(detectadas.length), `${this.num(suspeitas.length)} suspeita(s)`, detectadas.length ? 'db-critical-tile' : '')}
          ${this.statTile('Amostras coletadas', this.num(amostrasF.length))}
          ${this.statTile('Providências pendentes', this.num(provPend.length), provVenc.length ? `⚠ ${this.num(provVenc.length)} com prazo vencido` : 'nenhuma vencida', provVenc.length ? 'db-warning-tile' : '')}
        </div>

        <div class="db-grid">
          ${this.card('Fiscalizações por mês', 'Últimos 12 meses (filtros de município e programa aplicados)', this.monthColumns('m', months), true)}
          ${this.card('Situação fitossanitária', 'Fiscalizações finalizadas no período', this.statusBar('s', situacao))}
          ${this.card('Pragas detectadas ou suspeitas', 'Ocorrências registradas no período', this.rankedBars('p', this.count([...detectadas, ...suspeitas], o => o.Nome_Praga)))}
          ${this.card('Fiscalizações por programa', '', this.rankedBars('g', this.count(fiscF, f => String(f.ID_Programa || '').split(',').filter(Boolean).map(id => progName.get(id) || id)), { emptyText: 'Nenhuma fiscalização de programa no período.' }))}
          ${this.card('Fiscalizações por município', '', this.rankedBars('u', this.count(fiscF, f => f.Municipio || 'Não informado')))}
          ${this.card('Culturas fiscalizadas', '', this.rankedBars('c', this.count(ofF(fcs), c => c.Nome_Cultura_Local)))}
          ${provVenc.length ? this.card('⚠ Providências com prazo vencido', 'Toque para abrir a fiscalização', `
            <div class="db-list">${provVenc.sort((a, b) => a.Prazo.localeCompare(b.Prazo)).map(p => {
              const f = fiscF.find(x => x.id === p.ID_Fiscalizacao_Local) || {};
              return `<button type="button" class="result-card" onclick="FiscalizacoesModule.openFromAnywhere('${this.escapeHtml(f.id || '')}')">
                <strong>${this.escapeHtml(p.Descricao)}</strong>
                <span>${this.escapeHtml(f.Nome_Propriedade_Local || '')} • ${this.escapeHtml(f.Municipio || '')}</span>
                <small>Prazo: ${p.Prazo.split('-').reverse().join('/')} • ${this.escapeHtml(f.Numero_Fiscalizacao || '')}</small></button>`;
            }).join('')}</div>`, true) : ''}
        </div>

        <h3 class="db-group-title">Cadastros</h3>
        <div class="dashboard-summary">
          ${this.statTile('Produtores', this.num(produtores.length))}
          ${this.statTile('Propriedades', this.num(propriedades.length))}
          ${this.statTile('Culturas', this.num(culturas.length))}
          ${this.statTile('Área de produção', this.num(areaTotal, 1) + ' ha')}
        </div>

        <div class="db-grid">
          ${this.card('Propriedades por município', 'Todas as propriedades cadastradas', this.rankedBars('pm', this.count(propriedades, p => p.Municipio || 'Não informado'), { emptyText: 'Nenhuma propriedade cadastrada.' }))}
          ${this.card('Culturas cadastradas', 'Por tipo de cultura', this.rankedBars('cc', this.count(culturas.filter(c => c.Status !== 'INATIVO'), c => c.Nome_Cultura_Local || c.ID_Tipo_Cultura), { emptyText: 'Nenhuma cultura cadastrada.' }))}
        </div>

        <section class="dashboard-section">
          <div class="dashboard-section-header"><div>
            <h3>Consultar cadastros</h3>
            <p>Visualize e pesquise produtores e propriedades cadastradas.</p>
          </div></div>
          <div class="dashboard-consult-actions">
            <button type="button" class="btn btn-primary" onclick="DashboardModule.showProdutores()">👤 Visualizar produtores</button>
            <button type="button" class="btn btn-secondary" onclick="DashboardModule.showPropriedades()">🌱 Visualizar propriedades</button>
          </div>
          <div id="dashboardConsulta" class="dashboard-consulta">
            <p class="dashboard-empty">Selecione uma opção acima para consultar os cadastros.</p>
          </div>
        </section>`;

      this.bindTooltips();
      this.renderMap(cobAll, F.municipio);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      container.innerHTML = `<div class="empty-state">Não foi possível carregar os indicadores.</div>`;
    }

    container.classList.remove('db-loading');
  },


  /* =======================================================
     MAPA DE COBERTURA (municípios do Amazonas)
     Limites: IBGE (API de malhas), baixados na 1ª vez com
     internet e guardados no aparelho para uso offline.
  ======================================================= */

  MAPA_META_KEY: 'mapaMunicipiosAM_v1',
  MAPA_URL: 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/13?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=minima',
  MAPA_NOMES_URL: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/13/municipios',

  /* Escala sequencial de um só tom (verde) + neutro para "sem propriedades" */
  MAPA_ESCALA: [
    { min: 0, max: 0, cor: '#e4f1e8', label: '0%' },
    { min: 0, max: 0.25, cor: '#b9dcc4', label: 'até 25%' },
    { min: 0.25, max: 0.5, cor: '#86c39b', label: '25–50%' },
    { min: 0.5, max: 0.75, cor: '#4ea36e', label: '50–75%' },
    { min: 0.75, max: 1, cor: '#21804a', label: '75–99%' },
    { min: 1, max: 1, cor: '#0d4f2a', label: '100%' }
  ],
  MAPA_SEM_DADOS: '#f4f5f6',

  colorFor(pct) {
    const e = this.MAPA_ESCALA;
    if (pct <= 0) return e[0].cor;
    if (pct >= 1) return e[5].cor;
    return (e.slice(1, 5).find(x => pct <= x.max) || e[4]).cor;
  },

  async fetchJson(url, ms = 20000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  },

  /* GeoJSON -> caminhos SVG já projetados (pequeno para guardar) */
  buildShapes(geo, nomes) {
    const nameByCode = new Map((nomes || []).map(m => [String(m.id), m.nome]));
    const feats = (geo.features || []).filter(f => f.geometry);
    const polys = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    feats.forEach(f => polys(f).forEach(poly => poly.forEach(ring => ring.forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }))));
    const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    const W = 1000;
    const scale = W / ((maxX - minX) * k);
    const H = Math.ceil((maxY - minY) * scale);
    const px = x => ((x - minX) * k * scale).toFixed(1);
    const py = y => ((maxY - y) * scale).toFixed(1);
    const shapes = feats.map(f => {
      const code = String(f.properties?.codarea || f.properties?.CD_MUN || f.id || '');
      const d = polys(f).map(poly => poly.map(ring =>
        'M' + ring.map(([x, y]) => px(x) + ' ' + py(y)).join('L') + 'Z').join('')).join('');
      return { code, nome: nameByCode.get(code) || f.properties?.nome || f.properties?.NM_MUN || code, d };
    });
    return { w: W, h: H, shapes, fonte: 'IBGE — malha municipal', baixadoEm: new Date().toISOString() };
  },

  async loadShapes() {
    const cached = await getMeta(this.MAPA_META_KEY);
    if (cached?.shapes?.length) return cached;
    if (!navigator.onLine) return null;
    const [geo, nomes] = await Promise.all([this.fetchJson(this.MAPA_URL), this.fetchJson(this.MAPA_NOMES_URL)]);
    const built = this.buildShapes(geo, nomes);
    if (!built.shapes.length) return null;
    await setMeta(this.MAPA_META_KEY, built);
    return built;
  },

  async renderMap(cob, selected = '') {
    const box = document.getElementById('dbMapa');
    if (!box) return;
    const byMun = new Map(cob.municipios.map(r => [Relatorios.normMun(r.municipio), r]));
    const tableRows = cob.municipios.slice()
      .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
      .map(r => [r.municipio, this.num(r.total), this.num(r.visitadas), this.num(r.faltam), this.num(r.pct * 100, 0) + '%']);
    const table = this.tableView('mapa', ['Município', 'Propriedades', 'Visitadas', 'Faltam', 'Cobertura'], tableRows);

    let mapa = null;
    try {
      mapa = await this.loadShapes();
    } catch (error) {
      console.warn('Mapa indisponível:', error);
    }
    if (!document.body.contains(box)) return;

    if (!mapa) {
      box.innerHTML = `
        <p class="db-map-off">🗺️ O mapa precisa de internet na primeira vez, para baixar os limites dos municípios (IBGE). Depois ele funciona sem internet. Enquanto isso, a cobertura por município:</p>
        ${this.rankedBars('mapaoff', cob.municipios.slice().sort((a, b) => a.pct - b.pct).map(r => [r.municipio, Math.round(r.pct * 100)]), { unit: '%', max: 80, emptyText: 'Nenhuma propriedade ativa cadastrada.' }).replace(/<details class="db-table">[\s\S]*<\/details>/, '')}
        ${table}`;
      this.bindTooltips(box);
      return;
    }

    const selKey = Relatorios.normMun(selected);
    const matched = new Set();
    const paths = mapa.shapes.map(sh => {
      const key = Relatorios.normMun(sh.nome);
      const r = byMun.get(key);
      if (r) matched.add(key);
      const fill = r && r.total ? this.colorFor(r.pct) : this.MAPA_SEM_DADOS;
      const tipV = r && r.total ? `${this.num(r.pct * 100, 0)}% visitadas` : 'Sem propriedades cadastradas';
      const tipL = r && r.total ? `${sh.nome}: ${this.num(r.visitadas)} de ${this.num(r.total)} • faltam ${this.num(r.faltam)}` : sh.nome;
      return `<path d="${sh.d}" fill="${fill}" class="${key === selKey ? 'sel' : ''}" tabindex="0"
        data-mun="${this.escapeHtml(sh.nome)}" data-tip-value="${this.escapeHtml(tipV)}" data-tip-label="${this.escapeHtml(tipL)}"><title>${this.escapeHtml(sh.nome)}</title></path>`;
    });
    const unmatched = cob.municipios.filter(r => !matched.has(Relatorios.normMun(r.municipio)));
    const sel = selKey ? mapa.shapes.findIndex(sh => Relatorios.normMun(sh.nome) === selKey) : -1;
    if (sel >= 0) paths.push(paths.splice(sel, 1)[0]); // desenha o selecionado por cima

    box.innerHTML = `
      <svg viewBox="0 0 ${mapa.w} ${mapa.h}" role="img" aria-label="Mapa do Amazonas com a cobertura anual de visitas por município">${paths.join('')}</svg>
      <div class="db-legend db-map-legend">
        ${this.MAPA_ESCALA.map(e => `<span><i class="db-key" style="background:${e.cor}"></i>${e.label}</span>`).join('')}
        <span><i class="db-key db-key-empty" style="background:${this.MAPA_SEM_DADOS}"></i>sem propriedades</span>
      </div>
      ${unmatched.length ? `<p class="db-map-note">Não localizados no mapa (verifique o nome do município no cadastro): ${unmatched.map(r => this.escapeHtml(r.municipio)).join(', ')}.</p>` : ''}
      <p class="db-map-note">Limites municipais: IBGE.</p>
      ${table}`;
    this.bindTooltips(box);
  },


  /* =======================================================
     VISUALIZAR PRODUTORES
  ======================================================= */

  showProdutores() {

    const container =
      document.getElementById(
        'dashboardConsulta'
      );

    if (!container) {
      return;
    }


    container.innerHTML = `

      <div class="dashboard-list-header">

        <div>

          <h4>
            Produtores cadastrados
          </h4>

          <span>
            ${this.produtores.length}
            registro(s)
          </span>

        </div>

      </div>


      <div class="dashboard-search">

        <input
          type="search"
          id="dashboardSearchProdutor"
          placeholder="Pesquisar por nome, CPF/CNPJ, telefone ou e-mail..."
          oninput="
            DashboardModule.filterProdutores(
              this.value
            )
          "
        >

      </div>


      <div
        id="dashboardListaProdutores"
        class="dashboard-record-list"
      ></div>

    `;


    this.renderProdutores(
      this.produtores
    );
  },


  /* =======================================================
     FILTRAR PRODUTORES
  ======================================================= */

  filterProdutores(searchTerm) {

    const termo =
      String(searchTerm || '')
        .toLowerCase()
        .trim();


    if (!termo) {

      this.renderProdutores(
        this.produtores
      );

      return;
    }


    const filtrados =
      this.produtores.filter(
        produtor => {

          const texto =
            [
              produtor.Nome_Razao_Social,
              produtor.CPF_CNPJ,
              produtor.Telefone,
              produtor.Email,
              produtor.Tipo_Pessoa,
              produtor.Status
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();


          return texto.includes(
            termo
          );
        }
      );


    this.renderProdutores(
      filtrados
    );
  },


  /* =======================================================
     RENDERIZAR PRODUTORES
  ======================================================= */

  renderProdutores(lista) {

    const container =
      document.getElementById(
        'dashboardListaProdutores'
      );

    if (!container) {
      return;
    }


    if (!lista.length) {

      container.innerHTML = `

        <div class="empty-state">
          Nenhum produtor encontrado.
        </div>

      `;

      return;
    }


    container.innerHTML =
      lista
        .map(
          produtor => {

            const nome =
              produtor.Nome_Razao_Social ||
              'Produtor sem nome';


            const cpfCnpj =
              produtor.CPF_CNPJ ||
              'Não informado';


            const telefone =
              produtor.Telefone ||
              'Não informado';


            const email =
              produtor.Email ||
              'Não informado';


            const tipoPessoa =
              produtor.Tipo_Pessoa ||
              'Não informado';


            return `

              <article
                class="dashboard-record-card"
              >

                <div
                  class="dashboard-record-icon"
                >
                  👤
                </div>


                <div
                  class="dashboard-record-content"
                >

                  <strong>
                    ${this.escapeHtml(nome)}
                  </strong>


                  <span>
                    CPF/CNPJ:
                    ${this.escapeHtml(cpfCnpj)}
                  </span>


                  <span>
                    Telefone:
                    ${this.escapeHtml(telefone)}
                  </span>


                  <span>
                    E-mail:
                    ${this.escapeHtml(email)}
                  </span>


                  <span>
                    Tipo:
                    ${this.escapeHtml(tipoPessoa)}
                  </span>

                </div>

              </article>

            `;
          }
        )
        .join('');
  },


  /* =======================================================
     VISUALIZAR PROPRIEDADES
  ======================================================= */

  showPropriedades() {

    const container =
      document.getElementById(
        'dashboardConsulta'
      );

    if (!container) {
      return;
    }


    container.innerHTML = `

      <div class="dashboard-list-header">

        <div>

          <h4>
            Propriedades cadastradas
          </h4>

          <span>
            ${this.propriedades.length}
            registro(s)
          </span>

        </div>

      </div>


      <div class="dashboard-search">

        <input
          type="search"
          id="dashboardSearchPropriedade"
          placeholder="Pesquisar por propriedade, município ou produtor..."
          oninput="
            DashboardModule.filterPropriedades(
              this.value
            )
          "
        >

      </div>


      <div
        id="dashboardListaPropriedades"
        class="dashboard-record-list"
      ></div>

    `;


    this.renderPropriedades(
      this.propriedades
    );
  },


  /* =======================================================
     FILTRAR PROPRIEDADES
  ======================================================= */

  filterPropriedades(searchTerm) {

    const termo =
      String(searchTerm || '')
        .toLowerCase()
        .trim();


    if (!termo) {

      this.renderPropriedades(
        this.propriedades
      );

      return;
    }


    const filtradas =
      this.propriedades.filter(
        propriedade => {

          const produtor =
            this.getProdutorDaPropriedade(
              propriedade
            );


          const nomeProdutor =
            produtor
              ? produtor.Nome_Razao_Social
              : '';


          const texto =
            [
              propriedade.Nome_Propriedade,
              propriedade.Codigo_Propriedade_Oficial,
              propriedade.Propriedade_Comercial,
              propriedade.Comunidade_Localidade,
              propriedade.Municipio,
              propriedade.UF,
              nomeProdutor
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();


          return texto.includes(
            termo
          );
        }
      );


    this.renderPropriedades(
      filtradas
    );
  },


  /* =======================================================
     RENDERIZAR PROPRIEDADES
  ======================================================= */

  renderPropriedades(lista) {

    const container =
      document.getElementById(
        'dashboardListaPropriedades'
      );

    if (!container) {
      return;
    }


    if (!lista.length) {

      container.innerHTML = `

        <div class="empty-state">
          Nenhuma propriedade encontrada.
        </div>

      `;

      return;
    }


    container.innerHTML =
      lista
        .map(
          propriedade => {

            const nome =
              propriedade.Nome_Propriedade ||
              'Propriedade sem nome';


            const municipio =
              propriedade.Municipio ||
              'Não informado';


            const comunidade =
              propriedade.Comunidade_Localidade ||
              'Não informado';


            const areaTotal =
              propriedade.Area_Total_ha;


            const areaAgricola =
              propriedade.Area_Agricola_ha;


            const produtor =
              this.getProdutorDaPropriedade(
                propriedade
              );


            const nomeProdutor =
              produtor
                ? (
                    produtor.Nome_Razao_Social ||
                    'Não informado'
                  )
                : 'Não informado';


            return `

              <article
                class="dashboard-record-card"
              >

                <div
                  class="dashboard-record-icon"
                >
                  🌱
                </div>


                <div
                  class="dashboard-record-content"
                >

                  <strong>
                    ${this.escapeHtml(nome)}
                  </strong>


                  <span>
                    Produtor:
                    ${this.escapeHtml(
                      nomeProdutor
                    )}
                  </span>


                  <span>
                    Município:
                    ${this.escapeHtml(
                      municipio
                    )}
                  </span>


                  <span>
                    Comunidade/Localidade:
                    ${this.escapeHtml(
                      comunidade
                    )}
                  </span>


                  ${
                    areaTotal !== undefined &&
                    areaTotal !== null &&
                    areaTotal !== ''

                      ? `

                        <span>
                          Área total:
                          ${this.escapeHtml(
                            areaTotal
                          )} ha
                        </span>

                      `

                      : ''
                  }


                  ${
                    areaAgricola !== undefined &&
                    areaAgricola !== null &&
                    areaAgricola !== ''

                      ? `

                        <span>
                          Área agrícola:
                          ${this.escapeHtml(
                            areaAgricola
                          )} ha
                        </span>

                      `

                      : ''
                  }

                </div>

              </article>

            `;
          }
        )
        .join('');
  },


  /* =======================================================
     ENCONTRAR PRODUTOR VINCULADO À PROPRIEDADE
  ======================================================= */

  getProdutorDaPropriedade(
    propriedade
  ) {

    /*
       O sistema possui registros locais e registros
       sincronizados com o servidor.

       Por isso aceitamos diferentes identificadores.
    */

    const idsPropriedade = [

      propriedade.ID_Produtor,

      propriedade.ID_Produtor_Local,

      propriedade.ID_Proprietario,

      propriedade.idProdutor,

      propriedade.idProdutorLocal

    ]
      .filter(
        valor =>
          valor !== undefined &&
          valor !== null &&
          String(valor).trim() !== ''
      )
      .map(
        valor =>
          String(valor).trim()
      );


    if (!idsPropriedade.length) {
      return null;
    }


    const produtorEncontrado =
      this.produtores.find(
        produtor => {

          const idsProdutor = [

            produtor.ID_Produtor,

            produtor.id,

            produtor.ID_Servidor_Cadastro

          ]
            .filter(
              valor =>
                valor !== undefined &&
                valor !== null &&
                String(valor).trim() !== ''
            )
            .map(
              valor =>
                String(valor).trim()
            );


          return idsPropriedade.some(
            id =>
              idsProdutor.includes(id)
          );
        }
      );


    return (
      produtorEncontrado ||
      null
    );
  },


  /* =======================================================
     PROTEÇÃO DE TEXTO
  ======================================================= */

  escapeHtml(value) {

    return String(
      value ?? ''
    )
      .replaceAll(
        '&',
        '&amp;'
      )
      .replaceAll(
        '<',
        '&lt;'
      )
      .replaceAll(
        '>',
        '&gt;'
      )
      .replaceAll(
        '"',
        '&quot;'
      )
      .replaceAll(
        "'",
        '&#039;'
      );
  }

};
