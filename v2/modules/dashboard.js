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

      /* =====================================================
         CARREGAR DADOS
      ===================================================== */

      const produtores =
        await dbGetAll('produtores');

      const propriedades =
        await dbGetAll('propriedades');

      const culturas =
        await dbGetAll('culturas');


      /* =====================================================
         CALCULAR ÁREA TOTAL DE PRODUÇÃO
      ===================================================== */

      const areaTotal =
        culturas.reduce(
          (total, cultura) => {

            const area =
              Number(
                cultura.Area_Producao_ha ||
                cultura.areaProducao ||
                cultura.area ||
                0
              );

            return total + area;
          },
          0
        );


      /* =====================================================
         PROPRIEDADES POR MUNICÍPIO
      ===================================================== */

      const propriedadesPorMunicipio = {};

      propriedades.forEach(
        propriedade => {

          const municipio =
            propriedade.Municipio ||
            propriedade.municipio ||
            'Não informado';

          propriedadesPorMunicipio[municipio] =
            (
              propriedadesPorMunicipio[municipio] ||
              0
            ) + 1;
        }
      );


      const municipiosOrdenados =
        Object.entries(
          propriedadesPorMunicipio
        )
          .sort(
            (a, b) => b[1] - a[1]
          );


      const maiorQuantidadeMunicipio =
        Math.max(
          ...municipiosOrdenados.map(
            item => item[1]
          ),
          1
        );


      /* =====================================================
         LOG PARA TESTES
      ===================================================== */

      console.log(
        'Dashboard:',
        {
          produtores,
          propriedades,
          culturas,
          areaTotal,
          propriedadesPorMunicipio
        }
      );


      /* =====================================================
         MONTAR DASHBOARD
      ===================================================== */

      container.innerHTML = `

        <!-- ===============================================
             INDICADORES PRINCIPAIS
        ================================================ -->

        <div class="dashboard-summary">

          <article class="dashboard-card">

            <span>
              Produtores
            </span>

            <strong>
              ${produtores.length}
            </strong>

          </article>


          <article class="dashboard-card">

            <span>
              Propriedades
            </span>

            <strong>
              ${propriedades.length}
            </strong>

          </article>


          <article class="dashboard-card">

            <span>
              Culturas
            </span>

            <strong>
              ${culturas.length}
            </strong>

          </article>


          <article class="dashboard-card">

            <span>
              Área total de produção
            </span>

            <strong>

              ${areaTotal.toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }
              )} ha

            </strong>

          </article>

        </div>


        <!-- ===============================================
             PROPRIEDADES POR MUNICÍPIO
        ================================================ -->

        <section class="dashboard-section">

          <div class="dashboard-section-header">

            <div>

              <h3>
                Propriedades por município
              </h3>

              <p>
                Distribuição das propriedades
                cadastradas no sistema.
              </p>

            </div>

          </div>


          <div class="dashboard-chart">

            ${
              municipiosOrdenados.length

                ? municipiosOrdenados
                    .map(
                      (
                        [
                          municipio,
                          quantidade
                        ]
                      ) => {

                        const percentual =
                          (
                            quantidade /
                            maiorQuantidadeMunicipio
                          ) * 100;

                        return `

                          <div
                            class="dashboard-bar-row"
                          >

                            <div
                              class="dashboard-bar-info"
                            >

                              <span>
                                ${municipio}
                              </span>

                              <strong>
                                ${quantidade}
                              </strong>

                            </div>


                            <div
                              class="dashboard-bar-track"
                            >

                              <div
                                class="dashboard-bar-fill"
                                style="
                                  width:
                                  ${percentual}%;
                                "
                              ></div>

                            </div>

                          </div>

                        `;
                      }
                    )
                    .join('')

                : `

                  <p
                    class="dashboard-empty"
                  >
                    Nenhuma propriedade
                    cadastrada.
                  </p>

                `
            }

          </div>

        </section>

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
