/* =========================================================
   DEFESA VEGETAL AM - V2
   LOGIN, SESSÃO E PERFIS DE ACESSO

   - Login por matrícula (ou e-mail institucional) + senha.
   - A sessão vale 30 dias e fica guardada no aparelho, para
     uso em campo sem internet.
   - O servidor (Apps Script) confere a sessão e o perfil em
     toda requisição; aqui o perfil só adapta a interface.

   Perfis: ADMINISTRADOR, GERENTE, FISCAL, TECNICO
========================================================= */

const Auth = {

  SESSION_KEY: 'dv_sessao',

  PERFIS: {
    ADMINISTRADOR: { label: 'Administrador', perms: ['cadastros', 'fiscalizar', 'gestao', 'servidores'] },
    GERENTE: { label: 'Gerente / Coordenador', perms: ['cadastros', 'fiscalizar', 'gestao'] },
    FISCAL: { label: 'Fiscal', perms: ['cadastros', 'fiscalizar'] },
    TECNICO: { label: 'Apoio (somente cadastros)', perms: ['cadastros'] },
    CONSULTA: { label: 'Consulta', perms: [] }
  },

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },


  /* =======================================================
     SESSÃO
  ======================================================= */

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
      return s && s.token ? s : null;
    } catch {
      return null;
    }
  },

  setSession(session) {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch {
      /* armazenamento indisponível */
    }
    this.renderBadge();
  },

  clearSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch {
      /* ignorado */
    }
    this.renderBadge();
  },

  token() {
    return this.getSession()?.token || '';
  },

  isValid() {
    const s = this.getSession();
    return !!(s && s.token && s.usuario && new Date(s.expiraEm) > new Date());
  },

  /* Usuário logado + assinatura guardada neste aparelho */
  getUser() {
    const s = this.getSession();
    if (!s || !s.usuario) return null;
    const u = { ...s.usuario };
    try {
      u.Assinatura = localStorage.getItem('dv_assinatura_' + u.ID_Servidor) || '';
    } catch {
      u.Assinatura = '';
    }
    return u;
  },

  profile() {
    return this.getUser()?.Perfil_Acesso || 'CONSULTA';
  },

  profileLabel(p = this.profile()) {
    return this.PERFIS[p]?.label || p;
  },

  can(permission) {
    return (this.PERFIS[this.profile()]?.perms || []).includes(permission);
  },

  currentServerId() {
    return this.getUser()?.ID_Servidor || '';
  },

  currentServerName() {
    return this.getUser()?.Nome_Completo || '';
  },

  setSignature(image) {
    const u = this.getUser();
    if (!u) return;
    try {
      if (image) localStorage.setItem('dv_assinatura_' + u.ID_Servidor, image);
      else localStorage.removeItem('dv_assinatura_' + u.ID_Servidor);
    } catch {
      App.showMessage('Não foi possível guardar a assinatura neste aparelho.', 'error');
    }
  },


  /* =======================================================
     ENTRADA NO APP
  ======================================================= */

  /* Chamado na abertura do app: só continua com sessão válida */
  async requireLogin() {
    if (this.isValid()) {
      this.renderBadge();
      this.checkSessionOnline();
      if (this.getUser().Troca_Senha_Obrigatoria) {
        await this.showChangePassword({ forced: true });
      }
      return this.getUser();
    }
    return this.showLogin();
  },

  /* Compatibilidade com os módulos */
  async ensureUser() {
    return this.isValid() ? this.getUser() : this.showLogin();
  },

  /* Confere em segundo plano se a sessão continua válida no servidor */
  async checkSessionOnline() {
    if (!navigator.onLine || !apiIsConfigured()) return;
    try {
      const result = await apiRequest('me');
      const s = this.getSession();
      if (s && result.usuario) {
        s.usuario = result.usuario;
        this.setSession(s);
        this.decorateHome();
      }
    } catch (error) {
      /* Sessão inválida é tratada em onSessionLost (via apiRequest) */
    }
  },

  /* apiRequest chama quando o servidor recusa a sessão */
  onSessionLost(code) {
    if (this._relogin) return;
    const messages = {
      SESSAO_EXPIRADA: 'Sua sessão expirou. Entre novamente.',
      USUARIO_INATIVO: 'Seu acesso foi desativado. Procure o administrador.',
      SESSAO_INVALIDA: 'Sua sessão não é mais válida. Entre novamente.',
      NAO_AUTENTICADO: 'Entre para continuar.'
    };
    this.clearSession();
    this._relogin = this.showLogin({ message: messages[code] || messages.NAO_AUTENTICADO })
      .finally(() => { this._relogin = null; });
  },


  /* =======================================================
     TELA DE LOGIN
  ======================================================= */

  showLogin({ message = '' } = {}) {
    document.querySelector('.auth-screen')?.remove();

    return new Promise(resolve => {
      const screen = document.createElement('div');
      screen.className = 'auth-screen';
      screen.innerHTML = `
        <form class="auth-card" novalidate>
          <div class="auth-brand">
            <div class="brand-mark">DV</div>
            <div>
              <h1>Defesa Vegetal AM</h1>
              <p>Gerência de Defesa Vegetal — ADAF/AM</p>
            </div>
          </div>

          <h2>Entrar</h2>
          ${message ? `<div class="auth-alert">${this.esc(message)}</div>` : ''}
          ${!navigator.onLine ? '<div class="auth-alert auth-warn">Sem internet. O primeiro acesso em cada aparelho precisa de conexão.</div>' : ''}

          <div class="field">
            <label for="loginMatricula">Matrícula ou e-mail institucional</label>
            <input id="loginMatricula" autocomplete="username" inputmode="text" required>
          </div>
          <div class="field">
            <label for="loginSenha">Senha</label>
            <div class="auth-pass">
              <input id="loginSenha" type="password" autocomplete="current-password" required>
              <button type="button" class="auth-eye" aria-label="Mostrar senha">👁</button>
            </div>
          </div>

          <div class="auth-error" id="loginError" role="alert" hidden></div>

          <button type="submit" class="btn btn-primary auth-submit">Entrar</button>
          <p class="auth-foot">Esqueceu a senha ou ainda não tem acesso? Procure o administrador do sistema na gerência.</p>
          <p class="auth-version">${this.esc(APP_CONFIG.APP_VERSION)}</p>
        </form>`;

      document.body.appendChild(screen);
      document.body.classList.add('auth-open');

      const form = screen.querySelector('form');
      const user = screen.querySelector('#loginMatricula');
      const pass = screen.querySelector('#loginSenha');
      const err = screen.querySelector('#loginError');
      const btn = screen.querySelector('.auth-submit');

      try {
        user.value = localStorage.getItem('dv_ultima_matricula') || '';
      } catch {
        /* ignorado */
      }
      (user.value ? pass : user).focus();

      screen.querySelector('.auth-eye').onclick = () => {
        pass.type = pass.type === 'password' ? 'text' : 'password';
      };

      form.onsubmit = async event => {
        event.preventDefault();
        err.hidden = true;

        if (!user.value.trim() || !pass.value) {
          err.textContent = 'Informe matrícula e senha.';
          err.hidden = false;
          return;
        }
        if (!navigator.onLine) {
          err.textContent = 'Sem internet. Conecte-se para entrar.';
          err.hidden = false;
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Entrando...';

        try {
          const result = await apiRequest('login', {
            matricula: user.value.trim(),
            senha: pass.value,
            dispositivo: await NumberPool.deviceId()
          });

          try {
            localStorage.setItem('dv_ultima_matricula', user.value.trim());
          } catch {
            /* ignorado */
          }

          this.setSession({ token: result.token, expiraEm: result.expiraEm, usuario: result.usuario });

          if (result.usuario.Troca_Senha_Obrigatoria) {
            screen.remove();
            await this.showChangePassword({ forced: true, currentPassword: pass.value });
          } else {
            screen.remove();
          }

          document.body.classList.remove('auth-open');
          this.decorateHome();
          App.showMessage(`Bem-vindo(a), ${this.getUser().Nome_Completo.split(' ')[0]}.`, 'success');
          resolve(this.getUser());

        } catch (error) {
          const msg = String(error.message || error);
          err.textContent = msg.includes(':') ? msg.split(':').slice(1).join(':').trim()
            : msg === 'TEMPO_LIMITE_API' ? 'O servidor demorou a responder. Tente de novo.'
            : 'Não foi possível entrar. Verifique a conexão e tente de novo.';
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Entrar';
          pass.select();
        }
      };
    });
  },


  /* =======================================================
     TROCA DE SENHA
  ======================================================= */

  showChangePassword({ forced = false, currentPassword = '' } = {}) {
    return new Promise(resolve => {
      const screen = document.createElement('div');
      screen.className = 'auth-screen';
      screen.innerHTML = `
        <form class="auth-card" novalidate>
          <h2>${forced ? 'Crie sua senha' : 'Trocar senha'}</h2>
          <p class="auth-sub">${forced
            ? 'Este é seu primeiro acesso (ou sua senha foi redefinida). Crie uma senha pessoal.'
            : 'Informe a senha atual e a nova senha.'}</p>

          ${currentPassword ? '' : `
            <div class="field">
              <label for="cpAtual">Senha atual</label>
              <input id="cpAtual" type="password" autocomplete="current-password" required>
            </div>`}
          <div class="field">
            <label for="cpNova">Nova senha</label>
            <input id="cpNova" type="password" autocomplete="new-password" required>
            <small>Mínimo de 8 caracteres, com letras e números.</small>
          </div>
          <div class="field">
            <label for="cpConf">Repita a nova senha</label>
            <input id="cpConf" type="password" autocomplete="new-password" required>
          </div>

          <div class="auth-error" id="cpError" role="alert" hidden></div>

          <button type="submit" class="btn btn-primary auth-submit">Salvar senha</button>
          ${forced ? '' : '<button type="button" class="btn btn-secondary auth-submit" data-cancel>Cancelar</button>'}
        </form>`;

      document.body.appendChild(screen);
      document.body.classList.add('auth-open');

      const err = screen.querySelector('#cpError');
      const btn = screen.querySelector('[type=submit]');
      const close = value => {
        screen.remove();
        if (!document.querySelector('.auth-screen')) document.body.classList.remove('auth-open');
        resolve(value);
      };

      screen.querySelector('[data-cancel]')?.addEventListener('click', () => close(false));
      (screen.querySelector('#cpAtual') || screen.querySelector('#cpNova')).focus();

      screen.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        const atual = currentPassword || screen.querySelector('#cpAtual').value;
        const nova = screen.querySelector('#cpNova').value;
        const conf = screen.querySelector('#cpConf').value;
        const show = text => { err.textContent = text; err.hidden = false; };

        if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) return show('A senha precisa de ao menos 8 caracteres, com letras e números.');
        if (nova !== conf) return show('As senhas não conferem.');
        if (!navigator.onLine) return show('Sem internet. Conecte-se para trocar a senha.');

        btn.disabled = true;
        try {
          const result = await apiRequest('changePassword', { senhaAtual: atual, novaSenha: nova });
          const s = this.getSession();
          s.usuario = result.usuario;
          this.setSession(s);
          App.showMessage('Senha alterada.', 'success');
          close(true);
        } catch (error) {
          const msg = String(error.message || error);
          show(msg.includes('SENHA_ATUAL') ? 'Senha atual incorreta.'
            : msg.includes(':') ? msg.split(':').slice(1).join(':').trim()
            : 'Não foi possível trocar a senha.');
          btn.disabled = false;
        }
      };
    });
  },


  /* =======================================================
     MEU PERFIL
  ======================================================= */

  showIdentification() {
    return this.showProfile();
  },

  showProfile() {
    const u = this.getUser();
    if (!u) return this.showLogin();

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'auth-overlay';
      overlay.innerHTML = `
        <div class="auth-dialog form-card" role="dialog" aria-modal="true">
          <div class="form-heading">
            <div>
              <h3>${this.esc(u.Nome_Completo)}</h3>
              <p>${this.esc(u.Cargo_Funcao || 'Cargo não informado')} • Matrícula ${this.esc(u.Matricula)}</p>
            </div>
            <span class="fz-pill fz-ok">${this.esc(this.profileLabel(u.Perfil_Acesso))}</span>
          </div>

          <div class="summary-grid">
            <div><small>Lotação</small><strong>${this.esc(u.Unidade_Lotacao || '—')}</strong></div>
            <div><small>E-mail</small><strong>${this.esc(u.Email_Institucional || '—')}</strong></div>
            <div><small>Sessão válida até</small><strong>${new Date(this.getSession().expiraEm).toLocaleDateString('pt-BR')}</strong></div>
          </div>

          <div class="auth-sign">
            <div>
              <strong>Minha assinatura</strong>
              <small>Aplicada automaticamente nos termos que você emitir neste aparelho.</small>
            </div>
            <div class="auth-sign-preview" id="profSignPreview">
              ${u.Assinatura ? `<img src="${u.Assinatura}" alt="Assinatura">` : '<span>Não cadastrada — os termos sairão com assinatura eletrônica</span>'}
            </div>
            <button type="button" class="btn btn-secondary" id="profSign">✍️ ${u.Assinatura ? 'Refazer assinatura' : 'Cadastrar assinatura'}</button>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary fz-danger" id="profLogout">Sair</button>
            <button type="button" class="btn btn-secondary" id="profPass">🔑 Trocar senha</button>
            <button type="button" class="btn btn-primary" id="profClose">Fechar</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);
      const close = () => { overlay.remove(); resolve(this.getUser()); };

      overlay.querySelector('#profClose').onclick = close;
      overlay.onclick = e => { if (e.target === overlay) close(); };

      overlay.querySelector('#profSign').onclick = async () => {
        overlay.hidden = true;
        const result = await SignaturePad.capture({ title: 'Minha assinatura', name: u.Nome_Completo, detail: `${u.Cargo_Funcao || ''} • Matrícula ${u.Matricula}` });
        overlay.hidden = false;
        if (result && result.image) {
          this.setSignature(result.image);
          overlay.querySelector('#profSignPreview').innerHTML = `<img src="${result.image}" alt="Assinatura">`;
          overlay.querySelector('#profSign').textContent = '✍️ Refazer assinatura';
          App.showMessage('Assinatura salva neste aparelho.', 'success');
        }
      };

      overlay.querySelector('#profPass').onclick = async () => {
        overlay.hidden = true;
        await this.showChangePassword();
        overlay.hidden = false;
      };

      overlay.querySelector('#profLogout').onclick = async () => {
        const pending = await countPendingSyncItems();
        const warn = pending
          ? `\n\nAtenção: há ${pending} registro(s) ainda não enviado(s). Eles ficam guardados neste aparelho e serão enviados quando alguém entrar e sincronizar.`
          : '';
        if (!confirm('Sair do sistema neste aparelho?' + warn)) return;
        try {
          if (navigator.onLine) await apiRequest('logout');
        } catch {
          /* a sessão expira sozinha */
        }
        this.clearSession();
        overlay.remove();
        App.showHome();
        await this.showLogin({ message: 'Você saiu do sistema.' });
        App.showHome();
        resolve(null);
      };
    });
  },


  /* =======================================================
     INTERFACE
  ======================================================= */

  renderBadge() {
    const header = document.querySelector('.header-content');
    if (!header) return;

    let badge = document.getElementById('userBadge');
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'userBadge';
      badge.type = 'button';
      badge.className = 'user-badge';
      badge.onclick = () => this.isValid() ? this.showProfile() : this.showLogin();
      header.insertBefore(badge, document.getElementById('connectionStatus'));
    }

    const user = this.getUser();
    badge.replaceChildren();
    const icon = document.createElement('span');
    icon.textContent = '👤';
    const name = document.createElement('span');
    name.className = 'ub-name';
    name.textContent = user ? user.Nome_Completo.split(' ').slice(0, 2).join(' ') : 'Entrar';
    badge.append(icon, name);
    badge.title = user ? `${user.Nome_Completo} • ${this.profileLabel(user.Perfil_Acesso)} (toque para ver o perfil)` : 'Entrar';
  },

  /* Ajusta a tela inicial ao perfil (ex.: cartão Servidores) */
  decorateHome() {
    const grid = document.querySelector('.menu-card')?.parentElement;
    if (!grid) return;

    const existing = grid.querySelector('[data-module="servidores"]');
    if (this.can('servidores') && !existing) {
      const card = document.createElement('article');
      card.className = 'menu-card';
      card.dataset.module = 'servidores';
      card.innerHTML = `
        <div class="icon">👥</div>
        <h3>Servidores</h3>
        <p>Cadastro de servidores, perfis de acesso e redefinição de senhas.</p>
        <span class="badge">Administração</span>`;
      grid.appendChild(card);
      card.onclick = () => App.openModule('servidores');
    } else if (!this.can('servidores') && existing) {
      existing.remove();
    }
  }
};
