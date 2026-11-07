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
     CARREGAR DADOS
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
         ÁREA TOTAL DE PRODUÇÃO
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
             CONSULTAR CADASTROS
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
                    Nenhuma propriedade cadastrada.
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
          placeholder="Pesquisar por nome, CPF/CNPJ, telefone ou e-mail..."
          oninput="
            DashboardModule.filterProdutores(
              this.value
            )
          "
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
              produtor.Nome_Razao_Social,
              produtor.CPF_CNPJ,
              produtor.Telefone,
              produtor.Email,
              produtor.Tipo_Pessoa,
              produtor.Status
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
              produtor.Nome_Razao_Social ||
              'Produtor sem nome';


            const cpfCnpj =
              produtor.CPF_CNPJ ||
              'Não informado';


            const telefone =
              produtor.Telefone ||
              'Não informado';


            const email =
              produtor.Email ||
              'Não informado';


            const tipoPessoa =
              produtor.Tipo_Pessoa ||
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
                    Telefone:
                    ${this.escapeHtml(telefone)}
                  </span>


                  <span>
                    E-mail:
                    ${this.escapeHtml(email)}
                  </span>


                  <span>
                    Tipo:
                    ${this.escapeHtml(tipoPessoa)}
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
          oninput="
            DashboardModule.filterPropriedades(
              this.value
            )
          "
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


          const nomeProdutor =
            produtor
              ? produtor.Nome_Razao_Social
              : '';


          const texto =
            [
              propriedade.Nome_Propriedade,
              propriedade.Codigo_Propriedade_Oficial,
              propriedade.Propriedade_Comercial,
              propriedade.Comunidade_Localidade,
              propriedade.Municipio,
              propriedade.UF,
              nomeProdutor
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
              'Propriedade sem nome';


            const municipio =
              propriedade.Municipio ||
              'Não informado';


            const comunidade =
              propriedade.Comunidade_Localidade ||
              'Não informado';


            const areaTotal =
              propriedade.Area_Total_ha;


            const areaAgricola =
              propriedade.Area_Agricola_ha;


            const produtor =
              this.getProdutorDaPropriedade(
                propriedade
              );


            const nomeProdutor =
              produtor
                ? (
                    produtor.Nome_Razao_Social ||
                    'Não informado'
                  )
                : 'Não informado';


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
                    ${this.escapeHtml(
                      nomeProdutor
                    )}
                  </span>


                  <span>
                    Município:
                    ${this.escapeHtml(
                      municipio
                    )}
                  </span>


                  <span>
                    Comunidade/Localidade:
                    ${this.escapeHtml(
                      comunidade
                    )}
                  </span>


                  ${
                    areaTotal !== undefined &&
                    areaTotal !== null &&
                    areaTotal !== ''

                      ? `

                        <span>
                          Área total:
                          ${this.escapeHtml(
                            areaTotal
                          )} ha
                        </span>

                      `

                      : ''
                  }


                  ${
                    areaAgricola !== undefined &&
                    areaAgricola !== null &&
                    areaAgricola !== ''

                      ? `

                        <span>
                          Área agrícola:
                          ${this.escapeHtml(
                            areaAgricola
                          )} ha
                        </span>

                      `

                      : ''
                  }

                </div>

              </article>

            `;
          }
        )
        .join('');
  },


  /* =======================================================
     ENCONTRAR PRODUTOR VINCULADO À PROPRIEDADE
  ======================================================= */

  getProdutorDaPropriedade(
    propriedade
  ) {

    /*
       O sistema possui registros locais e registros
       sincronizados com o servidor.

       Por isso aceitamos diferentes identificadores.
    */

    const idsPropriedade = [

      propriedade.ID_Produtor,

      propriedade.ID_Produtor_Local,

      propriedade.ID_Proprietario,

      propriedade.idProdutor,

      propriedade.idProdutorLocal

    ]
      .filter(
        valor =>
          valor !== undefined &&
          valor !== null &&
          String(valor).trim() !== ''
      )
      .map(
        valor =>
          String(valor).trim()
      );


    if (!idsPropriedade.length) {
      return null;
    }


    const produtorEncontrado =
      this.produtores.find(
        produtor => {

          const idsProdutor = [

            produtor.ID_Produtor,

            produtor.id,

            produtor.ID_Servidor_Cadastro

          ]
            .filter(
              valor =>
                valor !== undefined &&
                valor !== null &&
                String(valor).trim() !== ''
            )
            .map(
              valor =>
                String(valor).trim()
            );


          return idsPropriedade.some(
            id =>
              idsProdutor.includes(id)
          );
        }
      );


    return (
      produtorEncontrado ||
      null
    );
  },


  /* =======================================================
     PROTEÇÃO DE TEXTO
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
