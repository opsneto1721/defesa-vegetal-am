/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: SERVIDORES (somente ADMINISTRADOR)

   Cadastro de servidores, perfil de acesso, lotação,
   ativação/inativação e redefinição de senha.
   Precisa de internet: os dados ficam só no servidor
   (a aba Servidores guarda as senhas protegidas).
========================================================= */

const ServidoresModule = {

  list: [],

  PERFIS: [
    ['FISCAL', 'Fiscal'],
    ['TECNICO', 'Apoio (somente cadastros)'],
    ['GERENTE', 'Gerente / Coordenador'],
    ['ADMINISTRADOR', 'Administrador']
  ],

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

  errorText(error) {
    const msg = String(error?.message || error);
    return msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : 'Não foi possível concluir. Tente novamente.';
  },

  async open() {
    const main = document.querySelector('main');
    main.innerHTML = `
      <section class="module-page">
        <div class="module-header">
          <button type="button" class="btn btn-secondary" onclick="App.showHome()">← Voltar</button>
          <div>
            <h2>Servidores</h2>
            <p>Acesso ao sistema: cadastro, perfis, lotação e senhas.</p>
          </div>
        </div>

        <div class="hs-toolbar">
          <input id="svSearch" type="search" placeholder="Nome, matrícula, cargo ou lotação">
          <select id="svPerfil"><option value="">Todos os perfis</option>${this.PERFIS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <select id="svStatus"><option value="ATIVO">Ativos</option><option value="INATIVO">Inativos</option><option value="">Todos</option></select>
          <button type="button" class="btn btn-primary" onclick="ServidoresModule.edit()">➕ Novo servidor</button>
        </div>

        <details class="sv-help">
          <summary>O que cada perfil pode fazer</summary>
          <table>
            <tr><th>Perfil</th><th>Pode</th></tr>
            <tr><td><b>Apoio (somente cadastros)</b></td><td>Cadastrar produtores, propriedades e culturas; participar da equipe; consultar tudo. Para quem não realiza fiscalização.</td></tr>
            <tr><td><b>Fiscal</b></td><td>Tudo do apoio + registrar fiscalizações e emitir termos; alterar, reabrir ou cancelar só as próprias (ou em que está na equipe). <b>Use também para técnicos que fiscalizam</b> — o cargo (ex.: Técnico Agrícola) continua aparecendo no termo.</td></tr>
            <tr><td><b>Gerente / Coordenador</b></td><td>Tudo do fiscal + alterar, reabrir ou cancelar fiscalizações de qualquer servidor.</td></tr>
            <tr><td><b>Administrador</b></td><td>Tudo + cadastrar servidores, definir perfis e redefinir senhas.</td></tr>
          </table>
        </details>

        <div id="svList" class="hs-list"><p>Carregando...</p></div>
      </section>`;

    document.getElementById('svSearch').oninput = () => this.render();
    document.getElementById('svPerfil').onchange = () => this.render();
    document.getElementById('svStatus').onchange = () => this.render();

    await this.load();
  },

  async load() {
    const box = document.getElementById('svList');
    if (!navigator.onLine) {
      box.innerHTML = '<div class="empty-state">O módulo Servidores precisa de internet.</div>';
      return;
    }
    try {
      const result = await apiRequest('listServidores');
      this.list = result.servidores || [];
      this.render();
    } catch (error) {
      box.innerHTML = `<div class="empty-state">${this.esc(this.errorText(error))}</div>`;
    }
  },

  render() {
    const box = document.getElementById('svList');
    if (!box) return;
    const q = this.val('svSearch').toLowerCase();
    const perfil = this.val('svPerfil');
    const status = this.val('svStatus');
    const me = Auth.currentServerId();

    const rows = this.list
      .filter(s => !perfil || s.Perfil_Acesso === perfil)
      .filter(s => !status || s.Status === status)
      .filter(s => !q || [s.Nome_Completo, s.Matricula, s.Cargo_Funcao, s.Unidade_Lotacao, s.Email_Institucional].join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a.Nome_Completo).localeCompare(String(b.Nome_Completo), 'pt-BR'));

    if (!rows.length) {
      box.innerHTML = '<div class="empty-state">Nenhum servidor encontrado.</div>';
      return;
    }

    box.innerHTML = rows.map(s => `
      <article class="hs-doc sv-item ${s.Status === 'INATIVO' ? 'sv-inactive' : ''}">
        <div class="hs-doc-icon">👤</div>
        <div class="hs-doc-body">
          <div class="hs-doc-top">
            <strong>${this.esc(s.Nome_Completo)}</strong>
            <span class="fz-pill ${s.Perfil_Acesso === 'ADMINISTRADOR' ? 'fz-bad' : s.Perfil_Acesso === 'GERENTE' ? 'fz-wait' : 'fz-ok'}">${this.esc(Auth.profileLabel(s.Perfil_Acesso))}</span>
            ${s.Status === 'INATIVO' ? '<span class="fz-pill">Inativo</span>' : ''}
            ${s.Bloqueado === 'SIM' ? '<span class="fz-pill fz-bad">Bloqueado</span>' : ''}
            ${s.Possui_Senha !== 'SIM' ? '<span class="fz-pill fz-wait">Sem senha</span>' : ''}
            ${s.ID_Servidor === me ? '<span class="fz-pill">Você</span>' : ''}
          </div>
          <span>${this.esc(s.Cargo_Funcao || 'Cargo não informado')} • Matrícula ${this.esc(s.Matricula)}${s.Unidade_Lotacao ? ' • ' + this.esc(s.Unidade_Lotacao) : ''}</span>
          <small>${s.Email_Institucional ? this.esc(s.Email_Institucional) + ' • ' : ''}Último acesso: ${s.Ultimo_Acesso ? new Date(s.Ultimo_Acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(', ', ' ') : 'nunca'}</small>
          <div class="hs-doc-actions">
            <button type="button" class="btn btn-secondary fz-small" onclick="ServidoresModule.edit('${this.esc(s.ID_Servidor)}')">✏️ Editar</button>
            <button type="button" class="btn btn-secondary fz-small" onclick="ServidoresModule.resetPassword('${this.esc(s.ID_Servidor)}')">🔑 ${s.Possui_Senha === 'SIM' ? 'Redefinir senha' : 'Gerar senha de acesso'}</button>
          </div>
        </div>
      </article>`).join('');
  },

  municipalities() {
    return typeof CadastrosModule !== 'undefined' && CadastrosModule.getAmazonasMunicipalities
      ? CadastrosModule.getAmazonasMunicipalities() : [];
  },

  edit(id = '') {
    const s = this.list.find(x => x.ID_Servidor === id) || { Status: 'ATIVO', Perfil_Acesso: 'FISCAL' };
    const isMe = id && id === Auth.currentServerId();
    const muns = this.municipalities();

    FiscalizacoesModule.openSheet({
      title: id ? '✏️ Editar servidor' : '➕ Novo servidor',
      subtitle: id ? `${this.esc(s.ID_Servidor)} • ${this.esc(s.Nome_Completo)}` : 'Uma senha temporária será gerada ao salvar.',
      submitLabel: id ? 'Salvar alterações' : 'Cadastrar e gerar senha',
      body: `
        <div class="form-grid">
          <div class="field field-wide"><label for="svNome">Nome completo *</label>
            <input id="svNome" required maxlength="150" value="${this.esc(s.Nome_Completo || '')}"></div>
          <div class="field"><label for="svMat">Matrícula *</label>
            <input id="svMat" required maxlength="40" value="${this.esc(s.Matricula || '')}"></div>
          <div class="field"><label for="svCpf">CPF</label>
            <input id="svCpf" inputmode="numeric" maxlength="14" value="${this.esc(s.CPF || '')}"></div>
          <div class="field field-wide"><label for="svCargo">Cargo / função</label>
            <input id="svCargo" maxlength="120" list="svCargos" value="${this.esc(s.Cargo_Funcao || '')}" placeholder="Fiscal Estadual Agropecuário">
            <datalist id="svCargos">
              <option value="Fiscal Estadual Agropecuário"><option value="Engenheiro Agrônomo"><option value="Técnico Agrícola">
              <option value="Assistente Técnico"><option value="Gerente de Defesa Vegetal"><option value="Coordenador">
            </datalist></div>
          <div class="field"><label for="svEmail">E-mail institucional</label>
            <input id="svEmail" type="email" maxlength="120" value="${this.esc(s.Email_Institucional || '')}"></div>
          <div class="field"><label for="svTel">Telefone</label>
            <input id="svTel" maxlength="30" value="${this.esc(s.Telefone || '')}"></div>
          <div class="field field-wide"><label for="svLot">Unidade de lotação</label>
            <input id="svLot" maxlength="120" list="svMuns" value="${this.esc(s.Unidade_Lotacao || '')}" placeholder="Ex.: Manaus — Gerência de Defesa Vegetal">
            <datalist id="svMuns">${muns.map(m => `<option value="${this.esc(m)}">`).join('')}</datalist></div>
          <div class="field"><label for="svPerfilSel">Perfil de acesso *</label>
            <select id="svPerfilSel" required ${isMe ? 'disabled' : ''}>${this.PERFIS.map(([v, l]) => `<option value="${v}" ${s.Perfil_Acesso === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${isMe ? '<small>Você não pode alterar o seu próprio perfil.</small>' : ''}</div>
          <div class="field"><label for="svStatusSel">Situação</label>
            <select id="svStatusSel" ${isMe ? 'disabled' : ''}>
              <option value="ATIVO" ${s.Status !== 'INATIVO' ? 'selected' : ''}>Ativo</option>
              <option value="INATIVO" ${s.Status === 'INATIVO' ? 'selected' : ''}>Inativo (sem acesso)</option>
            </select>
            <small>Inativar encerra as sessões abertas. O histórico do servidor é preservado.</small></div>
        </div>`,
      onSubmit: async () => {
        try {
          const result = await apiRequest('saveServidor', {
            servidor: {
              ID_Servidor: id || '',
              Nome_Completo: this.val('svNome'),
              Matricula: this.val('svMat'),
              CPF: this.val('svCpf'),
              Cargo_Funcao: this.val('svCargo'),
              Email_Institucional: this.val('svEmail'),
              Telefone: this.val('svTel'),
              Unidade_Lotacao: this.val('svLot'),
              Perfil_Acesso: isMe ? s.Perfil_Acesso : this.val('svPerfilSel'),
              Status: isMe ? 'ATIVO' : this.val('svStatusSel')
            }
          });
          await this.load();
          if (result.senhaTemporaria) this.showTempPassword(result.servidor, result.senhaTemporaria);
          else App.showMessage('Servidor atualizado.', 'success');
          syncCatalogs().catch(() => {});
        } catch (error) {
          App.showMessage(this.errorText(error), 'error');
          return false;
        }
      }
    });
  },

  async resetPassword(id) {
    const s = this.list.find(x => x.ID_Servidor === id);
    if (!s) return;
    if (!confirm(`Gerar nova senha temporária para ${s.Nome_Completo}?\n\nA senha atual deixa de funcionar e as sessões abertas em outros aparelhos são encerradas.`)) return;
    try {
      const result = await apiRequest('resetSenha', { ID_Servidor: id });
      await this.load();
      this.showTempPassword(s, result.senhaTemporaria);
    } catch (error) {
      App.showMessage(this.errorText(error), 'error');
    }
  },

  showTempPassword(s, senha) {
    const text = `Acesso ao app Defesa Vegetal AM\nEndereço: ${location.origin}${location.pathname}\nMatrícula: ${s.Matricula}\nSenha temporária: ${senha}\n(Você criará sua senha no primeiro acesso.)`;
    const { form } = FiscalizacoesModule.openSheet({
      title: '🔑 Senha temporária',
      subtitle: `${this.esc(s.Nome_Completo)} — matrícula ${this.esc(s.Matricula)}`,
      readOnly: true,
      body: `
        <div class="sv-pass">${this.esc(senha)}</div>
        <p>Entregue esta senha ao servidor por um canal seguro. Ela <b>não será mostrada de novo</b>.
        No primeiro acesso, o app pedirá que ele crie uma senha pessoal.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="svCopy">📋 Copiar mensagem de acesso</button>
        </div>`
    });
    form.querySelector('#svCopy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        App.showMessage('Mensagem copiada.', 'success');
      } catch {
        prompt('Copie a mensagem:', text);
      }
    };
  }
};
