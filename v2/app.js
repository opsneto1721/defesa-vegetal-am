/* =========================================================
   DEFESA VEGETAL AM V2
   APLICAÇÃO PRINCIPAL
========================================================= */

const App = {

  initialized: false,

  async init() {

    if (this.initialized) {
      return;
    }

    this.initialized = true;

    console.log(
      `Iniciando ${APP_CONFIG.APP_NAME} ${APP_CONFIG.APP_VERSION}`
    );

    try {

      await initLocalDatabase();

      this.setVersion();

      this.bindEvents();

      this.updateConnectionStatus();

      await this.updateSyncStatus();

      await this.registerServiceWorker();

      console.log(
        'Defesa Vegetal AM V2 inicializada.'
      );

    } catch (error) {

      console.error(
        'Erro ao inicializar a V2:',
        error
      );

      this.showMessage(
        'Não foi possível inicializar o armazenamento local.',
        'error'
      );
    }
  },


  /* =======================================================
     VERSÃO
  ======================================================= */

  setVersion() {

    const element =
      document.getElementById(
        'appVersion'
      );

    if (!element) {
      return;
    }

    element.textContent =
      ` • ${APP_CONFIG.APP_VERSION}`;
  },


  /* =======================================================
     EVENTOS
  ======================================================= */

  bindEvents() {

    window.addEventListener(
      'online',
      async () => {

        this.updateConnectionStatus();

        await this.updateSyncStatus();

        this.showMessage(
          'Conexão restabelecida.',
          'success'
        );
      }
    );


    window.addEventListener(
      'offline',
      async () => {

        this.updateConnectionStatus();

        await this.updateSyncStatus();

        this.showMessage(
          'Sem internet. O trabalho continuará salvo neste dispositivo.',
          'warning'
        );
      }
    );


    window.addEventListener(
      'sync-start',
      () => {

        const button =
          document.getElementById(
            'syncButton'
          );

        if (button) {

          button.disabled = true;

          button.textContent =
            'Sincronizando...';
        }
      }
    );


    window.addEventListener(
      'sync-end',
      async () => {

        const button =
          document.getElementById(
            'syncButton'
          );

        if (button) {

          button.disabled = false;

          button.textContent =
            '↻ Sincronizar agora';
        }

        await this.updateSyncStatus();
      }
    );


    const syncButton =
      document.getElementById(
        'syncButton'
      );

    if (syncButton) {

      syncButton.addEventListener(
        'click',
        () => this.handleManualSync()
      );
    }


    document
      .querySelectorAll(
        '.menu-card'
      )
      .forEach(card => {

        card.setAttribute(
          'role',
          'button'
        );

        card.setAttribute(
          'tabindex',
          '0'
        );

        card.addEventListener(
          'click',
          () => {

            this.openModule(
              card.dataset.module
            );
          }
        );


        card.addEventListener(
          'keydown',
          event => {

            if (
              event.key === 'Enter' ||
              event.key === ' '
            ) {

              event.preventDefault();

              this.openModule(
                card.dataset.module
              );
            }
          }
        );
      });
  },


  /* =======================================================
     ONLINE / OFFLINE
  ======================================================= */

  updateConnectionStatus() {

    const element =
      document.getElementById(
        'connectionStatus'
      );

    if (!element) {
      return;
    }

    if (navigator.onLine) {

      element.textContent =
        '● Online';

      element.classList.remove(
        'offline'
      );

    } else {

      element.textContent =
        '● Offline';

      element.classList.add(
        'offline'
      );
    }
  },


  /* =======================================================
     STATUS DA FILA
  ======================================================= */

  async updateSyncStatus() {

    const element =
      document.getElementById(
        'syncText'
      );

    if (!element) {
      return;
    }

    try {

      const pending =
        await countPendingSyncItems();

      const lastSync =
        await getMeta(
          'lastSuccessfulSync'
        );


      if (pending > 0) {

        element.textContent =
          `${pending} registro(s) aguardando sincronização`;

        return;
      }


      if (lastSync) {

        element.textContent =
          `Tudo sincronizado • última sincronização ${this.formatDateTime(lastSync)}`;

        return;
      }


      if (!apiIsConfigured()) {

        element.textContent =
          'Banco local pronto • API V2 ainda não configurada';

        return;
      }


      element.textContent =
        'Nenhum registro pendente';

    } catch (error) {

      console.error(
        'Erro ao consultar fila:',
        error
      );

      element.textContent =
        'Não foi possível verificar a sincronização';
    }
  },


  /* =======================================================
     SINCRONIZAÇÃO MANUAL
  ======================================================= */

  async handleManualSync() {

    if (!navigator.onLine) {

      this.showMessage(
        'Sem conexão com a internet. Os dados permanecem salvos neste dispositivo.',
        'warning'
      );

      return;
    }


    if (!apiIsConfigured()) {

      this.showMessage(
        'A API da V2 ainda não foi configurada. O banco local está funcionando normalmente.',
        'warning'
      );

      return;
    }


    try {

      const result =
        await syncAll();


      if (result.ok) {

        this.showMessage(
          `${result.success} registro(s) sincronizado(s).`,
          'success'
        );

      } else {

        this.showMessage(
          `Sincronização concluída com ${result.errors || 0} erro(s) e ${result.waiting || 0} dependência(s) pendente(s).`,
          'warning'
        );
      }


      await this.updateSyncStatus();

    } catch (error) {

      console.error(
        'Falha na sincronização:',
        error
      );

      this.showMessage(
        'Não foi possível concluir a sincronização.',
        'error'
      );
    }
  },


  /* =======================================================
     MÓDULOS
  ======================================================= */

  openModule(moduleName) {
     if (moduleName === 'cadastros') {
         CadastrosModule.open();
          return;
      }

    /*
      Nesta primeira etapa, os cartões já são
      interativos, mas os formulários serão
      implementados em seguida.
    */

    const names = {

      fiscalizacoes:
        'Fiscalizações',

      cadastros:
        'Cadastros',

      armadilhas:
        'Armadilhas',

      viveiros:
        'Viveiros',

      historico:
        'Histórico e documentos',

      dashboard:
        'Dashboard'
    };


    const name =
      names[moduleName] ||
      'Módulo';


    this.showMessage(
      `${name}: módulo preparado para a próxima etapa.`,
      'info'
    );
  },


  /* =======================================================
     MENSAGENS
  ======================================================= */

  showMessage(
    message,
    type = 'info'
  ) {

    let container =
      document.getElementById(
        'toastContainer'
      );


    if (!container) {

      container =
        document.createElement(
          'div'
        );

      container.id =
        'toastContainer';

      Object.assign(
        container.style,
        {
          position: 'fixed',
          left: '16px',
          right: '16px',
          bottom: '20px',
          zIndex: '9999',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none'
        }
      );

      document.body.appendChild(
        container
      );
    }


    const toast =
      document.createElement(
        'div'
      );


    const backgrounds = {

      success: '#16794b',

      warning: '#9a6700',

      error: '#b42318',

      info: '#344054'
    };


    toast.textContent =
      message;


    Object.assign(
      toast.style,
      {
        maxWidth: '620px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        background:
          backgrounds[type] ||
          backgrounds.info,
        color: '#ffffff',
        boxShadow:
          '0 8px 24px rgba(0,0,0,.18)',
        fontSize: '14px',
        lineHeight: '1.4',
        pointerEvents: 'auto'
      }
    );


    container.appendChild(
      toast
    );


    setTimeout(
      () => {

        toast.remove();

      },
      4200
    );
  },


  /* =======================================================
     DATA / HORA
  ======================================================= */

  formatDateTime(value) {

    try {

      return new Intl.DateTimeFormat(
        'pt-BR',
        {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      ).format(
        new Date(value)
      );

    } catch {

      return value;
    }
  },


  /* =======================================================
     SERVICE WORKER
  ======================================================= */

  async registerServiceWorker() {

    if (
      !(
        'serviceWorker'
        in navigator
      )
    ) {

      console.warn(
        'Service Worker não suportado.'
      );

      return;
    }


    try {

      const registration =
        await navigator
          .serviceWorker
          .register(
            './service-worker.js',
            {
              scope: './'
            }
          );


      console.log(
        'Service Worker registrado:',
        registration.scope
      );

    } catch (error) {

      console.error(
        'Erro ao registrar Service Worker:',
        error
      );
    }
  }
};


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    App.init();

  }
);
