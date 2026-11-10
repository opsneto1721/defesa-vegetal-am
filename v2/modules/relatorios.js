/* =========================================================
   DEFESA VEGETAL AM - V2
   RELATÓRIOS

   - Por praga: mensal e anual (detecções, suspeitas,
     avaliações sem detecção, municípios, amostras, focos)
   - Atividade por servidor: mensal (prestação de contas)

   Usa os dados sincronizados no aparelho (todos os
   aparelhos, depois de sincronizar). Gera um documento A4
   para imprimir ou salvar em PDF.
========================================================= */

const Relatorios = {

  MESES: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  num(v, d = 0) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  },

  pct(a, b) {
    return b ? this.num(a / b * 100, 1) + '%' : '—';
  },

  active(list) {
    return list.filter(x => x.Excluido !== 'SIM');
  },

  dateOf(value) {
    const s = String(value || '');
    if (!s) return null;
    const d = new Date(/T\d{2}:\d{2}(:\d{2})?$/.test(s) ? s : s.length === 10 ? s + 'T00:00' : s);
    return isNaN(d) ? null : d;
  },

  fmtDate(value) {
    const d = this.dateOf(value);
    return d ? d.toLocaleDateString('pt-BR') : '';
  },

  inMonth(value, year, month) {
    const d = this.dateOf(value);
    return !!d && d.getFullYear() === year && d.getMonth() === month;
  },

  inYear(value, year) {
    const d = this.dateOf(value);
    return !!d && d.getFullYear() === year;
  },

  status(f) {
    return FiscalizacoesModule.status(f);
  },

  team(f) {
    return FiscalizacoesModule.getTeam(f);
  },

  async loadData() {
    const names = ['produtores', 'propriedades', 'culturas', 'fiscalizacoes', 'fiscalizacaoCulturas',
      'ocorrenciasPragas', 'amostras', 'providencias', 'documentos', 'cadastroPragas', 'programasTecnicos', 'servidores'];
    const values = await Promise.all(names.map(n => dbGetAll(n)));
    const d = {};
    names.forEach((n, i) => { d[n] = ['cadastroPragas', 'programasTecnicos', 'servidores', 'produtores', 'propriedades', 'culturas'].includes(n) ? values[i] : this.active(values[i]); });
    d.fiscById = new Map(d.fiscalizacoes.map(f => [f.id, f]));
    d.termoByFisc = new Map();
    d.documentos.filter(x => x.Tipo_Documento === 'TERMO_FISCALIZACAO' && x.Status_Documento === 'EMITIDO')
      .forEach(x => d.termoByFisc.set(x.ID_Fiscalizacao_Local, x));
    return d;
  },

  pestKey(o) {
    return String(o.ID_Praga || ('NOME:' + String(o.Nome_Praga || '').toLowerCase()));
  },


  /* =======================================================
     DOCUMENTO (cabeçalho, estilos, impressão)
  ======================================================= */

  css() {
    return `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #1b2430; font-size: 9.2pt; margin: 0; }
      .doc { width: 210mm; padding: 9mm 11mm; margin: 0 auto; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      table { width: 100%; border-collapse: collapse; }
      .hdr td { vertical-align: middle; }
      .hdr img.b { height: 14mm; }
      .hdr img.l { height: 11mm; }
      .org .gov { font-size: 7.6pt; letter-spacing: .06em; color: #4a5866; }
      .org .ag { font-size: 9pt; font-weight: 700; color: #12335f; }
      .org .ger { font-size: 7.6pt; color: #4a5866; }
      .rule { height: 1mm; background: #12335f; margin-top: 1.5mm; }
      .rule2 { height: .5mm; background: #1f8a4c; margin-bottom: 3mm; }
      h1 { font-size: 15pt; color: #12335f; margin: 0; }
      .sub { color: #4a5866; font-size: 9pt; margin: 1mm 0 3mm; }
      h2 { font-size: 8.8pt; color: #12335f; text-transform: uppercase; letter-spacing: .06em; margin: 5mm 0 1.6mm; padding-bottom: 1mm; border-bottom: 1px solid #12335f; }
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; }
      .kpi { border: 1px solid #d5dde5; border-radius: 1.5mm; padding: 2mm 2.5mm; }
      .kpi span { display: block; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7886; }
      .kpi b { font-size: 15pt; color: #12335f; }
      .kpi small { display: block; color: #4a5866; font-size: 7.4pt; }
      .grid th, .grid td { border: 1px solid #d5dde5; padding: 1mm 1.5mm; text-align: left; vertical-align: top; font-size: 8pt; }
      .grid th { background: #12335f; color: #fff; font-weight: 600; font-size: 7.4pt; }
      .grid tr:nth-child(even) td { background: #f6f8fa; }
      .grid td.n, .grid th.n { text-align: right; font-variant-numeric: tabular-nums; }
      .grid tr.tot td { font-weight: 700; background: #e8eef5; }
      .pos { color: #b42318; font-weight: 700; }
      .sus { color: #b54708; font-weight: 700; }
      .neg { color: #17673a; }
      .muted { color: #6b7886; }
      .empty { color: #6b7886; font-style: italic; padding: 2mm 0; }
      .note { font-size: 7.6pt; color: #4a5866; margin-top: 2mm; }
      .signs { margin-top: 12mm; }
      .signs td { width: 50%; text-align: center; padding: 0 6mm; vertical-align: bottom; }
      .signs img { max-height: 13mm; max-width: 60mm; mix-blend-mode: multiply; }
      .line { border-top: 1px solid #1b2430; padding-top: 1mm; font-size: 8pt; color: #4a5866; }
      .line b { color: #1b2430; }
      .foot { margin-top: 6mm; border-top: 1px solid #d5dde5; padding-top: 1.5mm; font-size: 6.8pt; color: #6b7886; display: flex; justify-content: space-between; }
      .noprint { position: fixed; top: 8px; right: 8px; padding: 8px 14px; border: 0; border-radius: 8px; background: #12335f; color: #fff; font-size: 14px; }
      @media print { .noprint { display: none; } }
    `;
  },

  page(title, subtitle, body) {
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(', ', ' ');
    const user = Auth.getUser();
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${this.esc(title)}</title><style>${this.css()}</style></head><body>
      <button class="noprint" onclick="print()">Imprimir / salvar PDF</button>
      <div class="doc">
        <table class="hdr"><tr>
          <td style="width:18mm"><img class="b" src="${TERMO_ASSETS.brasaoAM}" alt=""></td>
          <td class="org"><div class="gov">GOVERNO DO ESTADO DO AMAZONAS</div>
            <div class="ag">Agência de Defesa Agropecuária e Florestal do Estado do Amazonas – ADAF/AM</div>
            <div class="ger">Gerência de Defesa Vegetal</div></td>
          <td style="width:26mm;text-align:right"><img class="l" src="${TERMO_ASSETS.logoADAF}" alt=""></td>
        </tr></table>
        <div class="rule"></div><div class="rule2"></div>
        <h1>${this.esc(title)}</h1>
        <div class="sub">${subtitle}</div>
        ${body}
        <div class="foot"><span>Emitido em ${now}${user ? ' por ' + this.esc(user.Nome_Completo) : ''} • Defesa Vegetal AM ${this.esc(APP_CONFIG.APP_VERSION)}</span>
          <span>Fonte: registros sincronizados neste aparelho</span></div>
      </div></body></html>`;
  },

  table(headers, rows, opts = {}) {
    if (!rows.length) return `<div class="empty">${opts.empty || 'Nenhum registro no período.'}</div>`;
    const numCols = opts.numCols || [];
    return `<table class="grid"><tr>${headers.map((h, i) => `<th class="${numCols.includes(i) ? 'n' : ''}">${h}</th>`).join('')}</tr>
      ${rows.map(r => `<tr class="${r._tot ? 'tot' : ''}">${(r.cells || r).map((c, i) => `<td class="${numCols.includes(i) ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  },

  /* Abre a janela no momento do toque (evita bloqueio de pop-up) */
  prepareWindow() {
    const win = window.open('', '_blank');
    if (!win) {
      App.showMessage('Permita pop-ups para abrir o relatório.', 'warning');
      return null;
    }
    win.document.write('<p style="font-family:sans-serif;padding:20px">Gerando relatório...</p>');
    return win;
  },

  open(html, win) {
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  },


  /* =======================================================
     RELATÓRIO POR PRAGA (mensal ou anual)
  ======================================================= */

  async pestReport({ tipo, ano, mes, praga = '', municipio = '' }) {
    const win = this.prepareWindow();
    if (!win) return;
    const d = await this.loadData();
    const e = v => this.esc(v);
    const anual = tipo === 'ANUAL';
    const periodo = anual ? `Ano de ${ano}` : `${this.MESES[mes]} de ${ano}`;

    const fiscs = d.fiscalizacoes.filter(f =>
      this.status(f) === 'FINALIZADA' &&
      (anual ? this.inYear(f.Data_Hora_Inicio, ano) : this.inMonth(f.Data_Hora_Inicio, ano, mes)) &&
      (!municipio || f.Municipio === municipio));
    const fIds = new Set(fiscs.map(f => f.id));

    const occs = d.ocorrenciasPragas.filter(o =>
      fIds.has(o.ID_Fiscalizacao_Local) &&
      o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA' &&
      (!praga || this.pestKey(o) === praga));

    const amostras = d.amostras.filter(a => fIds.has(a.ID_Fiscalizacao_Local) &&
      (!praga || occs.some(o => o.id === a.ID_Ocorrencia_Local)));

    /* Resumo por praga */
    const byPest = new Map();
    occs.forEach(o => {
      const k = this.pestKey(o);
      if (!byPest.has(k)) byPest.set(k, { nome: o.Nome_Praga, cient: o.Nome_Cientifico, props: new Set(), aval: 0, det: 0, sus: 0, neg: 0, muns: new Set(), occIds: new Set() });
      const p = byPest.get(k);
      const f = d.fiscById.get(o.ID_Fiscalizacao_Local) || {};
      p.props.add(f.ID_Propriedade_Local);
      p.aval++;
      p.occIds.add(o.id);
      if (o.Resultado_Avaliacao === 'DETECTADA') { p.det++; p.muns.add(f.Municipio); }
      else if (o.Resultado_Avaliacao === 'SUSPEITA') p.sus++;
      else p.neg++;
    });
    const pests = [...byPest.values()].sort((a, b) => b.det - a.det || b.sus - a.sus || a.nome.localeCompare(b.nome, 'pt-BR'));

    const det = occs.filter(o => o.Resultado_Avaliacao === 'DETECTADA');
    const sus = occs.filter(o => o.Resultado_Avaliacao === 'SUSPEITA');
    const propsAval = new Set(occs.map(o => (d.fiscById.get(o.ID_Fiscalizacao_Local) || {}).ID_Propriedade_Local)).size;
    const munsAll = new Set(occs.map(o => (d.fiscById.get(o.ID_Fiscalizacao_Local) || {}).Municipio));

    const pestName = praga ? (pests[0]?.nome || d.cadastroPragas.find(p => String(p.ID_Praga) === praga)?.Nome_Comum || 'Praga') : 'Todas as pragas';

    let body = `
      <div class="kpis">
        <div class="kpi"><span>Fiscalizações finalizadas</span><b>${this.num(fiscs.length)}</b><small>${this.num(new Set(fiscs.map(f => f.ID_Propriedade_Local)).size)} propriedade(s)</small></div>
        <div class="kpi"><span>Avaliações de praga</span><b>${this.num(occs.length)}</b><small>${this.num(propsAval)} propriedade(s) • ${this.num(munsAll.size)} município(s)</small></div>
        <div class="kpi"><span>Detecções</span><b style="color:#b42318">${this.num(det.length)}</b><small>${this.pct(det.length, occs.length)} das avaliações</small></div>
        <div class="kpi"><span>Suspeitas / amostras</span><b style="color:#b54708">${this.num(sus.length)}</b><small>${this.num(amostras.length)} amostra(s) coletada(s)</small></div>
      </div>

      <h2>Resumo por praga</h2>
      ${this.table(['Praga', 'Propriedades', 'Avaliações', 'Detectada', 'Suspeita', 'Não detectada', 'Positividade', 'Municípios com detecção'],
        pests.map(p => [`<b>${e(p.nome)}</b>${p.cient ? `<br><i class="muted">${e(p.cient)}</i>` : ''}`, this.num(p.props.size), this.num(p.aval),
          `<span class="${p.det ? 'pos' : ''}">${this.num(p.det)}</span>`, `<span class="${p.sus ? 'sus' : ''}">${this.num(p.sus)}</span>`,
          this.num(p.neg), this.pct(p.det, p.aval), e([...p.muns].filter(Boolean).sort().join(', ')) || '—']),
        { numCols: [1, 2, 3, 4, 5, 6], empty: 'Nenhuma praga avaliada no período.' })}`;

    if (anual) {
      /* Evolução mensal (detectadas / avaliadas) */
      const rows = pests.map(p => {
        const cells = [`<b>${e(p.nome)}</b>`];
        let td = 0, ta = 0;
        for (let m = 0; m < 12; m++) {
          const mo = occs.filter(o => p.occIds.has(o.id) && this.inMonth((d.fiscById.get(o.ID_Fiscalizacao_Local) || {}).Data_Hora_Inicio, ano, m));
          const dd = mo.filter(o => o.Resultado_Avaliacao === 'DETECTADA').length;
          td += dd; ta += mo.length;
          cells.push(mo.length ? `<span class="${dd ? 'pos' : 'muted'}">${dd}</span><span class="muted">/${mo.length}</span>` : '<span class="muted">–</span>');
        }
        cells.push(`<b>${td}</b>/${ta}`);
        return cells;
      });
      body += `
        <h2>Evolução mensal — detecções / avaliações</h2>
        ${this.table(['Praga', ...this.MESES.map(m => m.slice(0, 3)), 'Ano'], rows, { numCols: [...Array(13).keys()].map(i => i + 1), empty: 'Sem dados no ano.' })}
        <div class="note">Cada célula mostra <b>detecções / avaliações</b> da praga no mês.</div>`;
    }

    /* Por município */
    const byMun = new Map();
    occs.forEach(o => {
      const f = d.fiscById.get(o.ID_Fiscalizacao_Local) || {};
      const k = f.Municipio || 'Não informado';
      if (!byMun.has(k)) byMun.set(k, { fiscs: new Set(), aval: 0, det: 0, sus: 0 });
      const m = byMun.get(k);
      m.fiscs.add(f.id); m.aval++;
      if (o.Resultado_Avaliacao === 'DETECTADA') m.det++;
      if (o.Resultado_Avaliacao === 'SUSPEITA') m.sus++;
    });
    body += `
      <h2>Por município</h2>
      ${this.table(['Município', 'Fiscalizações', 'Avaliações', 'Detectada', 'Suspeita', 'Positividade'],
        [...byMun.entries()].sort((a, b) => b[1].det - a[1].det || a[0].localeCompare(b[0], 'pt-BR'))
          .map(([k, m]) => [e(k), this.num(m.fiscs.size), this.num(m.aval), this.num(m.det), this.num(m.sus), this.pct(m.det, m.aval)]),
        { numCols: [1, 2, 3, 4, 5] })}`;

    /* Focos: detecções e suspeitas */
    const focos = [...det, ...sus]
      .map(o => ({ o, f: d.fiscById.get(o.ID_Fiscalizacao_Local) || {} }))
      .sort((a, b) => String(a.f.Data_Hora_Inicio).localeCompare(String(b.f.Data_Hora_Inicio)));
    body += `
      <h2>Detecções e suspeitas registradas</h2>
      ${this.table(['Data', 'Município', 'Propriedade / produtor', 'Cultura', 'Praga', 'Resultado', 'Nível', 'Coordenadas', 'Termo'],
        focos.map(({ o, f }) => {
          const lat = o.Latitude_Ocorrencia !== '' && o.Latitude_Ocorrencia != null ? o.Latitude_Ocorrencia : f.Latitude_Fiscalizacao;
          const lng = o.Longitude_Ocorrencia !== '' && o.Longitude_Ocorrencia != null ? o.Longitude_Ocorrencia : f.Longitude_Fiscalizacao;
          return [this.fmtDate(f.Data_Hora_Inicio), e(f.Municipio), `${e(f.Nome_Propriedade_Local)}<br><span class="muted">${e(f.Nome_Produtor_Local)}</span>`,
            e(o.Nome_Cultura_Local), e(o.Nome_Praga),
            o.Resultado_Avaliacao === 'DETECTADA' ? '<span class="pos">Detectada</span>' : '<span class="sus">Suspeita</span>',
            e(o.Nivel_Infestacao ? FiscalizacoesModule.label(FiscalizacoesModule.NIVEIS, o.Nivel_Infestacao) : ''),
            lat !== '' && lat != null ? `${e(lat)}, ${e(lng)}` : '—',
            e(d.termoByFisc.get(f.id)?.Numero_Documento || '')];
        }), { empty: 'Nenhuma detecção ou suspeita no período.' })}`;

    /* Amostras */
    body += `
      <h2>Amostras coletadas</h2>
      ${this.table(['Data', 'Identificação', 'Lacre', 'Material', 'Praga suspeita', 'Cultura', 'Laboratório', 'Situação'],
        amostras.map(a => [this.fmtDate(a.Data_Hora_Coleta), e(a.Identificacao_Amostra), e(a.Numero_Lacre), e(a.Tipo_Material),
          e(a.Nome_Praga_Relacionada), e(a.Nome_Cultura_Local), e(a.Laboratorio_Destino), e(a.Resultado_Diagnostico || a.Status_Amostra || '')]),
        { empty: 'Nenhuma amostra no período.' })}
      <div class="note">Considera apenas fiscalizações finalizadas. Avaliações marcadas como “não avaliada” não entram nos totais.</div>`;

    const title = `Relatório ${anual ? 'anual' : 'mensal'} por praga`;
    const subtitle = `<b>${e(pestName)}</b> • ${periodo}${municipio ? ' • Município: ' + e(municipio) : ' • Todos os municípios'}`;
    this.open(this.page(title, subtitle, body), win);
  },


  /* =======================================================
     ATIVIDADE POR SERVIDOR (mensal)
  ======================================================= */

  async activityReport({ servidor, ano, mes }) {
    const win = this.prepareWindow();
    if (!win) return;
    const d = await this.loadData();
    const e = v => this.esc(v);
    const sv = d.servidores.find(s => String(s.ID_Servidor) === String(servidor)) ||
      (servidor === Auth.currentServerId() ? Auth.getUser() : null) ||
      { ID_Servidor: servidor, Nome_Completo: servidor };
    const isMe = (id, nome) => (id && String(id) === String(sv.ID_Servidor)) || (!id && nome && nome === sv.Nome_Completo);

    const fiscs = d.fiscalizacoes
      .filter(f => this.inMonth(f.Data_Hora_Inicio, ano, mes))
      .map(f => {
        const resp = isMe(f.ID_Servidor, f.Nome_Servidor);
        const equipe = !resp && this.team(f).some(m => isMe(m.ID_Servidor, m.Nome_Completo));
        return { f, papel: resp ? 'Responsável' : equipe ? 'Equipe' : '' };
      })
      .filter(x => x.papel)
      .sort((a, b) => String(a.f.Data_Hora_Inicio).localeCompare(String(b.f.Data_Hora_Inicio)));

    const valid = fiscs.filter(x => this.status(x.f) !== 'CANCELADA');
    const ids = new Set(valid.map(x => x.f.id));
    const fcs = d.fiscalizacaoCulturas.filter(c => ids.has(c.ID_Fiscalizacao_Local));
    const occs = d.ocorrenciasPragas.filter(o => ids.has(o.ID_Fiscalizacao_Local) && o.Resultado_Avaliacao && o.Resultado_Avaliacao !== 'NAO_AVALIADA');
    const amostras = d.amostras.filter(a => ids.has(a.ID_Fiscalizacao_Local));
    const provs = d.providencias.filter(p => ids.has(p.ID_Fiscalizacao_Local));
    const termos = valid.map(x => d.termoByFisc.get(x.f.id)).filter(Boolean);
    const area = fcs.reduce((t, c) => t + (Number(String(c.Area_Fiscalizada_ha ?? '').replace(',', '.')) || 0), 0);
    const plantas = fcs.reduce((t, c) => t + (Number(c.Quantidade_Plantas_Avaliadas) || 0), 0);
    const muns = [...new Set(valid.map(x => x.f.Municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const dias = new Set(valid.map(x => String(x.f.Data_Hora_Inicio).slice(0, 10))).size;

    const cad = (list, field) => list.filter(r => String(r.ID_Servidor_Cadastro || '') === String(sv.ID_Servidor) && this.inMonth(r.Data_Cadastro || r.localCreatedAt, ano, mes));
    const cProd = cad(d.produtores), cProp = cad(d.propriedades), cCult = cad(d.culturas);

    let body = `
      <table class="grid" style="margin-bottom:3mm"><tr>
        <td><span class="muted">Servidor</span><br><b>${e(sv.Nome_Completo)}</b></td>
        <td><span class="muted">Cargo</span><br><b>${e(sv.Cargo_Funcao || '—')}</b></td>
        <td><span class="muted">Matrícula</span><br><b>${e(sv.Matricula || '—')}</b></td>
        <td><span class="muted">Lotação</span><br><b>${e(sv.Unidade_Lotacao || '—')}</b></td>
      </tr></table>

      <div class="kpis">
        <div class="kpi"><span>Fiscalizações</span><b>${this.num(valid.length)}</b><small>${this.num(valid.filter(x => x.papel === 'Responsável').length)} como responsável • ${this.num(valid.filter(x => x.papel === 'Equipe').length)} em equipe</small></div>
        <div class="kpi"><span>Dias em campo</span><b>${this.num(dias)}</b><small>${this.num(muns.length)} município(s)</small></div>
        <div class="kpi"><span>Termos emitidos</span><b>${this.num(termos.length)}</b><small>${this.num(new Set(valid.map(x => x.f.ID_Propriedade_Local)).size)} propriedade(s)</small></div>
        <div class="kpi"><span>Área fiscalizada</span><b>${this.num(area, 1)} ha</b><small>${this.num(plantas)} plantas avaliadas</small></div>
        <div class="kpi"><span>Pragas avaliadas</span><b>${this.num(occs.length)}</b><small>${this.num(occs.filter(o => o.Resultado_Avaliacao === 'DETECTADA').length)} detecção(ões) • ${this.num(occs.filter(o => o.Resultado_Avaliacao === 'SUSPEITA').length)} suspeita(s)</small></div>
        <div class="kpi"><span>Amostras</span><b>${this.num(amostras.length)}</b><small>coletadas</small></div>
        <div class="kpi"><span>Providências</span><b>${this.num(provs.length)}</b><small>determinadas</small></div>
        <div class="kpi"><span>Cadastros</span><b>${this.num(cProd.length + cProp.length + cCult.length)}</b><small>${cProd.length} produtor(es) • ${cProp.length} propriedade(s) • ${cCult.length} cultura(s)</small></div>
      </div>

      <h2>Atividades realizadas</h2>
      ${this.table(['Data', 'Termo', 'Propriedade / produtor', 'Município', 'Ação / programa', 'Culturas', 'Resultado', 'Atuação'],
        fiscs.map(({ f, papel }) => {
          const st = this.status(f);
          const occ = d.ocorrenciasPragas.filter(o => o.ID_Fiscalizacao_Local === f.id && (o.Resultado_Avaliacao === 'DETECTADA' || o.Resultado_Avaliacao === 'SUSPEITA'));
          return [this.fmtDate(f.Data_Hora_Inicio), e(d.termoByFisc.get(f.id)?.Numero_Documento || (st === 'CANCELADA' ? 'Cancelada' : st === 'EM_ANDAMENTO' ? 'Em andamento' : '')),
            `${e(f.Nome_Propriedade_Local)}<br><span class="muted">${e(f.Nome_Produtor_Local)}</span>`, e(f.Municipio),
            e(f.Siglas_Programas || FiscalizacoesModule.label(FiscalizacoesModule.TIPOS_ACAO, f.Tipo_Acao)),
            e(d.fiscalizacaoCulturas.filter(c => c.ID_Fiscalizacao_Local === f.id).map(c => c.Nome_Cultura_Local).join(', ')),
            st === 'CANCELADA' ? '<span class="muted">—</span>'
              : occ.length ? occ.map(o => `<span class="${o.Resultado_Avaliacao === 'DETECTADA' ? 'pos' : 'sus'}">${e(o.Nome_Praga)}</span>`).join(', ')
              : st === 'FINALIZADA' ? '<span class="neg">Sem ocorrência</span>' : '',
            papel];
        }), { empty: 'Nenhuma fiscalização registrada no mês.' })}

      <h2>Municípios atendidos</h2>
      <div>${muns.length ? e(muns.join(', ')) : '<span class="empty">Nenhum.</span>'}</div>

      <h2>Cadastros realizados</h2>
      ${this.table(['Tipo', 'Descrição', 'Município', 'Data'],
        [...cProd.map(r => ['Produtor', e(r.Nome_Razao_Social), '', this.fmtDate(r.Data_Cadastro || r.localCreatedAt)]),
         ...cProp.map(r => ['Propriedade', e(r.Nome_Propriedade), e(r.Municipio), this.fmtDate(r.Data_Cadastro || r.localCreatedAt)]),
         ...cCult.map(r => ['Cultura', e(r.Nome_Cultura_Local || r.ID_Tipo_Cultura), '', this.fmtDate(r.Data_Cadastro || r.localCreatedAt)])],
        { empty: 'Nenhum cadastro no mês.' })}

      <div class="note">Fiscalizações canceladas aparecem na lista, mas não entram nos totais.</div>

      <table class="signs"><tr>
        <td><div class="line"><b>${e(sv.Nome_Completo)}</b><br>${e(sv.Cargo_Funcao || '')}${sv.Matricula ? ' — Matrícula ' + e(sv.Matricula) : ''}</div></td>
        <td><div class="line"><b>Chefia imediata</b><br>Visto / data</div></td>
      </tr></table>`;

    this.open(this.page('Relatório mensal de atividades', `${this.MESES[mes]} de ${ano} — prestação de contas`, body), win);
  }
};
