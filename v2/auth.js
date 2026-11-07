/* =========================================================
   DEFESA VEGETAL AM - V2
   IDENTIFICAÇÃO DO SERVIDOR (provisório até o login)

   Todos os módulos obtêm o servidor logado SOMENTE por
   Auth.getUser() / Auth.ensureUser(). Quando o login for
   desenvolvido, basta que ele chame Auth.setUser(...) com
   os dados da aba Servidores — nenhum módulo precisará
   ser alterado.

   Formato do usuário:
   {
     ID_Servidor, Nome_Completo, Matricula,
     Cargo_Funcao, Unidade_Lotacao,
     origem: 'LOGIN' | 'IDENTIFICACAO_LOCAL'
   }
========================================================= */

const Auth = {

  STORAGE_KEY: 'dv_usuario',

  getUser() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } catch {
      /* armazenamento indisponível */
    }
    this.renderBadge();
    window.dispatchEvent(new CustomEvent('user-changed', { detail: user }));
  },

  clearUser() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      /* armazenamento indisponível */
    }
    this.renderBadge();
  },

  currentServerId() {
    return this.getUser()?.ID_Servidor || '';
  },

  currentServerName() {
    return this.getUser()?.Nome_Completo || '';
  },

  /*
    Garante que há um servidor identificado.
    Se não houver, abre a janela de identificação.
    Retorna o usuário ou null se cancelado.
  */
  async ensureUser() {
    const user = this.getUser();
    if (user && user.Nome_Completo) return user;
    return this.showIdentification();
  },

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  async getServerCatalog() {
    try {
      const list = await dbGetAll('servidores');
      return list
        .filter(s => s.Nome_Completo && String(s.Status || 'ATIVO').toUpperCase() !== 'INATIVO')
        .sort((a, b) => String(a.Nome_Completo).localeCompare(String(b.Nome_Completo), 'pt-BR'));
    } catch {
      return [];
    }
  },

  async showIdentification() {
    const servers = await this.getServerCatalog();
    const current = this.getUser() || {};

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'auth-overlay';
      overlay.innerHTML = `
        <div class="auth-dialog form-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <div class="form-heading">
            <div>
              <h3 id="authTitle">Identificação do servidor</h3>
              <p>Seu nome será usado automaticamente nas fiscalizações e termos emitidos neste aparelho.</p>
            </div>
          </div>

          <form id="authForm">
            <div class="form-grid">
              ${servers.length ? `
                <div class="field field-wide">
                  <label for="authServer">Servidor (aba Servidores)</label>
                  <select id="authServer">
                    <option value="">Selecione seu nome</option>
                    ${servers.map(s => `<option value="${this.esc(s.ID_Servidor)}" ${s.ID_Servidor === current.ID_Servidor ? 'selected' : ''}>${this.esc(s.Nome_Completo)}${s.Matricula ? ' — ' + this.esc(s.Matricula) : ''}</option>`).join('')}
                    <option value="__OUTRO__">Meu nome não está na lista</option>
                  </select>
                </div>` : ''}

              <div class="field field-wide" id="authManual" ${servers.length ? 'hidden' : ''}>
                <label for="authNome">Nome completo *</label>
                <input id="authNome" maxlength="150" value="${this.esc(current.origem === 'IDENTIFICACAO_LOCAL' && !current.ID_Servidor ? current.Nome_Completo : '')}">
              </div>
              <div class="field" id="authManualMat" ${servers.length ? 'hidden' : ''}>
                <label for="authMatricula">Matrícula</label>
                <input id="authMatricula" maxlength="40" value="${this.esc(current.origem === 'IDENTIFICACAO_LOCAL' && !current.ID_Servidor ? current.Matricula : '')}">
              </div>
              <div class="field" id="authManualCargo" ${servers.length ? 'hidden' : ''}>
                <label for="authCargo">Cargo / função</label>
                <input id="authCargo" maxlength="100" placeholder="Fiscal Estadual Agropecuário" value="${this.esc(current.origem === 'IDENTIFICACAO_LOCAL' && !current.ID_Servidor ? current.Cargo_Funcao : '')}">
              </div>
            </div>
            <p class="auth-note">Provisório: quando o login for implantado, esta identificação será feita automaticamente.</p>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="authCancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">Confirmar</button>
            </div>
          </form>
        </div>`;

      document.body.appendChild(overlay);

      const select = overlay.querySelector('#authServer');
      const manualIds = ['authManual', 'authManualMat', 'authManualCargo'];
      const toggleManual = () => {
        const manual = !select || select.value === '__OUTRO__';
        manualIds.forEach(id => { overlay.querySelector('#' + id).hidden = !manual; });
      };
      if (select) select.onchange = toggleManual;

      const close = result => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('#authCancel').onclick = () => close(null);

      overlay.querySelector('#authForm').onsubmit = event => {
        event.preventDefault();

        let user = null;

        if (select && select.value && select.value !== '__OUTRO__') {
          const s = servers.find(item => String(item.ID_Servidor) === select.value);
          user = {
            ID_Servidor: s.ID_Servidor || '',
            Nome_Completo: s.Nome_Completo || '',
            Matricula: s.Matricula || '',
            Cargo_Funcao: s.Cargo_Funcao || '',
            Unidade_Lotacao: s.Unidade_Lotacao || '',
            origem: 'IDENTIFICACAO_LOCAL'
          };
        } else {
          const nome = overlay.querySelector('#authNome').value.trim();
          if (!nome) {
            App.showMessage('Informe seu nome completo.', 'warning');
            return;
          }
          user = {
            ID_Servidor: '',
            Nome_Completo: nome,
            Matricula: overlay.querySelector('#authMatricula').value.trim(),
            Cargo_Funcao: overlay.querySelector('#authCargo').value.trim(),
            Unidade_Lotacao: '',
            origem: 'IDENTIFICACAO_LOCAL'
          };
        }

        this.setUser(user);
        close(user);
      };

      const first = overlay.querySelector('select, input');
      if (first) first.focus();
    });
  },

  /* Indicador do servidor no cabeçalho */
  renderBadge() {
    const header = document.querySelector('.header-content');
    if (!header) return;

    let badge = document.getElementById('userBadge');
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'userBadge';
      badge.type = 'button';
      badge.className = 'user-badge';
      badge.onclick = () => this.showIdentification();
      const status = document.getElementById('connectionStatus');
      header.insertBefore(badge, status);
    }

    const user = this.getUser();
    badge.textContent = user?.Nome_Completo
      ? '👤 ' + user.Nome_Completo.split(' ').slice(0, 2).join(' ')
      : '👤 Identificar-se';
    badge.title = user?.Nome_Completo
      ? `${user.Nome_Completo}${user.Matricula ? ' • ' + user.Matricula : ''} (toque para trocar)`
      : 'Identificar o servidor';
  }
};
