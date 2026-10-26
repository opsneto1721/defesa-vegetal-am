/* =========================================================
   DEFESA VEGETAL AM - V2
   MÓDULO: DASHBOARD DE CADASTROS
========================================================= */

const DashboardModule = {

  produtores: [],
  propriedades: [],
  culturas: [],


  /* =======================================================
     ABRIR DASHBOARD
  ======================================================= */

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

            <h2>
              Dashboard de Cadastros
            </h2>

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


  /* =======================================================
     CARREGAR DASHBOARD
  ======================================================= */

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
         CARREGAR DADOS DO INDEXEDDB
      ===================================================== */

      this.produtores =
        await dbGetAll('produtores');

      this.propriedades =
        await dbGetAll('propriedades');

      this.culturas =
        await dbGetAll('culturas');


      const produtores =
        this.produtores;

      const propriedades =
        this.propriedades;

      const culturas =
        this.culturas;


      /* =====================================================
         CALCULAR ÁREA TOTAL
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
             INDICADORES
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
             CONSULTA DE CADASTROS
        ================================================ -->

        <section class="dashboard-section">

          <div class="dashboard-section-header">

            <div>

              <h3>
                Consultar cadastros
              </h3>

              <p>
                Visualize e pesquise produtores
                e propriedades cadastradas.
              </p>

            </div>

          </div>


          <div class="dashboard-consult-actions">

            <button
              type="button"
              class="btn btn-primary"
              onclick="DashboardModule.showProdutores()"
            >
              👤 Visualizar produtores
            </button>


            <button
              type="button"
              class="btn btn-secondary"
              onclick="DashboardModule.showPropriedades()"
            >
              🌱 Visualizar propriedades
            </button>

          </div>


          <div
            id="dashboardConsulta"
            class="dashboard-consulta"
          >

            <p class="dashboard-empty">
              Selecione uma opção acima
              para consultar os cadastros.
            </p>

          </div>

        </section>


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
                                ${this.escapeHtml(
                                  municipio
                                )}
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

                  <p class="dashboard-empty">
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
          placeholder="Pesquisar por nome, CPF/CNPJ ou município..."
          oninput="DashboardModule.filterProdutores(this.value)"
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
              produtor.Nome,
              produtor.nome,
              produtor.Nome_Produtor,
              produtor.nomeProdutor,
              produtor.CPF_CNPJ,
              produtor.cpfCnpj,
              produtor.CPF,
              produtor.CNPJ,
              produtor.Municipio,
              produtor.municipio
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
              produtor.Nome ||
              produtor.nome ||
              produtor.Nome_Produtor ||
              produtor.nomeProdutor ||
              'Produtor sem nome';


            const cpfCnpj =
              produtor.CPF_CNPJ ||
              produtor.cpfCnpj ||
              produtor.CPF ||
              produtor.CNPJ ||
              'Não informado';


            const municipio =
              produtor.Municipio ||
              produtor.municipio ||
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
                    Município:
                    ${this.escapeHtml(municipio)}
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
          oninput="DashboardModule.filterPropriedades(this.value)"
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


          const texto =
            [
              propriedade.Nome_Propriedade,
              propriedade.nomePropriedade,
              propriedade.Nome,
              propriedade.nome,
              propriedade.Municipio,
              propriedade.municipio,

              produtor
                ? (
                    produtor.Nome ||
                    produtor.nome ||
                    produtor.Nome_Produtor ||
                    produtor.nomeProdutor
                  )
                : ''
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
              propriedade.nomePropriedade ||
              propriedade.Nome ||
              propriedade.nome ||
              'Propriedade sem nome';


            const municipio =
              propriedade.Municipio ||
              propriedade.municipio ||
              'Não informado';


            const comunidade =
              propriedade.Comunidade ||
              propriedade.comunidade ||
              propriedade.Localidade ||
              propriedade.localidade ||
              'Não informado';


            const produtor =
              this.getProdutorDaPropriedade(
                propriedade
              );


            const nomeProdutor =
              produtor
                ? (
                    produtor.Nome ||
                    produtor.nome ||
                    produtor.Nome_Produtor ||
                    produtor.nomeProdutor ||
                    'Não informado'
                  )
                : (
                    propriedade.Nome_Produtor ||
                    propriedade.nomeProdutor ||
                    'Não informado'
                  );


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
                    ${this.escapeHtml(nomeProdutor)}
                  </span>


                  <span>
                    Município:
                    ${this.escapeHtml(municipio)}
                  </span>


                  <span>
                    Comunidade/Localidade:
                    ${this.escapeHtml(comunidade)}
                  </span>

                </div>

              </article>

            `;
          }
        )
        .join('');
  },


  /* =======================================================
     LOCALIZAR PRODUTOR DA PROPRIEDADE
  ======================================================= */

  getProdutorDaPropriedade(
    propriedade
  ) {

    const produtorId =
      propriedade.ID_Produtor ||
      propriedade.idProdutor ||
      propriedade.ID_Produtor_Local ||
      propriedade.idProdutorLocal;


    if (!produtorId) {
      return null;
    }


    return (
      this.produtores.find(
        produtor => {

          const ids = [
            produtor.id,
            produtor.ID,
            produtor.ID_Produtor,
            produtor.idProdutor,
            produtor.ID_Produtor_Local,
            produtor.idProdutorLocal
          ]
            .filter(Boolean)
            .map(String);


          return ids.includes(
            String(produtorId)
          );
        }
      ) ||
      null
    );
  },


  /* =======================================================
     PROTEÇÃO DE TEXTO PARA HTML
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
