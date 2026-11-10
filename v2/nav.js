/* =========================================================
   DEFESA VEGETAL AM - V2
   NAVEGAÇÃO: VOLTAR À TELA ANTERIOR

   Cada tela aberta vira um passo no histórico do navegador.
   Assim o botão "← Voltar" e o gesto/botão de voltar do
   celular retornam à tela anterior, e não só ao início.

   As telas são registradas "por fora" dos módulos
   (Nav.track), sem alterar o código de cada um.
========================================================= */

const Nav = {

  entries: new Map(),
  seq: 0,
  depth: 0,
  restoring: false,

  install() {
    history.replaceState({ dvNav: 'home' }, '');
    window.addEventListener('popstate', event => this.onPop(event.state));

    /* Telas transitórias (formulários) são substituídas pela próxima
       tela, para o Voltar não reabrir um formulário já salvo. */

    this.track(App, 'showHome', { home: true });

    const cad = () => document.getElementById('cadastroWorkspace') ? null : CadastrosModule.open();
    this.track(CadastrosModule, 'open');
    this.track(CadastrosModule, 'showProducerSearch', { shell: cad });
    this.track(CadastrosModule, 'showProducerDetails', { shell: cad, keep: ['currentProducer'] });
    this.track(CadastrosModule, 'showPropertyDetails', { shell: cad, keep: ['currentProducer', 'currentProperty'] });
    this.track(CadastrosModule, 'showProducerForm', { shell: cad, keep: ['currentProducer'], transient: true });
    this.track(CadastrosModule, 'showPropertyForm', { shell: cad, keep: ['currentProducer', 'currentProperty'], transient: true });
    this.track(CadastrosModule, 'showCultureForm', { shell: cad, keep: ['currentProducer', 'currentProperty'], transient: true });

    const fz = () => document.getElementById('fzWorkspace') ? null : FiscalizacoesModule.open();
    this.track(FiscalizacoesModule, 'open');
    this.track(FiscalizacoesModule, 'startNew', { shell: fz, transient: true });
    this.track(FiscalizacoesModule, 'showGeneralForm', { shell: fz, transient: true });
    this.track(FiscalizacoesModule, 'openInspection', { shell: fz });
    this.track(FiscalizacoesModule, 'openFromAnywhere');
    this.track(FiscalizacoesModule, 'startFromProperty', { transient: true });

    this.track(HistoricoModule, 'open');
    this.track(HistoricoModule, 'openTimeline');
    this.track(HistoricoModule, 'renderTimeline', {
      shell: () => document.getElementById('hsTimeline') ? null : HistoricoModule.open('linha')
    });
    if (HistoricoModule.openReport) this.track(HistoricoModule, 'openReport', {
      shell: () => document.getElementById('hsContent') ? null : HistoricoModule.open('relatorios')
    });

    this.track(DashboardModule, 'open');
    this.track(ServidoresModule, 'open');
  },

  track(obj, method, opts = {}) {
    const original = obj && obj[method];
    if (typeof original !== 'function') return;
    const nav = this;

    obj[method] = async function (...args) {
      // Chamadas internas (de dentro de outra tela) e restaurações não criam passo
      if (nav.restoring || nav.depth > 0) {
        nav.depth++;
        try {
          return await original.apply(obj, args);
        } finally {
          nav.depth--;
        }
      }

      nav.depth++;
      try {
        const result = await original.apply(obj, args);
        const kept = {};
        (opts.keep || []).forEach(k => { kept[k] = obj[k]; });

        nav.push(async () => {
          if (opts.shell) await opts.shell();
          Object.assign(obj, kept);
          await original.apply(obj, args);
        }, { transient: !!opts.transient, home: !!opts.home });

        return result;
      } finally {
        nav.depth--;
      }
    };
  },

  push(render, { transient = false, home = false } = {}) {
    const current = history.state && this.entries.get(history.state.dvNav);

    // Ir ao início não empilha início sobre início
    if (home && (!history.state || history.state.dvNav === 'home')) return;

    const id = ++this.seq;
    this.entries.set(id, { render, transient });

    if (current && current.transient) history.replaceState({ dvNav: id }, '');
    else history.pushState({ dvNav: id }, '');

    window.scrollTo({ top: 0 });
  },

  async onPop(state) {
    // Janelas abertas (formulários, assinatura) fecham primeiro
    document.querySelectorAll('.fz-sheet-overlay').forEach(el => el.remove());
    document.body.classList.remove('fz-sheet-open');

    const entry = state && this.entries.get(state.dvNav);
    this.restoring = true;
    try {
      if (!entry) await App.showHome();
      else await entry.render();
    } catch (error) {
      console.error('Não foi possível voltar à tela anterior:', error);
      await App.showHome();
    } finally {
      this.restoring = false;
    }
    window.scrollTo({ top: 0 });
  },

  /* Botão "← Voltar" das telas */
  back() {
    if (history.state && history.state.dvNav && history.state.dvNav !== 'home') {
      history.back();
    } else {
      App.showHome();
    }
  }
};
