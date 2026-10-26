/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: DASHBOARD DE CADASTROS
========================================================= */

const DashboardModule = {

  async open() {

    console.log(
      'Abrindo Dashboard de Cadastros...'
    );

    const main =
      document.querySelector('main');

    if (!main) {
      console.error(
        'Elemento <main> não encontrado.'
      );
      return;
    }

    main.innerHTML = `
      <section class="module-page">

        <div class="module-header">
          <button
            type="button"
            class="btn btn-secondary"
            onclick="App.showHome()"
          >
            ← Voltar
          </button>

          <div>
            <h2>Dashboard de Cadastros</h2>
            <p>
              Visão geral dos produtores,
              propriedades e culturas cadastradas.
            </p>
          </div>
        </div>

        <section id="dashboardContent">

          <p>
            Carregando indicadores...
          </p>

        </section>

      </section>
    `;

    await this.load();
  },


  async load() {

    const container =
      document.getElementById(
        'dashboardContent'
      );

    if (!container) {
      return;
    }

    try {

      const produtores =
        await dbGetAll('produtores');

      const propriedades =
        await dbGetAll('propriedades');

      const culturas =
        await dbGetAll('culturas');

      console.log(
        'Dashboard:',
        {
          produtores,
          propriedades,
          culturas
        }
      );

      container.innerHTML = `
        <div class="dashboard-summary">

          <article class="dashboard-card">
            <span>Produtores</span>
            <strong>
              ${produtores.length}
            </strong>
          </article>

          <article class="dashboard-card">
            <span>Propriedades</span>
            <strong>
              ${propriedades.length}
            </strong>
          </article>

          <article class="dashboard-card">
            <span>Culturas</span>
            <strong>
              ${culturas.length}
            </strong>
          </article>

        </div>
      `;

    } catch (error) {

      console.error(
        'Erro ao carregar Dashboard:',
        error
      );

      container.innerHTML = `
        <p>
          Não foi possível carregar
          os dados do Dashboard.
        </p>
      `;
    }
  }

};
