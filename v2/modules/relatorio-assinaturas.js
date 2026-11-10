/* Defesa Vegetal AM — versão 2.0.0-alpha.15 */
/* =========================================================
   DEFESA VEGETAL AM - V2
   RELATÓRIO MENSAL DE ATIVIDADES — ASSINATURAS

   Fluxo:
   1. O servidor gera o relatório do mês, revisa os campos
      editáveis (cargo, observações, chefia imediata),
      assina e envia → "Aguardando visto da chefia".
   2. A chefia indicada vê o relatório pendente, lê, pode
      escrever um parecer e:
        • dá o visto (assina) → PDF final no Drive; ou
        • devolve para ajustes (parecer obrigatório).
   3. Devolvido: o servidor corrige e reenvia (nova versão).

   Precisa de internet (as assinaturas ficam no servidor).
========================================================= */

const AssinaturaRelatorios = {

  list: null,

  STATUS: {
    AGUARDANDO_CHEFIA: ['Aguardando visto da chefia', 'fz-wait', '⏳'],
    DEVOLVIDO: ['Devolvido para ajustes', 'fz-bad', '↩'],
    ASSINADO: ['Assinado pela chefia', 'fz-ok', '✓']
  },

  esc(v) {
    return Relatorios.esc(v);
  },

  pill(status) {
    const [t, cls, icon] = this.STATUS[status] || [status, '', ''];
    return `<span class="fz-pill ${cls}">${icon} ${this.esc(t)}</span>`;
  },

  competencia(r) {
    const [y, m] = String(r.Competencia || '').split('-').map(Number);
    return y && m ? `${Relatorios.MESES[m - 1]} de ${y}` : String(r.Competencia || '');
  },

  fmt(iso) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '') : '';
  },

  errorText(error) {
    const msg = String(error?.message || error || '');
    const [code, ...rest] = msg.split(':');
    if (rest.length) return rest.join(':').trim();
    return {
      TEMPO_LIMITE_API: 'O servidor demorou a responder. Verifique a internet e tente de novo.',
      COMPETENCIA_INVALIDA: 'Mês inválido.',
      RELATORIO_NAO_ENCONTRADO: 'Relatório não encontrado.',
      'Failed to fetch': 'Sem conexão com o servidor.'
    }[code] || 'Não foi possível concluir. ' + msg;
  },

  isManagerProfile(p) {
    const v = String(p || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    return v.startsWith('ADM') || v.startsWith('GERENTE') || v.startsWith('COORDENADOR');
  },

  async chefias() {
    const me = Auth.currentServerId();
    return (await dbGetAll('servidores'))
      .filter(s => s.ID_Servidor && String(s.ID_Servidor) !== String(me) &&
        String(s.Status || 'ATIVO').toUpperCase() === 'ATIVO' && this.isManagerProfile(s.Perfil_Acesso))
      // Gerente/Coordenador primeiro; administradores depois
      .sort((a, b) => (String(a.Perfil_Acesso).toUpperCase().startsWith('ADM') - String(b.Perfil_Acesso).toUpperCase().startsWith('ADM')) ||
        String(a.Nome_Completo).localeCompare(String(b.Nome_Completo), 'pt-BR'));
  },


  /* =======================================================
     LISTA NA ABA RELATÓRIOS
  ======================================================= */

  async load() {
    const res = await apiRequest('listActivityReports', {}, { timeout: 25000 });
    this.list = res.relatorios || [];
    return this.list;
  },

  pendingForMe() {
    const me = String(Auth.currentServerId());
    return (this.list || []).filter(r => String(r.ID_Chefia) === me && r.Status_Relatorio === 'AGUARDANDO_CHEFIA');
  },

  async render(boxId = 'raBox') {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (!navigator.onLine) {
      box.innerHTML = '<p class="hs-hint">Sem internet: a situação das assinaturas aparece quando houver conexão.</p>';
      return;
    }
    box.innerHTML = '<p class="hs-hint">Consultando assinaturas...</p>';
    try {
      await this.load();
    } catch (error) {
      box.innerHTML = `<p class="hs-hint">Não foi possível consultar as assinaturas: ${this.esc(this.errorText(error))}</p>`;
      return;
    }
    if (!document.body.contains(box)) return;

    const me = String(Auth.currentServerId());
    const all = this.list.slice().sort((a, b) => String(b.Competencia).localeCompare(String(a.Competencia)) || String(a.Nome_Servidor).localeCompare(String(b.Nome_Servidor), 'pt-BR'));
    const pend = all.filter(r => String(r.ID_Chefia) === me && r.Status_Relatorio === 'AGUARDANDO_CHEFIA');
    const mine = all.filter(r => String(r.ID_Servidor) === me);
    const others = Auth.can('gestao') ? all.filter(r => String(r.ID_Servidor) !== me && !pend.includes(r)) : [];

    const card = (r, actions) => `
      <article class="hs-doc ra-item">
        <div class="hs-doc-icon">👤</div>
        <div class="hs-doc-body">
          <div class="hs-doc-top"><strong>${this.esc(this.competencia(r))}</strong> ${this.pill(r.Status_Relatorio)}</div>
          <span>${this.esc(r.Nome_Servidor)} → chefia: ${this.esc(r.Nome_Chefia)}</span>
          <small>Enviado em ${this.esc(this.fmt(r.Data_Envio))}${Number(r.Versao) > 1 ? ` • versão ${this.esc(r.Versao)}` : ''}${r.Data_Visto ? ` • visto em ${this.esc(this.fmt(r.Data_Visto))}` : ''}</small>
          ${r.Parecer_Chefia ? `<small class="ra-parecer ${r.Status_Relatorio === 'ASSINADO' ? 'ra-parecer-ok' : ''}">💬 ${this.esc(r.Parecer_Chefia)}</small>` : ''}
          <div class="hs-doc-actions">${actions(r)}</div>
        </div>
      </article>`;

    const viewBtn = r => r.Status_Relatorio === 'ASSINADO'
      ? `<button type="button" class="btn btn-secondary" onclick="AssinaturaRelatorios.downloadPdf('${this.esc(r.id)}')">⬇️ PDF assinado</button>`
      : `<button type="button" class="btn btn-secondary" onclick="AssinaturaRelatorios.view('${this.esc(r.id)}')">👁️ Ver</button>`;

    box.innerHTML = `
      ${pend.length ? `<h3 class="ra-title">✍️ Aguardando o seu visto (${pend.length})</h3>
        <div class="ra-list">${pend.map(r => card(r, () => `<button type="button" class="btn btn-primary" onclick="AssinaturaRelatorios.openReview('${this.esc(r.id)}')">Revisar e dar visto</button>`)).join('')}</div>` : ''}

      <h3 class="ra-title">Meus relatórios enviados</h3>
      ${mine.length ? `<div class="ra-list">${mine.map(r => card(r, x => viewBtn(x) +
        (x.Status_Relatorio !== 'ASSINADO' ? `<button type="button" class="btn ${x.Status_Relatorio === 'DEVOLVIDO' ? 'btn-primary' : 'btn-secondary'}" onclick="AssinaturaRelatorios.openSubmit(${Number(String(x.Competencia).slice(0, 4))}, ${Number(String(x.Competencia).slice(5, 7)) - 1})">${x.Status_Relatorio === 'DEVOLVIDO' ? 'Corrigir e reenviar' : 'Reenviar'}</button>` : ''))).join('')}</div>`
        : '<p class="hs-hint">Nenhum relatório enviado ainda.</p>'}

      ${others.length ? `<details class="ra-others"><summary>Todos os relatórios da equipe (${others.length})</summary>
        <div class="ra-list">${others.map(r => card(r, viewBtn)).join('')}</div></details>` : ''}`;
  },


  /* =======================================================
     SERVIDOR: REVISAR, ASSINAR E ENVIAR
  ======================================================= */

  async openSubmit(ano, mes) {
    const u = Auth.getUser();
    if (!u) return;
    const chefias = await this.chefias();
    if (!chefias.length) {
      App.showMessage('Nenhuma chefia (perfil Gerente/Coordenador ou Administrador) cadastrada. Peça ao administrador.', 'warning');
      return;
    }
    const meRec = (await dbGetAll('servidores')).find(s => String(s.ID_Servidor) === String(u.ID_Servidor)) || {};
    const last = localStorage.getItem('dv_chefia_' + u.ID_Servidor);
    const defChefia = [meRec.ID_Chefia_Imediata, last].find(id => id && chefias.some(c => String(c.ID_Servidor) === String(id))) || chefias[0].ID_Servidor;
    const prevObs = (this.list || []).find(r => String(r.ID_Servidor) === String(u.ID_Servidor) && r.Competencia === `${ano}-${String(mes + 1).padStart(2, '0')}`);
    let signature = u.Assinatura || '';

    const { overlay, form } = FiscalizacoesModule.openSheet({
      title: 'Assinar e enviar à chefia',
      subtitle: `Relatório mensal de atividades — ${Relatorios.MESES[mes]} de ${ano}`,
      submitLabel: '✍️ Assinar e enviar',
      body: `
        ${prevObs?.Status_Relatorio === 'DEVOLVIDO' ? `<div class="ra-alert">↩ Devolvido pela chefia: <b>${this.esc(prevObs.Parecer_Chefia)}</b></div>` : ''}
        <div class="form-grid">
          <div class="field field-wide"><label for="raCargo">Seu cargo / função no relatório</label>
            <input id="raCargo" maxlength="120" value="${this.esc(prevObs?.Cargo_Servidor || u.Cargo_Funcao || '')}"></div>
          <div class="field field-wide"><label for="raObs">Observações / justificativas (opcional)</label>
            <textarea id="raObs" rows="3" maxlength="1500" placeholder="Ex.: férias de 10 a 20, apoio à barreira fitossanitária, viatura indisponível...">${this.esc(prevObs?.Observacoes_Servidor || '')}</textarea></div>
          <div class="field"><label for="raChefia">Chefia imediata *</label>
            <select id="raChefia" required>${chefias.map(c => `<option value="${this.esc(c.ID_Servidor)}" ${String(c.ID_Servidor) === String(defChefia) ? 'selected' : ''}>${this.esc(c.Nome_Completo)}</option>`).join('')}</select></div>
          <div class="field"><label for="raCargoChefia">Cargo da chefia no relatório</label>
            <input id="raCargoChefia" maxlength="120"></div>
          <div class="field field-wide"><label>Sua assinatura *</label>
            <div class="ra-sig" id="raSig"></div>
            <button type="button" class="btn btn-secondary" id="raSigBtn"></button></div>
        </div>
        <button type="button" class="btn btn-secondary ra-prev" id="raPrev">👁️ Pré-visualizar relatório</button>
        <p class="hs-hint">Ao enviar, o relatório fica bloqueado até a chefia dar o visto ou devolver. Precisa de internet.</p>`,
      onSubmit: async () => {
        if (!signature) {
          App.showMessage('Assine antes de enviar.', 'warning');
          return false;
        }
        if (!navigator.onLine) {
          App.showMessage('Sem internet. Conecte-se para enviar à chefia.', 'warning');
          return false;
        }
        const chefia = chefias.find(c => String(c.ID_Servidor) === form.querySelector('#raChefia').value);
        const params = this.signParams(form, chefia, '');
        try {
          const html = await Relatorios.buildActivityHtml({ servidor: u.ID_Servidor, ano, mes }, params);
          await apiRequest('submitActivityReport', {
            ano, mes, html,
            ID_Chefia: chefia.ID_Servidor,
            Cargo_Servidor: params.cargoServidor,
            Cargo_Chefia: params.chefia.Cargo,
            Observacoes_Servidor: params.observacoes,
            Assinatura_Servidor: signature
          }, { timeout: 60000 });
        } catch (error) {
          App.showMessage(this.errorText(error), 'error');
          return false;
        }
        localStorage.setItem('dv_chefia_' + u.ID_Servidor, chefia.ID_Servidor);
        App.showMessage(`Relatório enviado para ${chefia.Nome_Completo}.`, 'success');
        this.render();
        return true;
      }
    });

    const chefiaSel = form.querySelector('#raChefia');
    const cargoChefia = form.querySelector('#raCargoChefia');
    const fillCargo = () => {
      const c = chefias.find(x => String(x.ID_Servidor) === chefiaSel.value);
      cargoChefia.value = prevObs && String(prevObs.ID_Chefia) === String(c?.ID_Servidor) && prevObs.Cargo_Chefia
        ? prevObs.Cargo_Chefia : (c?.Cargo_Funcao || '');
    };
    fillCargo();
    chefiaSel.onchange = fillCargo;

    const paintSig = () => {
      form.querySelector('#raSig').innerHTML = signature
        ? `<img src="${signature}" alt="Sua assinatura">`
        : '<span>Nenhuma assinatura cadastrada.</span>';
      form.querySelector('#raSigBtn').textContent = signature ? 'Assinar de novo' : '✍️ Assinar';
    };
    paintSig();
    form.querySelector('#raSigBtn').onclick = async () => {
      const r = await SignaturePad.capture({ title: 'Sua assinatura', name: u.Nome_Completo, detail: `${form.querySelector('#raCargo').value} • Matrícula ${u.Matricula}` });
      if (r && r.image) {
        signature = r.image;
        if (!u.Assinatura) Auth.setSignature(r.image);
        paintSig();
      }
    };
    form.querySelector('#raPrev').onclick = async () => {
      const win = Relatorios.prepareWindow();
      if (!win) return;
      const chefia = chefias.find(c => String(c.ID_Servidor) === chefiaSel.value);
      Relatorios.open(await Relatorios.buildActivityHtml({ servidor: u.ID_Servidor, ano, mes },
        { ...this.signParams(form, chefia, signature), printButton: true }), win);
    };
    return overlay;
  },

  signParams(form, chefia, servidorAssinatura) {
    return {
      cargoServidor: form.querySelector('#raCargo').value.trim(),
      observacoes: form.querySelector('#raObs').value.trim(),
      chefia: {
        Nome_Completo: chefia.Nome_Completo,
        Cargo: form.querySelector('#raCargoChefia').value.trim() || chefia.Cargo_Funcao || '',
        Matricula: chefia.Matricula || ''
      },
      servidorAssinatura,
      printButton: false
    };
  },


  /* =======================================================
     CHEFIA: REVISAR E DAR VISTO / DEVOLVER
  ======================================================= */

  async fetchReport(id, pdf = false) {
    return apiRequest('getActivityReport', { id, pdf }, { timeout: 45000 });
  },

  async view(id) {
    const win = Relatorios.prepareWindow();
    if (!win) return;
    try {
      const res = await this.fetchReport(id);
      Relatorios.open(this.withPrintButton(res.html), win);
    } catch (error) {
      win.close();
      App.showMessage(this.errorText(error), 'error');
    }
  },

  /* Conteúdo vindo do servidor: remove qualquer coisa ativa antes de abrir */
  safe(html) {
    return String(html || '')
      .replace(/<\s*(script|iframe|object|embed|link|form|base)\b[\s\S]*?(<\/\s*\1\s*>|>)/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
  },

  withPrintButton(html) {
    return this.safe(html).replace('<div class="doc">', '<button class="noprint" onclick="print()">Imprimir / salvar PDF</button><div class="doc">');
  },

  async downloadPdf(id) {
    App.showMessage('Baixando PDF...', 'info');
    try {
      const res = await this.fetchReport(id, true);
      if (!res.pdf) return App.showMessage('PDF ainda não gerado.', 'warning');
      const blob = HistoricoModule.base64ToBlob(res.pdf);
      HistoricoModule.savePdfFile(blob, res.nome || `Relatorio_${id}.pdf`);
    } catch (error) {
      App.showMessage(this.errorText(error), 'error');
    }
  },

  async openReview(id) {
    const u = Auth.getUser();
    App.showMessage('Abrindo relatório...', 'info');
    let res;
    try {
      res = await this.fetchReport(id);
    } catch (error) {
      App.showMessage(this.errorText(error), 'error');
      return;
    }
    const r = res.relatorio;
    let signature = u.Assinatura || '';
    let decisao = 'ASSINAR';

    const { form } = FiscalizacoesModule.openSheet({
      title: 'Visto da chefia imediata',
      subtitle: `${this.esc(r.Nome_Servidor)} — ${this.esc(this.competencia(r))}`,
      submitLabel: '✍️ Dar visto e assinar',
      submitId: 'raSubmit',
      body: `
        <div class="ra-frame-wrap"><iframe class="ra-frame" title="Relatório" sandbox="allow-same-origin"></iframe></div>
        <button type="button" class="btn btn-secondary" id="raFull">🔍 Abrir em tela cheia</button>
        ${r.Observacoes_Servidor ? `<p class="hs-hint">Observações do servidor: ${this.esc(r.Observacoes_Servidor)}</p>` : ''}
        <div class="form-grid">
          <div class="field field-wide"><label>Decisão</label>
            <div class="ra-choice">
              <button type="button" class="btn btn-primary" data-d="ASSINAR">✓ Dar visto</button>
              <button type="button" class="btn btn-secondary" data-d="DEVOLVER">↩ Devolver para ajustes</button>
            </div></div>
          <div class="field field-wide"><label for="raParecer" id="raParecerLbl">Parecer (opcional — sai no PDF)</label>
            <textarea id="raParecer" rows="3" maxlength="1500"></textarea></div>
          <div class="field field-wide" id="raCargoBox"><label for="raCargoC">Seu cargo no relatório</label>
            <input id="raCargoC" maxlength="120" value="${this.esc(r.Cargo_Chefia || u.Cargo_Funcao || '')}"></div>
          <div class="field field-wide" id="raSigBox"><label>Sua assinatura *</label>
            <div class="ra-sig" id="raSig"></div>
            <button type="button" class="btn btn-secondary" id="raSigBtn"></button></div>
        </div>`,
      onSubmit: async () => {
        const parecer = form.querySelector('#raParecer').value.trim();
        if (decisao === 'DEVOLVER' && !parecer) {
          App.showMessage('Escreva o motivo da devolução.', 'warning');
          form.querySelector('#raParecer').focus();
          return false;
        }
        if (decisao === 'ASSINAR' && !signature) {
          App.showMessage('Assine antes de dar o visto.', 'warning');
          return false;
        }
        try {
          await apiRequest('signActivityReport', {
            id, decisao, Parecer_Chefia: parecer,
            Cargo_Chefia: form.querySelector('#raCargoC').value.trim(),
            Assinatura_Chefia: decisao === 'ASSINAR' ? signature : ''
          }, { timeout: 90000 });
        } catch (error) {
          App.showMessage(this.errorText(error), 'error');
          return false;
        }
        App.showMessage(decisao === 'ASSINAR' ? 'Visto registrado. O PDF assinado foi gerado.' : 'Relatório devolvido ao servidor.', 'success');
        this.render();
        return true;
      }
    });

    form.querySelector('.ra-frame').srcdoc = this.safe(res.html);
    form.querySelector('#raFull').onclick = () => {
      const win = Relatorios.prepareWindow();
      if (win) Relatorios.open(this.withPrintButton(res.html), win);
    };

    const paintSig = () => {
      form.querySelector('#raSig').innerHTML = signature ? `<img src="${signature}" alt="Sua assinatura">` : '<span>Nenhuma assinatura cadastrada.</span>';
      form.querySelector('#raSigBtn').textContent = signature ? 'Assinar de novo' : '✍️ Assinar';
    };
    paintSig();
    form.querySelector('#raSigBtn').onclick = async () => {
      const s = await SignaturePad.capture({ title: 'Visto da chefia', name: u.Nome_Completo, detail: `${form.querySelector('#raCargoC').value} • Matrícula ${u.Matricula}` });
      if (s && s.image) {
        signature = s.image;
        if (!u.Assinatura) Auth.setSignature(s.image);
        paintSig();
      }
    };

    const setDecision = d => {
      decisao = d;
      form.querySelectorAll('[data-d]').forEach(b => {
        b.classList.toggle('btn-primary', b.dataset.d === d);
        b.classList.toggle('btn-secondary', b.dataset.d !== d);
      });
      form.querySelector('#raSigBox').hidden = d !== 'ASSINAR';
      form.querySelector('#raCargoBox').hidden = d !== 'ASSINAR';
      form.querySelector('#raParecerLbl').textContent = d === 'ASSINAR' ? 'Parecer (opcional — sai no PDF)' : 'Motivo da devolução *';
      form.querySelector('#raSubmit').textContent = d === 'ASSINAR' ? '✍️ Dar visto e assinar' : '↩ Devolver ao servidor';
    };
    form.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => setDecision(b.dataset.d); });
  },


  /* Aviso ao abrir o app: relatórios aguardando o meu visto */
  async notifyPending() {
    if (!navigator.onLine || !Auth.getUser()) return;
    try {
      await this.load();
      const n = this.pendingForMe().length;
      if (n) App.showMessage(`Você tem ${n} relatório(s) de atividade aguardando o seu visto (Histórico → Relatórios).`, 'info');
    } catch (error) {
      console.warn('Relatórios pendentes:', error);
    }
  }
};
