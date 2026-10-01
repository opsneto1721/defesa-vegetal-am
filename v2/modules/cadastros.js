/* =========================================================
   DEFESA VEGETAL AM V2
   MÓDULO DE CADASTROS
========================================================= */

const CadastrosModule = {

  currentProducer: null,
  currentProperty: null,

  /* =======================================================
     ENTRADA DO MÓDULO
  ======================================================= */

  async open() {

    document.querySelector('main').innerHTML = `
      <section class="hero">
        <button
          class="btn btn-secondary"
          type="button"
          onclick="location.reload()"
        >
          ← Início
        </button>

        <h2 style="margin-top:18px">
          Cadastros
        </h2>

        <p>
          Produtores, propriedades e culturas.
        </p>
      </section>

      <section class="module-actions">

        <button
          class="action-card"
          id="btnNovoProdutor"
          type="button"
        >
          <span class="action-icon">👤</span>

          <span>
            <strong>Novo produtor</strong>
            <small>
              Cadastrar pessoa física ou jurídica
            </small>
          </span>
        </button>

        <button
          class="action-card"
          id="btnBuscarProdutor"
          type="button"
        >
          <span class="action-icon">🔎</span>

          <span>
            <strong>Buscar produtor</strong>
            <small>
              Localizar cadastro existente
            </small>
          </span>
        </button>
      <button
        class="action-card"
        id="btnAdicionarPropriedade"
        type="button"
      >
        <span class="action-icon">🏡</span>

        <span>
          <strong>Adicionar propriedade</strong>
          <small>
            Vincular nova propriedade a um produtor
          </small>
        </span>
      </button>


      <button
        class="action-card"
        id="btnBuscarPropriedade"
        type="button"
      >
        <span class="action-icon">📍</span>

        <span>
          <strong>Buscar propriedade</strong>
          <small>
            Localizar propriedade cadastrada
          </small>
        </span>
      </button>
      
      </section>

      <section
        id="cadastroWorkspace"
        class="workspace"
      ></section>
    `;

    document
      .getElementById('btnNovoProdutor')
      .addEventListener(
        'click',
        () => this.showProducerForm()
      );

    document
      .getElementById('btnBuscarProdutor')
      .addEventListener(
        'click',
        () => this.showProducerSearch()
      );
     
     document
  .getElementById(
    'btnAdicionarPropriedade'
  )
  .addEventListener(
    'click',
    () => this.showProducerSelectionForProperty()
  );


document
  .getElementById(
    'btnBuscarPropriedade'
  )
  .addEventListener(
    'click',
    () => this.showPropertySearch()
  );
  },
/* =======================================================
   SELECIONAR PRODUTOR PARA NOVA PROPRIEDADE
======================================================= */

async showProducerSelectionForProperty() {

  const workspace =
    document.getElementById(
      'cadastroWorkspace'
    );

  workspace.innerHTML = `
    <div class="form-card">

      <div class="form-heading">

        <div>
          <h3>Adicionar propriedade</h3>

          <p>
            Localize o produtor ao qual
            a nova propriedade será vinculada.
          </p>
        </div>

      </div>


      <div class="search-row">

        <input
          id="propertyProducerSearch"
          type="search"
          placeholder="Digite nome, CPF ou CNPJ"
          autocomplete="off"
        >

        <button
          id="runPropertyProducerSearch"
          class="btn btn-primary"
          type="button"
        >
          Buscar
        </button>

      </div>


      <div
        id="propertyProducerResults"
        class="search-results"
      ></div>


      <div class="form-actions">

        <button
          id="createProducerForProperty"
          class="btn btn-secondary"
          type="button"
        >
          + Cadastrar novo produtor
        </button>

      </div>

    </div>
  `;


  const input =
    document.getElementById(
      'propertyProducerSearch'
    );


  const runSearch =
    async () => {

      const query =
        String(input.value || '')
          .trim()
          .toLowerCase();


      const numericQuery =
        this.onlyNumbers(query);


      const resultsElement =
        document.getElementById(
          'propertyProducerResults'
        );


      if (!query) {

        resultsElement.innerHTML = `
          <div class="empty-state">
            Digite o nome, CPF ou CNPJ
            do produtor.
          </div>
        `;

        return;
      }


      const producers =
        await dbGetAll(
          'produtores'
        );


      const results =
        producers.filter(
          producer => {

            const name =
              String(
                producer
                  .Nome_Razao_Social ||
                ''
              ).toLowerCase();


            const documentNumber =
              this.onlyNumbers(
                producer.CPF_CNPJ ||
                ''
              );


            return (
              name.includes(query) ||
              (
                numericQuery &&
                documentNumber.includes(
                  numericQuery
                )
              )
            );
          }
        );


      if (!results.length) {

        resultsElement.innerHTML = `
          <div class="empty-state">

            <strong>
              Nenhum produtor encontrado.
            </strong>

            <p>
              Você pode cadastrar um novo
              produtor para continuar.
            </p>

          </div>
        `;

        return;
      }


      resultsElement.innerHTML =
        results
          .map(
            producer => `
              <button
                type="button"
                class="result-card producer-property-result"
                data-id="${this.escapeHTML(
                  producer.id
                )}"
              >

                <strong>
                  ${this.escapeHTML(
                    producer
                      .Nome_Razao_Social ||
                    'Sem nome'
                  )}
                </strong>

                <span>
                  ${this.escapeHTML(
                    this.formatCpfCnpj(
                      producer.CPF_CNPJ ||
                      ''
                    )
                  )}
                </span>

                <small>
                  Selecionar e adicionar
                  propriedade →
                </small>

              </button>
            `
          )
          .join('');


      resultsElement
        .querySelectorAll(
          '.producer-property-result'
        )
        .forEach(
          button => {

            button.addEventListener(
              'click',
              async () => {

                const producer =
                  await dbGet(
                    'produtores',
                    button.dataset.id
                  );


                if (!producer) {

                  App.showMessage(
                    'Produtor não localizado.',
                    'warning'
                  );

                  return;
                }


                this.currentProducer =
                  producer;


                this.currentProperty =
                  null;


                this.showPropertyForm();
              }
            );
          }
        );
    };


  document
    .getElementById(
      'runPropertyProducerSearch'
    )
    .addEventListener(
      'click',
      runSearch
    );


  input.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter'
      ) {

        event.preventDefault();

        runSearch();
      }
    }
  );


  document
    .getElementById(
      'createProducerForProperty'
    )
    .addEventListener(
      'click',
      () => this.showProducerForm()
    );


  input.focus();
},

  /* =======================================================
     FORMULÁRIO DE PRODUTOR
  ======================================================= */

  showProducerForm(existing = null) {

    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );

    const producer =
      existing || {};

    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">
          <div>
            <h3>
              ${existing
                ? 'Editar produtor'
                : 'Novo produtor'}
            </h3>

            <p>
              Identificação do produtor ou
              responsável pela atividade.
            </p>
          </div>

          <span class="step-badge">
            Etapa 1 de 3
          </span>
        </div>


        <form id="producerForm">

          <input
            type="hidden"
            id="producerLocalId"
            value="${this.escapeHTML(
              producer.id || ''
            )}"
          >


          <div class="form-grid">

            <div class="field">

              <label for="tipoPessoa">
                Tipo de pessoa *
              </label>

              <select
                id="tipoPessoa"
                required
              >
                <option value="">
                  Selecione
                </option>

                <option
                  value="FISICA"
                  ${producer.Tipo_Pessoa === 'FISICA'
                    ? 'selected'
                    : ''}
                >
                  Pessoa física
                </option>

                <option
                  value="JURIDICA"
                  ${producer.Tipo_Pessoa === 'JURIDICA'
                    ? 'selected'
                    : ''}
                >
                  Pessoa jurídica
                </option>

              </select>

            </div>


            <div class="field field-wide">

              <label for="nomeProdutor">
                Nome / Razão social *
              </label>

              <input
                id="nomeProdutor"
                type="text"
                maxlength="200"
                required
                autocomplete="name"
                value="${this.escapeHTML(
                  producer.Nome_Razao_Social || ''
                )}"
              >

            </div>


            <div class="field">

              <label for="cpfCnpj">
                CPF / CNPJ *
              </label>

              <input
                id="cpfCnpj"
                type="text"
                inputmode="numeric"
                maxlength="18"
                required
                value="${this.escapeHTML(
                  producer.CPF_CNPJ || ''
                )}"
              >

              <small>
                Utilizado também para evitar
                cadastros duplicados.
              </small>

            </div>


            <div class="field">

              <label for="telefoneProdutor">
                Telefone
              </label>

              <input
                id="telefoneProdutor"
                type="tel"
                maxlength="20"
                autocomplete="tel"
                value="${this.escapeHTML(
                  producer.Telefone || ''
                )}"
              >

            </div>


            <div class="field field-wide">

              <label for="emailProdutor">
                E-mail
              </label>

              <input
                id="emailProdutor"
                type="email"
                maxlength="200"
                autocomplete="email"
                value="${this.escapeHTML(
                  producer.Email || ''
                )}"
              >

            </div>

          </div>


          <div class="form-actions">

            <button
              class="btn btn-secondary"
              type="button"
              id="cancelProducer"
            >
              Cancelar
            </button>

            <button
              class="btn btn-primary"
              type="submit"
            >
              Salvar e continuar →
            </button>

          </div>

        </form>

      </div>
    `;


    document
      .getElementById('cpfCnpj')
      .addEventListener(
        'input',
        event => {

          event.target.value =
            this.formatCpfCnpj(
              event.target.value
            );
        }
      );


    document
      .getElementById(
        'producerForm'
      )
      .addEventListener(
        'submit',
        event =>
          this.saveProducer(event)
      );


    document
      .getElementById(
        'cancelProducer'
      )
      .addEventListener(
        'click',
        () => this.open()
      );


    document
      .getElementById(
        'nomeProdutor'
      )
      .focus();
  },


  /* =======================================================
     SALVAR PRODUTOR
  ======================================================= */

  async saveProducer(event) {

    event.preventDefault();

    const localId =
      document
        .getElementById(
          'producerLocalId'
        )
        .value || createUUID();


    const cpfCnpj =
      this.onlyNumbers(
        document
          .getElementById(
            'cpfCnpj'
          )
          .value
      );


    const tipoPessoa =
      document
        .getElementById(
          'tipoPessoa'
        )
        .value;


    if (
      tipoPessoa === 'FISICA' &&
      cpfCnpj.length !== 11
    ) {

      App.showMessage(
        'Informe um CPF com 11 dígitos.',
        'warning'
      );

      return;
    }


    if (
      tipoPessoa === 'JURIDICA' &&
      cpfCnpj.length !== 14
    ) {

      App.showMessage(
        'Informe um CNPJ com 14 dígitos.',
        'warning'
      );

      return;
    }


    /*
      Procura duplicidade local antes de salvar.
    */
    const producers =
      await dbGetAll(
        'produtores'
      );


    const duplicate =
      producers.find(item => {

        return (
          this.onlyNumbers(
            item.CPF_CNPJ || ''
          ) === cpfCnpj &&
          item.id !== localId
        );
      });


    if (duplicate) {

      App.showMessage(
        'Já existe um produtor cadastrado com este CPF/CNPJ.',
        'warning'
      );

      await this.showProducerDetails(
        duplicate
      );

      return;
    }


    const previous =
      await dbGet(
        'produtores',
        localId
      );


    const record = {

      ...(previous || {}),

      id: localId,

      /*
        ID_Produtor será preenchido pela API
        quando houver sincronização.

        O UUID local continua em "id".
      */
      ID_Produtor:
        previous?.ID_Produtor || '',

      Tipo_Pessoa:
        tipoPessoa,

      Nome_Razao_Social:
        document
          .getElementById(
            'nomeProdutor'
          )
          .value
          .trim(),

      CPF_CNPJ:
        cpfCnpj,

      Telefone:
        document
          .getElementById(
            'telefoneProdutor'
          )
          .value
          .trim(),

      Email:
        document
          .getElementById(
            'emailProdutor'
          )
          .value
          .trim(),

      Status:
        previous?.Status ||
        'ATIVO',

      Data_Cadastro:
        previous?.Data_Cadastro ||
        new Date().toISOString(),

      Data_Atualizacao:
        new Date().toISOString(),

      ID_Servidor_Cadastro:
        previous?.ID_Servidor_Cadastro ||
        ''
    };


    const saved =
      await saveLocalRecord(
        'produtores',
        record,
        {
          operation:
            previous
              ? 'UPDATE'
              : 'CREATE'
        }
      );


    this.currentProducer =
      saved;


    App.showMessage(
      navigator.onLine
        ? 'Produtor salvo. O registro aguardará sincronização com a base central.'
        : 'Produtor salvo neste dispositivo. Será sincronizado quando houver internet.',
      'success'
    );


    await App.updateSyncStatus();


    /*
      Próxima etapa:
      propriedade vinculada ao produtor.
    */
    this.showProducerDetails(
      saved,
      true
    );
  },


  /* =======================================================
     BUSCAR PRODUTOR
  ======================================================= */

  async showProducerSearch() {

    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );


    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">

          <div>
            <h3>Buscar produtor</h3>

            <p>
              Pesquise por nome,
              CPF ou CNPJ.
            </p>
          </div>

        </div>


        <div class="search-row">

          <input
            id="producerSearch"
            type="search"
            placeholder="Digite nome, CPF ou CNPJ"
            autocomplete="off"
          >

          <button
            id="runProducerSearch"
            class="btn btn-primary"
            type="button"
          >
            Buscar
          </button>

        </div>


        <div
          id="producerSearchResults"
          class="search-results"
        ></div>

      </div>
    `;


    const input =
      document.getElementById(
        'producerSearch'
      );


    document
      .getElementById(
        'runProducerSearch'
      )
      .addEventListener(
        'click',
        () =>
          this.searchProducer(
            input.value
          )
      );


    input.addEventListener(
      'keydown',
      event => {

        if (event.key === 'Enter') {

          event.preventDefault();

          this.searchProducer(
            input.value
          );
        }
      }
    );


    input.focus();
  },


  async searchProducer(query) {

    const normalized =
      String(query || '')
        .trim()
        .toLowerCase();


    const numericQuery =
      this.onlyNumbers(
        normalized
      );


    const resultsElement =
      document.getElementById(
        'producerSearchResults'
      );


    if (!normalized) {

      resultsElement.innerHTML = `
        <div class="empty-state">
          Digite um nome, CPF ou CNPJ.
        </div>
      `;

      return;
    }


    const producers =
      await dbGetAll(
        'produtores'
      );


    const results =
      producers
        .filter(item => {

          const name =
            String(
              item.Nome_Razao_Social ||
              ''
            )
              .toLowerCase();


          const documentNumber =
            this.onlyNumbers(
              item.CPF_CNPJ || ''
            );


          return (
            name.includes(normalized) ||
            (
              numericQuery &&
              documentNumber.includes(
                numericQuery
              )
            )
          );
        })
        .sort((a, b) =>
          String(
            a.Nome_Razao_Social
          ).localeCompare(
            String(
              b.Nome_Razao_Social
            ),
            'pt-BR'
          )
        );


    if (!results.length) {

      resultsElement.innerHTML = `
        <div class="empty-state">

          <strong>
            Nenhum produtor encontrado.
          </strong>

          <p>
            Se este produtor ainda não
            estiver cadastrado, utilize
            "Novo produtor".
          </p>

        </div>
      `;

      return;
    }


    resultsElement.innerHTML =
      results
        .map(item => `
          <button
            type="button"
            class="result-card"
            data-id="${this.escapeHTML(
              item.id
            )}"
          >

            <strong>
              ${this.escapeHTML(
                item.Nome_Razao_Social ||
                'Sem nome'
              )}
            </strong>

            <span>
              ${this.escapeHTML(
                this.formatCpfCnpj(
                  item.CPF_CNPJ || ''
                )
              )}
            </span>

            <small>
              ${
                item.syncStatus ===
                'SINCRONIZADO'
                  ? '✓ Sincronizado'
                  : '⏳ Aguardando sincronização'
              }
            </small>

          </button>
        `)
        .join('');


    resultsElement
      .querySelectorAll(
        '.result-card'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          async () => {

            const producer =
              await dbGet(
                'produtores',
                button.dataset.id
              );


            if (producer) {

              this.showProducerDetails(
                producer
              );
            }
          }
        );
      });
  },


  /* =======================================================
     FICHA DO PRODUTOR
  ======================================================= */

  async showProducerDetails(
    producer,
    continueFlow = false
  ) {

    this.currentProducer =
      producer;


    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );


    const properties =
      (
        await dbGetAll(
          'propriedades'
        )
      ).filter(item =>

        item.ID_Produtor_Local ===
        producer.id
      );


    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">

          <div>

            <h3>
              ${this.escapeHTML(
                producer.Nome_Razao_Social
              )}
            </h3>

            <p>
              ${this.escapeHTML(
                this.formatCpfCnpj(
                  producer.CPF_CNPJ
                )
              )}
            </p>

          </div>

          <span class="step-badge">
            ${
              producer.syncStatus ===
              'SINCRONIZADO'
                ? '✓ Sincronizado'
                : '⏳ Pendente'
            }
          </span>

        </div>


        <div class="summary-grid">

          <div>
            <small>Tipo</small>

            <strong>
              ${
                producer.Tipo_Pessoa ===
                'JURIDICA'
                  ? 'Pessoa jurídica'
                  : 'Pessoa física'
              }
            </strong>
          </div>


          <div>
            <small>Telefone</small>

            <strong>
              ${this.escapeHTML(
                producer.Telefone ||
                'Não informado'
              )}
            </strong>
          </div>


          <div>
            <small>E-mail</small>

            <strong>
              ${this.escapeHTML(
                producer.Email ||
                'Não informado'
              )}
            </strong>
          </div>


          <div>
            <small>Propriedades locais</small>

            <strong>
              ${properties.length}
            </strong>
          </div>

        </div>


        <div class="form-actions">

          <button
            id="editProducer"
            class="btn btn-secondary"
            type="button"
          >
            Editar produtor
          </button>

          <button
            id="newProperty"
            class="btn btn-primary"
            type="button"
          >
            ${
              continueFlow
                ? 'Continuar para propriedade →'
                : '+ Nova propriedade'
            }
          </button>

        </div>


        <div class="subsection">

          <h4>Propriedades</h4>

          ${
            properties.length
  ? properties
      .map(property => `
        <button
          type="button"
          class="mini-card property-card"
          data-property-id="${this.escapeHTML(
            property.id
          )}"
        >

          <strong>
            ${this.escapeHTML(
              property
                .Nome_Propriedade ||
              'Propriedade'
            )}
          </strong>

          <span>
            ${this.escapeHTML(
              property.Municipio ||
              'Município não informado'
            )}
          </span>

          <small>
            Abrir propriedade →
          </small>

        </button>
      `)
      .join('')

              : `
                <div class="empty-state">
                  Nenhuma propriedade
                  vinculada a este produtor
                  neste dispositivo.
                </div>
              `
          }

        </div>

      </div>
    `;


    document
      .getElementById(
        'editProducer'
      )
      .addEventListener(
        'click',
        () =>
          this.showProducerForm(
            producer
          )
      );


    document
  .getElementById(
    'newProperty'
  )
  .addEventListener(
    'click',
    () => this.showPropertyForm()
  );
document
  .querySelectorAll(
    '.property-card'
  )
  .forEach(button => {

    button.addEventListener(
      'click',
      async () => {

        const property =
          await dbGet(
            'propriedades',
            button.dataset.propertyId
          );

        if (!property) {

          App.showMessage(
            'Não foi possível localizar esta propriedade no banco local.',
            'warning'
          );

          return;
        }

        this.currentProperty =
          property;

        await this.showPropertyDetails(
          property
        );
      }
    );
  });
  },

   /* =======================================================
     CADASTRO DE PROPRIEDADE
  ======================================================= */

  showPropertyForm(existing = null) {

    if (!this.currentProducer) {

      App.showMessage(
        'Selecione um produtor antes de cadastrar a propriedade.',
        'warning'
      );

      return;
    }

    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );

    const property =
      existing || {};

    const municipalities =
      this.getAmazonasMunicipalities();

    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">

          <div>
            <h3>
              ${
                existing
                  ? 'Editar propriedade'
                  : 'Nova propriedade'
              }
            </h3>

            <p>
              Produtor:
              <strong>
                ${this.escapeHTML(
                  this.currentProducer
                    .Nome_Razao_Social || ''
                )}
              </strong>
            </p>
          </div>

          <span class="step-badge">
            Etapa 2 de 3
          </span>

        </div>


        <form id="propertyForm">

          <input
            type="hidden"
            id="propertyLocalId"
            value="${this.escapeHTML(
              property.id || ''
            )}"
          >


          <div class="form-grid">

            <div class="field field-wide">

              <label for="nomePropriedade">
                Nome da propriedade *
              </label>

              <input
                id="nomePropriedade"
                type="text"
                maxlength="200"
                required
                value="${this.escapeHTML(
                  property.Nome_Propriedade || ''
                )}"
              >

            </div>


            <div class="field">

              <label for="codigoPropriedade">
                Código oficial da propriedade
              </label>

              <input
                id="codigoPropriedade"
                type="text"
                maxlength="100"
                value="${this.escapeHTML(
                  property
                    .Codigo_Propriedade_Oficial ||
                  ''
                )}"
              >

              <small>
                Preencha somente quando houver
                código oficial.
              </small>

            </div>


            <div class="field">

              <label for="propriedadeComercial">
                Propriedade comercial? *
              </label>

              <select
                id="propriedadeComercial"
                required
              >

                <option value="">
                  Selecione
                </option>

                <option
                  value="SIM"
                  ${
                    property
                      .Propriedade_Comercial ===
                    'SIM'
                      ? 'selected'
                      : ''
                  }
                >
                  Sim
                </option>

                <option
                  value="NAO"
                  ${
                    property
                      .Propriedade_Comercial ===
                    'NAO'
                      ? 'selected'
                      : ''
                  }
                >
                  Não
                </option>

              </select>

            </div>


            <div
              class="field field-wide"
              id="nonCommercialWrapper"
              style="display:none"
            >

              <label for="tipoNaoComercial">
                Tipo de propriedade não comercial *
              </label>

              <input
                id="tipoNaoComercial"
                type="text"
                maxlength="150"
                placeholder="Ex.: quintal, área urbana, institucional..."
                value="${this.escapeHTML(
                  property
                    .Tipo_Propriedade_Nao_Comercial ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="situacaoFundiaria">
                Situação fundiária
              </label>

              <select id="situacaoFundiaria">

                <option value="">
                  Selecione
                </option>

                ${[
                  'PROPRIA',
                  'ARRENDADA',
                  'POSSE',
                  'CEDIDA',
                  'ASSENTAMENTO',
                  'OUTRA'
                ]
                  .map(value => {

                    const labels = {
                      PROPRIA: 'Própria',
                      ARRENDADA: 'Arrendada',
                      POSSE: 'Posse',
                      CEDIDA: 'Cedida',
                      ASSENTAMENTO: 'Assentamento',
                      OUTRA: 'Outra'
                    };

                    return `
                      <option
                        value="${value}"
                        ${
                          property
                            .Situacao_Fundiaria ===
                          value
                            ? 'selected'
                            : ''
                        }
                      >
                        ${labels[value]}
                      </option>
                    `;
                  })
                  .join('')}

              </select>

            </div>


            <div
              class="field"
              id="otherLandWrapper"
              style="display:none"
            >

              <label for="situacaoFundiariaOutra">
                Informe a situação fundiária
              </label>

              <input
                id="situacaoFundiariaOutra"
                type="text"
                maxlength="150"
                value="${this.escapeHTML(
                  property
                    .Situacao_Fundiaria_Outra ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="areaTotal">
                Área total (ha)
              </label>

              <input
                id="areaTotal"
                type="number"
                min="0"
                step="0.0001"
                inputmode="decimal"
                value="${this.escapeHTML(
                  property.Area_Total_ha || ''
                )}"
              >

            </div>


            <div class="field">

              <label for="areaAgricola">
                Área agrícola (ha)
              </label>

              <input
                id="areaAgricola"
                type="number"
                min="0"
                step="0.0001"
                inputmode="decimal"
                value="${this.escapeHTML(
                  property.Area_Agricola_ha || ''
                )}"
              >

            </div>


            <div class="field field-wide">

              <label for="viaAcesso">
                Via principal de acesso
              </label>

              <textarea
                id="viaAcesso"
                rows="2"
                maxlength="500"
                placeholder="Rodovia, ramal, rio, comunidade ou referências de acesso"
              >${this.escapeHTML(
                property.Via_Acesso || ''
              )}</textarea>

            </div>


            <div class="field field-wide">

              <label for="enderecoPropriedade">
                Endereço
              </label>

              <input
                id="enderecoPropriedade"
                type="text"
                maxlength="250"
                value="${this.escapeHTML(
                  property.Endereco || ''
                )}"
              >

            </div>


            <div class="field">

              <label for="localidade">
                Comunidade / Localidade
              </label>

              <input
                id="localidade"
                type="text"
                maxlength="200"
                value="${this.escapeHTML(
                  property
                    .Comunidade_Localidade ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="municipioPropriedade">
                Município *
              </label>

              <select
                id="municipioPropriedade"
                required
              >

                <option value="">
                  Selecione
                </option>

                ${municipalities
                  .map(name => `
                    <option
                      value="${this.escapeHTML(name)}"
                      ${
                        property.Municipio === name
                          ? 'selected'
                          : ''
                      }
                    >
                      ${this.escapeHTML(name)}
                    </option>
                  `)
                  .join('')}

              </select>

            </div>


            <div class="field">

              <label for="ufPropriedade">
                UF
              </label>

              <input
                id="ufPropriedade"
                type="text"
                value="AM"
                readonly
              >

            </div>


            <div class="field">

              <label for="latitudePropriedade">
                Latitude
              </label>

              <input
                id="latitudePropriedade"
                type="number"
                step="any"
                inputmode="decimal"
                placeholder="-3.123456"
                value="${this.escapeHTML(
                  property.Latitude || ''
                )}"
              >

            </div>


            <div class="field">

              <label for="longitudePropriedade">
                Longitude
              </label>

              <input
                id="longitudePropriedade"
                type="number"
                step="any"
                inputmode="decimal"
                placeholder="-60.123456"
                value="${this.escapeHTML(
                  property.Longitude || ''
                )}"
              >

            </div>


            <div class="field field-wide">

              <button
                id="capturePropertyGPS"
                class="btn btn-secondary"
                type="button"
              >
                📍 Capturar localização atual
              </button>

              <small id="gpsPropertyStatus">
                As coordenadas também podem ser
                digitadas manualmente.
              </small>

            </div>


            <div class="field field-wide">

              <label for="observacoesPropriedade">
                Observações
              </label>

              <textarea
                id="observacoesPropriedade"
                rows="4"
                maxlength="1500"
              >${this.escapeHTML(
                property.Observacoes || ''
              )}</textarea>

            </div>

          </div>


          <div class="form-actions">

            <button
              id="cancelProperty"
              class="btn btn-secondary"
              type="button"
            >
              ← Voltar ao produtor
            </button>

            <button
              class="btn btn-primary"
              type="submit"
            >
              Salvar e continuar →
            </button>

          </div>

        </form>

      </div>
    `;


    const commercialSelect =
      document.getElementById(
        'propriedadeComercial'
      );

    const nonCommercialWrapper =
      document.getElementById(
        'nonCommercialWrapper'
      );

    const nonCommercialInput =
      document.getElementById(
        'tipoNaoComercial'
      );


    const updateCommercialFields =
      () => {

        const visible =
          commercialSelect.value ===
          'NAO';

        nonCommercialWrapper.style.display =
          visible
            ? 'flex'
            : 'none';

        nonCommercialInput.required =
          visible;

        if (!visible) {
          nonCommercialInput.value = '';
        }
      };


    commercialSelect.addEventListener(
      'change',
      updateCommercialFields
    );

    updateCommercialFields();


    const landSelect =
      document.getElementById(
        'situacaoFundiaria'
      );

    const otherLandWrapper =
      document.getElementById(
        'otherLandWrapper'
      );

    const otherLandInput =
      document.getElementById(
        'situacaoFundiariaOutra'
      );


    const updateLandFields =
      () => {

        const visible =
          landSelect.value ===
          'OUTRA';

        otherLandWrapper.style.display =
          visible
            ? 'flex'
            : 'none';

        if (!visible) {
          otherLandInput.value = '';
        }
      };


    landSelect.addEventListener(
      'change',
      updateLandFields
    );

    updateLandFields();


    document
      .getElementById(
        'capturePropertyGPS'
      )
      .addEventListener(
        'click',
        () => this.capturePropertyGPS()
      );


    document
      .getElementById(
        'cancelProperty'
      )
      .addEventListener(
        'click',
        () =>
          this.showProducerDetails(
            this.currentProducer
          )
      );


    document
      .getElementById(
        'propertyForm'
      )
      .addEventListener(
        'submit',
        event =>
          this.saveProperty(event)
      );


    document
      .getElementById(
        'nomePropriedade'
      )
      .focus();
  },


  /* =======================================================
     GPS DA PROPRIEDADE
  ======================================================= */

  capturePropertyGPS() {

    const status =
      document.getElementById(
        'gpsPropertyStatus'
      );


    if (!navigator.geolocation) {

      status.textContent =
        'Este navegador não oferece suporte à localização.';

      App.showMessage(
        'Localização não suportada neste dispositivo.',
        'warning'
      );

      return;
    }


    status.textContent =
      'Obtendo coordenadas...';


    navigator.geolocation.getCurrentPosition(

      position => {

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;


        document
          .getElementById(
            'latitudePropriedade'
          )
          .value =
            latitude.toFixed(6);


        document
          .getElementById(
            'longitudePropriedade'
          )
          .value =
            longitude.toFixed(6);


        const accuracy =
          Math.round(
            position.coords.accuracy
          );


        status.textContent =
          `Localização capturada • precisão aproximada: ${accuracy} m`;


        App.showMessage(
          'Coordenadas capturadas.',
          'success'
        );
      },


      error => {

        let message =
          'Não foi possível obter a localização.';


        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {

          message =
            'A permissão de localização foi negada.';
        }


        if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {

          message =
            'A localização está indisponível neste momento.';
        }


        if (
          error.code ===
          error.TIMEOUT
        ) {

          message =
            'O dispositivo demorou demais para obter a localização.';
        }


        status.textContent =
          `${message} Você pode informar as coordenadas manualmente.`;


        App.showMessage(
          message,
          'warning'
        );
      },


      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000
      }
    );
  },


  /* =======================================================
     SALVAR PROPRIEDADE
  ======================================================= */

  async saveProperty(event) {

    event.preventDefault();


    if (!this.currentProducer) {

      App.showMessage(
        'Produtor não selecionado.',
        'error'
      );

      return;
    }


    const localId =
      document
        .getElementById(
          'propertyLocalId'
        )
        .value ||
      createUUID();


    const previous =
      await dbGet(
        'propriedades',
        localId
      );


    const areaTotalValue =
      document
        .getElementById(
          'areaTotal'
        )
        .value;


    const areaAgricolaValue =
      document
        .getElementById(
          'areaAgricola'
        )
        .value;


    const areaTotal =
      areaTotalValue === ''
        ? ''
        : Number(areaTotalValue);


    const areaAgricola =
      areaAgricolaValue === ''
        ? ''
        : Number(areaAgricolaValue);


    if (
      areaTotal !== '' &&
      areaAgricola !== '' &&
      areaAgricola > areaTotal
    ) {

      App.showMessage(
        'A área agrícola não pode ser maior que a área total da propriedade.',
        'warning'
      );

      return;
    }


    const latitude =
      document
        .getElementById(
          'latitudePropriedade'
        )
        .value;


    const longitude =
      document
        .getElementById(
          'longitudePropriedade'
        )
        .value;


    if (
      latitude !== '' &&
      (
        Number(latitude) < -90 ||
        Number(latitude) > 90
      )
    ) {

      App.showMessage(
        'Latitude inválida.',
        'warning'
      );

      return;
    }


    if (
      longitude !== '' &&
      (
        Number(longitude) < -180 ||
        Number(longitude) > 180
      )
    ) {

      App.showMessage(
        'Longitude inválida.',
        'warning'
      );

      return;
    }


    const commercial =
      document
        .getElementById(
          'propriedadeComercial'
        )
        .value;


    const landStatus =
      document
        .getElementById(
          'situacaoFundiaria'
        )
        .value;


    const record = {

      ...(previous || {}),

      id: localId,

      ID_Propriedade:
        previous?.ID_Propriedade ||
        '',

      /*
        Vínculo permanente local.

        Permite cadastrar a propriedade
        mesmo quando o produtor ainda
        não foi sincronizado.
      */
      ID_Produtor_Local:
        this.currentProducer.id,

      /*
        Quando a API fornecer o ID oficial
        do produtor, ele poderá ser enviado
        neste campo sem alterar o vínculo
        local.
      */
      ID_Produtor:
        this.currentProducer
          .ID_Produtor ||
        previous?.ID_Produtor ||
        '',

      Nome_Propriedade:
        document
          .getElementById(
            'nomePropriedade'
          )
          .value
          .trim(),

      Codigo_Propriedade_Oficial:
        document
          .getElementById(
            'codigoPropriedade'
          )
          .value
          .trim(),

      Propriedade_Comercial:
        commercial,

      Tipo_Propriedade_Nao_Comercial:
        commercial === 'NAO'
          ? document
              .getElementById(
                'tipoNaoComercial'
              )
              .value
              .trim()
          : '',

      Situacao_Fundiaria:
        landStatus,

      Situacao_Fundiaria_Outra:
        landStatus === 'OUTRA'
          ? document
              .getElementById(
                'situacaoFundiariaOutra'
              )
              .value
              .trim()
          : '',

      Area_Total_ha:
        areaTotal,

      Area_Agricola_ha:
        areaAgricola,

      Via_Acesso:
        document
          .getElementById(
            'viaAcesso'
          )
          .value
          .trim(),

      Endereco:
        document
          .getElementById(
            'enderecoPropriedade'
          )
          .value
          .trim(),

      Comunidade_Localidade:
        document
          .getElementById(
            'localidade'
          )
          .value
          .trim(),

      Municipio:
        document
          .getElementById(
            'municipioPropriedade'
          )
          .value,

      UF:
        'AM',

      Latitude:
        latitude === ''
          ? ''
          : Number(latitude),

      Longitude:
        longitude === ''
          ? ''
          : Number(longitude),

      Observacoes:
        document
          .getElementById(
            'observacoesPropriedade'
          )
          .value
          .trim(),

      Status:
        previous?.Status ||
        'ATIVO',

      Data_Cadastro:
        previous?.Data_Cadastro ||
        new Date().toISOString(),

      Data_Atualizacao:
        new Date().toISOString(),

      ID_Servidor_Cadastro:
        previous?.ID_Servidor_Cadastro ||
        ''
    };


    const saved =
      await saveLocalRecord(
        'propriedades',
        record,
        {
          operation:
            previous
              ? 'UPDATE'
              : 'CREATE',

          dependsOn: [
            {
              entity: 'produtores',
              recordId:
                this.currentProducer.id
            }
          ]
        }
      );


    this.currentProperty =
      saved;


    App.showMessage(
      navigator.onLine
        ? 'Propriedade salva. O registro aguardará sincronização com a base central.'
        : 'Propriedade salva neste dispositivo. Será sincronizada quando houver internet.',
      'success'
    );


    await App.updateSyncStatus();


    this.showPropertyDetails(
      saved,
      true
    );
  },


  /* =======================================================
     FICHA DA PROPRIEDADE
  ======================================================= */

  async showPropertyDetails(
    property,
    continueFlow = false
  ) {

    this.currentProperty =
      property;


    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );


    const cultures =
      (
        await dbGetAll(
          'culturas'
        )
      ).filter(item =>

        item.ID_Propriedade_Local ===
        property.id
      );


    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">

          <div>

            <h3>
              ${this.escapeHTML(
                property.Nome_Propriedade
              )}
            </h3>

            <p>
              ${this.escapeHTML(
                property.Municipio || ''
              )} - AM
            </p>

          </div>

          <span class="step-badge">
            ${
              property.syncStatus ===
              'SINCRONIZADO'
                ? '✓ Sincronizada'
                : '⏳ Pendente'
            }
          </span>

        </div>


        <div class="summary-grid">

          <div>
            <small>Produtor</small>

            <strong>
              ${this.escapeHTML(
                this.currentProducer
                  ?.Nome_Razao_Social ||
                'Não informado'
              )}
            </strong>
          </div>


          <div>
            <small>Município</small>

            <strong>
              ${this.escapeHTML(
                property.Municipio ||
                'Não informado'
              )}
            </strong>
          </div>


          <div>
            <small>Área total</small>

            <strong>
              ${
                property.Area_Total_ha !== ''
                  ? `${this.escapeHTML(
                      property.Area_Total_ha
                    )} ha`
                  : 'Não informada'
              }
            </strong>
          </div>


          <div>
            <small>Culturas cadastradas</small>

            <strong>
              ${cultures.length}
            </strong>
          </div>

        </div>


        <div class="form-actions">

          <button
            id="backToProducer"
            class="btn btn-secondary"
            type="button"
          >
            ← Produtor
          </button>


          <button
            id="editProperty"
            class="btn btn-secondary"
            type="button"
          >
            Editar propriedade
          </button>


          <button
            id="newCulture"
            class="btn btn-primary"
            type="button"
          >
            ${
              continueFlow
                ? 'Continuar para cultura →'
                : '+ Adicionar cultura'
            }
          </button>

        </div>


        <div class="subsection">

          <h4>Culturas</h4>

          ${
            cultures.length

              ? cultures
                  .map(culture => `
                    <div class="mini-card">

                      <strong>
                        ${
                          this.escapeHTML(
                            culture
                              .Nome_Cultura_Local ||
                            culture
                              .ID_Tipo_Cultura ||
                            'Cultura'
                          )
                        }
                      </strong>

                      <span>
                        ${
                          culture
                            .Area_Plantada_ha !==
                          ''
                            ? `${this.escapeHTML(
                                culture
                                  .Area_Plantada_ha
                              )} ha`
                            : 'Área não informada'
                        }
                      </span>

                    </div>
                  `)
                  .join('')

              : `
                <div class="empty-state">
                  Nenhuma cultura cadastrada
                  nesta propriedade.
                </div>
              `
          }

        </div>
cultures.length

  ? cultures
      .map(culture => {

        const cultureName =
          culture.Nome_Cultura_Local ||
          culture.ID_Tipo_Cultura ||
          'Cultura';

        const isActive =
          culture.Status !== 'INATIVO';

        const areaPlantada =
          culture.Area_Plantada_ha !== '' &&
          culture.Area_Plantada_ha != null
            ? `${this.escapeHTML(
                culture.Area_Plantada_ha
              )} ha`
            : 'Não informada';

        const areaProducao =
          culture.Area_Producao_ha !== '' &&
          culture.Area_Producao_ha != null
            ? `${this.escapeHTML(
                culture.Area_Producao_ha
              )} ha`
            : 'Não informada';

        const cultivar =
          culture.Cultivar_Variedade ||
          'Não informada';

        const idade =
          culture.Idade_Plantio ||
          'Não informada';

        const plantas =
          culture.Quantidade_Plantas ||
          'Não informada';

        const producao =
          culture.Producao_Estimada !== '' &&
          culture.Producao_Estimada != null
            ? `${
                this.escapeHTML(
                  culture.Producao_Estimada
                )
              } ${
                this.escapeHTML(
                  culture.Unidade_Producao || ''
                )
              }`.trim()
            : 'Não informada';

        return `
          <div
            class="mini-card culture-card"
            data-culture-id="${this.escapeHTML(
              culture.id
            )}"
          >

            <div class="culture-card-header">

              <div>
                <strong>
                  ${this.escapeHTML(
                    cultureName
                  )}
                </strong>

                <span class="culture-status">
                  ${
                    isActive
                      ? '● Ativa'
                      : '○ Inativa'
                  }
                </span>
              </div>

            </div>


            <div class="culture-info-grid">

              <div>
                <small>Cultivar/variedade</small>
                <strong>
                  ${this.escapeHTML(cultivar)}
                </strong>
              </div>

              <div>
                <small>Área plantada</small>
                <strong>${areaPlantada}</strong>
              </div>

              <div>
                <small>Área em produção</small>
                <strong>${areaProducao}</strong>
              </div>

              <div>
                <small>Idade do plantio</small>
                <strong>
                  ${this.escapeHTML(idade)}
                </strong>
              </div>

              <div>
                <small>Quantidade de plantas</small>
                <strong>
                  ${this.escapeHTML(plantas)}
                </strong>
              </div>

              <div>
                <small>Produção estimada</small>
                <strong>${producao}</strong>
              </div>

            </div>


            <div class="culture-card-actions">

              <button
                type="button"
                class="btn btn-secondary culture-details-btn"
                data-culture-id="${this.escapeHTML(
                  culture.id
                )}"
              >
                Ver detalhes
              </button>

              <button
                type="button"
                class="btn btn-secondary culture-edit-btn"
                data-culture-id="${this.escapeHTML(
                  culture.id
                )}"
              >
                Editar
              </button>

              <button
                type="button"
                class="btn btn-secondary culture-status-btn"
                data-culture-id="${this.escapeHTML(
                  culture.id
                )}"
              >
                ${
                  isActive
                    ? 'Cancelar cultura'
                    : 'Reativar'
                }
              </button>

            </div>

          </div>
        `;
      })
      .join('')

  : `
      <div class="empty-state">
        Nenhuma cultura cadastrada
        nesta propriedade.
      </div>
    `
      </div>
    `;


    document
      .getElementById(
        'backToProducer'
      )
      .addEventListener(
        'click',
        () =>
          this.showProducerDetails(
            this.currentProducer
          )
      );


    document
      .getElementById(
        'editProperty'
      )
      .addEventListener(
        'click',
        () =>
          this.showPropertyForm(
            property
          )
      );


    document
  .getElementById(
    'newCulture'
  )
  .addEventListener(
    'click',
    () => this.showCultureForm()
  );
document
  .querySelectorAll('.culture-details-btn')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const culture = await dbGet(
        'culturas',
        button.dataset.cultureId
      );

      if (!culture) {
        App.showMessage(
          'Cultura não encontrada.',
          'warning'
        );
        return;
      }

      this.showCultureDetails(culture);
    });
  });

document
  .querySelectorAll('.culture-edit-btn')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const culture = await dbGet(
        'culturas',
        button.dataset.cultureId
      );

      if (!culture) {
        App.showMessage(
          'Cultura não encontrada.',
          'warning'
        );
        return;
      }

      this.showCultureForm(culture);
    });
  });

document
  .querySelectorAll('.culture-status-btn')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const culture = await dbGet(
        'culturas',
        button.dataset.cultureId
      );

      if (!culture) {
        App.showMessage(
          'Cultura não encontrada.',
          'warning'
        );
        return;
      }

      await this.toggleCultureStatus(culture);
    });
  });
  },
/* =========================================================
   DETALHES DA CULTURA
========================================================= */

showCultureDetails(culture) {

  if (!culture) return;

  const workspace =
    document.getElementById('cadastroWorkspace');

  const cultureName =
    culture.Nome_Cultura_Local ||
    culture.ID_Tipo_Cultura ||
    'Cultura';

  const valueOrNotInformed = value =>
    value !== undefined &&
    value !== null &&
    value !== ''
      ? this.escapeHTML(String(value))
      : 'Não informado';

  const areaValue = value =>
    value !== undefined &&
    value !== null &&
    value !== ''
      ? `${this.escapeHTML(String(value))} ha`
      : 'Não informada';

  const production =
    culture.Producao_Estimada !== undefined &&
    culture.Producao_Estimada !== null &&
    culture.Producao_Estimada !== ''
      ? `${this.escapeHTML(
          String(culture.Producao_Estimada)
        )} ${this.escapeHTML(
          culture.Unidade_Producao || ''
        )}`.trim()
      : 'Não informada';

  const isActive =
    culture.Status !== 'INATIVO';

  workspace.innerHTML = `
    <div class="form-card">

      <div class="form-heading">

        <div>
          <h3>
            ${this.escapeHTML(cultureName)}
          </h3>

          <p>
            Detalhes da cultura cadastrada
          </p>
        </div>

        <span class="badge">
          ${
            isActive
              ? '● Ativa'
              : '○ Inativa'
          }
        </span>

      </div>

      <div class="summary-grid">

        <div>
          <small>Cultivar / variedade</small>
          <strong>
            ${valueOrNotInformed(
              culture.Cultivar_Variedade
            )}
          </strong>
        </div>

        <div>
          <small>Área plantada</small>
          <strong>
            ${areaValue(
              culture.Area_Plantada_ha
            )}
          </strong>
        </div>

        <div>
          <small>Área em produção</small>
          <strong>
            ${areaValue(
              culture.Area_Producao_ha
            )}
          </strong>
        </div>

        <div>
          <small>Idade do plantio</small>
          <strong>
            ${valueOrNotInformed(
              culture.Idade_Plantio
            )}
          </strong>
        </div>

        <div>
          <small>Quantidade de plantas</small>
          <strong>
            ${valueOrNotInformed(
              culture.Quantidade_Plantas
            )}
          </strong>
        </div>

        <div>
          <small>Espaçamento</small>
          <strong>
            ${valueOrNotInformed(
              culture.Espacamento
            )}
          </strong>
        </div>

        <div>
          <small>Produção estimada</small>
          <strong>${production}</strong>
        </div>

        <div>
          <small>Destino da produção</small>
          <strong>
            ${valueOrNotInformed(
              culture.Destino_Producao
            )}
          </strong>
        </div>

        <div>
          <small>Origem do material</small>
          <strong>
            ${valueOrNotInformed(
              culture.Origem_Material_Propagacao
            )}
          </strong>
        </div>

        <div>
          <small>Fonte do material</small>
          <strong>
            ${valueOrNotInformed(
              culture.Fonte_Material_Propagacao
            )}
          </strong>
        </div>

      </div>

      ${
        culture.Observacoes
          ? `
            <div class="subsection">
              <h4>Observações</h4>
              <p>
                ${this.escapeHTML(
                  culture.Observacoes
                )}
              </p>
            </div>
          `
          : ''
      }

      <div class="form-actions">

        <button
          id="backCultureDetails"
          type="button"
          class="btn btn-secondary"
        >
          ← Voltar
        </button>

        <button
          id="editCultureDetails"
          type="button"
          class="btn btn-secondary"
        >
          Editar cultura
        </button>

        <button
          id="toggleCultureDetails"
          type="button"
          class="btn btn-primary"
        >
          ${
            isActive
              ? 'Cancelar cultura'
              : 'Reativar cultura'
          }
        </button>

      </div>

    </div>
  `;

  document
    .getElementById('backCultureDetails')
    .addEventListener(
      'click',
      () =>
        this.showPropertyDetails(
          this.currentProperty
        )
    );

  document
    .getElementById('editCultureDetails')
    .addEventListener(
      'click',
      () => this.showCultureForm(culture)
    );

  document
    .getElementById('toggleCultureDetails')
    .addEventListener(
      'click',
      async () => {
        await this.toggleCultureStatus(
          culture
        );
      }
    );
},


/* =========================================================
   CANCELAR / REATIVAR CULTURA
========================================================= */

async toggleCultureStatus(culture) {

  if (!culture || !culture.id) {
    App.showMessage(
      'Cultura não encontrada.',
      'warning'
    );
    return;
  }

  const isActive =
    culture.Status !== 'INATIVO';

  const action =
    isActive
      ? 'cancelar'
      : 'reativar';

  const cultureName =
    culture.Nome_Cultura_Local ||
    culture.ID_Tipo_Cultura ||
    'esta cultura';

  const confirmed = window.confirm(
    isActive
      ? `Deseja realmente cancelar ${cultureName}? O histórico será preservado.`
      : `Deseja reativar ${cultureName}?`
  );

  if (!confirmed) return;

  try {

    const updated = {
      ...culture,

      Status:
        isActive
          ? 'INATIVO'
          : 'ATIVO',

      Data_Atualizacao:
        new Date().toISOString()
    };

    await saveLocalRecord(
      'culturas',
      updated,
      {
        operation: 'UPDATE'
      }
    );

    await App.updateSyncStatus();

    App.showMessage(
      isActive
        ? 'Cultura cancelada. O histórico foi preservado.'
        : 'Cultura reativada com sucesso.',
      'success'
    );

    await this.showPropertyDetails(
      this.currentProperty
    );

  } catch (error) {

    console.error(
      `Erro ao ${action} cultura:`,
      error
    );

    App.showMessage(
      `Não foi possível ${action} a cultura.`,
      'error'
    );
  }
},
  /* =======================================================
     CADASTRO DE CULTURA
  ======================================================= */

  showCultureForm(existing = null) {

    if (!this.currentProperty) {

      App.showMessage(
        'Selecione uma propriedade antes de cadastrar a cultura.',
        'warning'
      );

      return;
    }

    const workspace =
      document.getElementById(
        'cadastroWorkspace'
      );

    const culture =
      existing || {};

    const cultureCatalog =
      this.getInitialCultureCatalog();

    workspace.innerHTML = `
      <div class="form-card">

        <div class="form-heading">

          <div>

            <h3>
              ${
                existing
                  ? 'Editar cultura'
                  : 'Nova cultura'
              }
            </h3>

            <p>
              Propriedade:
              <strong>
                ${this.escapeHTML(
                  this.currentProperty
                    .Nome_Propriedade || ''
                )}
              </strong>
            </p>

          </div>

          <span class="step-badge">
            Etapa 3 de 3
          </span>

        </div>


        <form id="cultureForm">

          <input
            type="hidden"
            id="cultureLocalId"
            value="${this.escapeHTML(
              culture.id || ''
            )}"
          >


          <div class="form-grid">

            <div class="field field-wide">

              <label for="tipoCultura">
                Cultura *
              </label>

              <select
                id="tipoCultura"
                required
              >

                <option value="">
                  Selecione
                </option>

                ${cultureCatalog
                  .map(item => `
                    <option
                      value="${item.id}"
                      ${
                        culture.ID_Tipo_Cultura ===
                        item.id
                          ? 'selected'
                          : ''
                      }
                    >
                      ${this.escapeHTML(
                        item.nome
                      )}
                    </option>
                  `)
                  .join('')}

              </select>

            </div>


            <div class="field field-wide">

              <label for="cultivarVariedade">
                Cultivar / Variedade
              </label>

              <input
                id="cultivarVariedade"
                type="text"
                maxlength="200"
                placeholder="Informe quando aplicável"
                value="${this.escapeHTML(
                  culture
                    .Cultivar_Variedade ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="areaPlantada">
                Área plantada (ha)
              </label>

              <input
                id="areaPlantada"
                type="number"
                min="0"
                step="0.0001"
                inputmode="decimal"
                value="${this.escapeHTML(
                  culture
                    .Area_Plantada_ha ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="areaProducao">
                Área em produção (ha)
              </label>

              <input
                id="areaProducao"
                type="number"
                min="0"
                step="0.0001"
                inputmode="decimal"
                value="${this.escapeHTML(
                  culture
                    .Area_Producao_ha ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="idadePlantio">
                Idade do plantio
              </label>

              <input
                id="idadePlantio"
                type="text"
                maxlength="100"
                placeholder="Ex.: 3 anos, 18 meses"
                value="${this.escapeHTML(
                  culture.Idade_Plantio ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="quantidadePlantas">
                Quantidade de plantas
              </label>

              <input
                id="quantidadePlantas"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                value="${this.escapeHTML(
                  culture
                    .Quantidade_Plantas ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="espacamentoCultura">
                Espaçamento
              </label>

              <input
                id="espacamentoCultura"
                type="text"
                maxlength="100"
                placeholder="Ex.: 3 x 3 m"
                value="${this.escapeHTML(
                  culture.Espacamento ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="producaoEstimada">
                Produção estimada
              </label>

              <input
                id="producaoEstimada"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                value="${this.escapeHTML(
                  culture
                    .Producao_Estimada ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="unidadeProducao">
                Unidade da produção
              </label>

              <select id="unidadeProducao">

                <option value="">
                  Selecione
                </option>

                ${[
                  ['KG_ANO', 'kg/ano'],
                  ['TON_ANO', 't/ano'],
                  ['SACAS_ANO', 'sacas/ano'],
                  ['FRUTOS_ANO', 'frutos/ano'],
                  ['UNIDADES_ANO', 'unidades/ano'],
                  ['OUTRA', 'Outra']
                ]
                  .map(([value, label]) => `
                    <option
                      value="${value}"
                      ${
                        culture
                          .Unidade_Producao ===
                        value
                          ? 'selected'
                          : ''
                      }
                    >
                      ${label}
                    </option>
                  `)
                  .join('')}

              </select>

            </div>


            <div class="field field-wide">

              <label for="destinoProducao">
                Destino da produção
              </label>

              <input
                id="destinoProducao"
                type="text"
                maxlength="300"
                placeholder="Ex.: mercado local, outro município, outro estado..."
                value="${this.escapeHTML(
                  culture
                    .Destino_Producao ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label for="origemMaterial">
                Origem do material de propagação
              </label>

              <select id="origemMaterial">

                <option value="">
                  Selecione
                </option>

                <option
                  value="PROPRIO"
                  ${
                    culture
                      .Origem_Material_Propagacao ===
                    'PROPRIO'
                      ? 'selected'
                      : ''
                  }
                >
                  Próprio
                </option>

                <option
                  value="TERCEIROS"
                  ${
                    culture
                      .Origem_Material_Propagacao ===
                    'TERCEIROS'
                      ? 'selected'
                      : ''
                  }
                >
                  Terceiros
                </option>

                <option
                  value="OUTRA"
                  ${
                    culture
                      .Origem_Material_Propagacao ===
                    'OUTRA'
                      ? 'selected'
                      : ''
                  }
                >
                  Outra
                </option>

              </select>

            </div>


            <div class="field">

              <label for="fonteMaterial">
                Fonte / procedência do material
              </label>

              <input
                id="fonteMaterial"
                type="text"
                maxlength="300"
                value="${this.escapeHTML(
                  culture
                    .Fonte_Material_Propagacao ||
                  ''
                )}"
              >

            </div>


            <div class="field field-wide">

              <label for="observacaoFenologica">
                Observação fenológica no cadastro
              </label>

              <textarea
                id="observacaoFenologica"
                rows="3"
                maxlength="500"
              >${this.escapeHTML(
                culture
                  .Observacao_Fenologica_Cadastro ||
                ''
              )}</textarea>

            </div>


            <div class="field field-wide">

              <label for="observacoesCultura">
                Observações
              </label>

              <textarea
                id="observacoesCultura"
                rows="4"
                maxlength="1500"
              >${this.escapeHTML(
                culture.Observacoes ||
                ''
              )}</textarea>

            </div>

          </div>


          <div
            id="specificCultureNotice"
            class="subsection"
            style="display:none"
          ></div>


          <div class="form-actions">

            <button
              id="cancelCulture"
              class="btn btn-secondary"
              type="button"
            >
              ← Voltar à propriedade
            </button>


            <button
              class="btn btn-primary"
              type="submit"
            >
              Salvar cultura
            </button>

          </div>

        </form>

      </div>
    `;


    const typeSelect =
      document.getElementById(
        'tipoCultura'
      );


    typeSelect.addEventListener(
      'change',
      () =>
        this.updateCultureSpecificNotice(
          typeSelect.value
        )
    );


    this.updateCultureSpecificNotice(
      typeSelect.value
    );


    document
      .getElementById(
        'cancelCulture'
      )
      .addEventListener(
        'click',
        () =>
          this.showPropertyDetails(
            this.currentProperty
          )
      );


    document
      .getElementById(
        'cultureForm'
      )
      .addEventListener(
        'submit',
        event =>
          this.saveCulture(event)
      );


    typeSelect.focus();
  },


  /* =======================================================
     CATÁLOGO INICIAL DE CULTURAS

     Este catálogo fica dentro da aplicação para permitir
     o cadastro mesmo sem internet.

     Posteriormente será atualizado pela API.
  ======================================================= */

  getInitialCultureCatalog() {

    return [

      {
        id: 'CUL001',
        nome: 'Mandioca'
      },

      {
        id: 'CUL002',
        nome: 'Cacau'
      },

      {
        id: 'CUL003',
        nome: 'Cupuaçu'
      },

      {
        id: 'CUL004',
        nome: 'Banana'
      },

      {
        id: 'CUL005',
        nome: 'Soja'
      },

      {
        id: 'CUL006',
        nome: 'Laranja'
      },

      {
        id: 'CUL007',
        nome: 'Limão'
      },

      {
        id: 'CUL008',
        nome: 'Tangerina'
      }

    ];
  },


  /* =======================================================
     AVISO DOS CAMPOS ESPECÍFICOS
  ======================================================= */

  updateCultureSpecificNotice(
    cultureId
  ) {

    const element =
      document.getElementById(
        'specificCultureNotice'
      );


    if (!element) {
      return;
    }


    if (!cultureId) {

      element.style.display =
        'none';

      element.innerHTML = '';

      return;
    }


    const catalog =
      this.getInitialCultureCatalog();


    const selected =
      catalog.find(
        item =>
          item.id === cultureId
      );


    if (!selected) {

      element.style.display =
        'none';

      return;
    }


    element.style.display =
      'block';


    element.innerHTML = `
      <h4>
        Dados específicos —
        ${this.escapeHTML(
          selected.nome
        )}
      </h4>

      <div class="empty-state">
        Os dados gerais desta cultura
        serão salvos agora.

        Os campos específicos de
        ${this.escapeHTML(
          selected.nome
        )}
        serão carregados nesta área
        na próxima etapa de configuração.
      </div>
    `;
  },


  /* =======================================================
     SALVAR CULTURA
  ======================================================= */

  async saveCulture(event) {

    event.preventDefault();


    if (!this.currentProperty) {

      App.showMessage(
        'Propriedade não selecionada.',
        'error'
      );

      return;
    }


    const localId =
      document
        .getElementById(
          'cultureLocalId'
        )
        .value ||
      createUUID();


    const previous =
      await dbGet(
        'culturas',
        localId
      );


    const cultureId =
      document
        .getElementById(
          'tipoCultura'
        )
        .value;


    const catalog =
      this.getInitialCultureCatalog();


    const cultureDefinition =
      catalog.find(
        item =>
          item.id === cultureId
      );


    if (!cultureDefinition) {

      App.showMessage(
        'Selecione uma cultura.',
        'warning'
      );

      return;
    }


    const areaPlantadaValue =
      document
        .getElementById(
          'areaPlantada'
        )
        .value;


    const areaProducaoValue =
      document
        .getElementById(
          'areaProducao'
        )
        .value;


    const areaPlantada =
      areaPlantadaValue === ''
        ? ''
        : Number(
            areaPlantadaValue
          );


    const areaProducao =
      areaProducaoValue === ''
        ? ''
        : Number(
            areaProducaoValue
          );


    if (
      areaPlantada !== '' &&
      areaProducao !== '' &&
      areaProducao >
        areaPlantada
    ) {

      App.showMessage(
        'A área em produção não pode ser maior que a área plantada.',
        'warning'
      );

      return;
    }


    const quantityValue =
      document
        .getElementById(
          'quantidadePlantas'
        )
        .value;


    const productionValue =
      document
        .getElementById(
          'producaoEstimada'
        )
        .value;


    const record = {

      ...(previous || {}),

      id:
        localId,

      ID_Cultura:
        previous?.ID_Cultura ||
        '',


      /*
        Vínculo local permanente.
      */
      ID_Propriedade_Local:
        this.currentProperty.id,


      /*
        Será preenchido com o ID oficial
        quando a propriedade estiver
        sincronizada.
      */
      ID_Propriedade:
        this.currentProperty
          .ID_Propriedade ||
        previous?.ID_Propriedade ||
        '',


      ID_Tipo_Cultura:
        cultureId,


      /*
        Campo somente local para facilitar
        a interface enquanto os catálogos
        centrais ainda não foram sincronizados.
      */
      Nome_Cultura_Local:
        cultureDefinition.nome,


      Cultivar_Variedade:
        document
          .getElementById(
            'cultivarVariedade'
          )
          .value
          .trim(),


      Area_Plantada_ha:
        areaPlantada,


      Area_Producao_ha:
        areaProducao,


      Idade_Plantio:
        document
          .getElementById(
            'idadePlantio'
          )
          .value
          .trim(),


      Quantidade_Plantas:
        quantityValue === ''
          ? ''
          : Number(
              quantityValue
            ),


      Espacamento:
        document
          .getElementById(
            'espacamentoCultura'
          )
          .value
          .trim(),


      Producao_Estimada:
        productionValue === ''
          ? ''
          : Number(
              productionValue
            ),


      Unidade_Producao:
        document
          .getElementById(
            'unidadeProducao'
          )
          .value,


      Destino_Producao:
        document
          .getElementById(
            'destinoProducao'
          )
          .value
          .trim(),


      Origem_Material_Propagacao:
        document
          .getElementById(
            'origemMaterial'
          )
          .value,


      Fonte_Material_Propagacao:
        document
          .getElementById(
            'fonteMaterial'
          )
          .value
          .trim(),


      Observacao_Fenologica_Cadastro:
        document
          .getElementById(
            'observacaoFenologica'
          )
          .value
          .trim(),


      Status:
        previous?.Status ||
        'ATIVO',


      Data_Cadastro:
        previous?.Data_Cadastro ||
        new Date().toISOString(),


      Data_Atualizacao:
        new Date().toISOString(),


      ID_Servidor_Cadastro:
        previous
          ?.ID_Servidor_Cadastro ||
        '',


      Observacoes:
        document
          .getElementById(
            'observacoesCultura'
          )
          .value
          .trim()
    };


    const saved =
      await saveLocalRecord(
        'culturas',
        record,
        {

          operation:
            previous
              ? 'UPDATE'
              : 'CREATE',

          dependsOn: [
            {
              entity:
                'propriedades',

              recordId:
                this.currentProperty.id
            }
          ]
        }
      );


    App.showMessage(
      navigator.onLine
        ? `${cultureDefinition.nome} salva. O registro aguardará sincronização.`
        : `${cultureDefinition.nome} salva neste dispositivo e será sincronizada quando houver internet.`,
      'success'
    );


    await App.updateSyncStatus();


    await this.showPropertyDetails(
      this.currentProperty
    );
  },
/* =======================================================
   BUSCAR PROPRIEDADE
======================================================= */

async showPropertySearch() {

  const workspace =
    document.getElementById(
      'cadastroWorkspace'
    );

  workspace.innerHTML = `
    <div class="form-card">

      <div class="form-heading">

        <div>
          <h3>Buscar propriedade</h3>

          <p>
            Pesquise por nome da propriedade,
            produtor, CPF/CNPJ, município
            ou código oficial.
          </p>
        </div>

      </div>


      <div class="search-row">

        <input
          id="propertySearch"
          type="search"
          placeholder="Nome, produtor, CPF/CNPJ, município ou código"
          autocomplete="off"
        >

        <button
          id="runPropertySearch"
          class="btn btn-primary"
          type="button"
        >
          Buscar
        </button>

      </div>


      <div
        id="propertySearchResults"
        class="search-results"
      ></div>

    </div>
  `;


  const input =
    document.getElementById(
      'propertySearch'
    );


  const runSearch =
    async () => {

      const query =
        String(input.value || '')
          .trim()
          .toLowerCase();


      const numericQuery =
        this.onlyNumbers(query);


      const resultsElement =
        document.getElementById(
          'propertySearchResults'
        );


      if (!query) {

        resultsElement.innerHTML = `
          <div class="empty-state">
            Digite alguma informação
            da propriedade.
          </div>
        `;

        return;
      }


      const properties =
        await dbGetAll(
          'propriedades'
        );


      const producers =
        await dbGetAll(
          'produtores'
        );


      const producerMap =
        new Map(
          producers.map(
            producer => [
              producer.id,
              producer
            ]
          )
        );


      const results =
        properties
          .map(property => {

            const producer =
              producerMap.get(
                property.ID_Produtor_Local
              ) || null;


            return {
              property,
              producer
            };
          })
          .filter(item => {

            const property =
              item.property;


            const producer =
              item.producer;


            const propertyName =
              String(
                property
                  .Nome_Propriedade ||
                ''
              ).toLowerCase();


            const municipality =
              String(
                property.Municipio ||
                ''
              ).toLowerCase();


            const officialCode =
              String(
                property
                  .Codigo_Propriedade_Oficial ||
                ''
              ).toLowerCase();


            const producerName =
              String(
                producer
                  ?.Nome_Razao_Social ||
                ''
              ).toLowerCase();


            const producerDocument =
              this.onlyNumbers(
                producer?.CPF_CNPJ ||
                ''
              );


            return (
              propertyName.includes(query) ||
              municipality.includes(query) ||
              officialCode.includes(query) ||
              producerName.includes(query) ||
              (
                numericQuery &&
                producerDocument.includes(
                  numericQuery
                )
              )
            );
          })
          .sort(
            (a, b) =>
              String(
                a.property
                  .Nome_Propriedade ||
                ''
              ).localeCompare(
                String(
                  b.property
                    .Nome_Propriedade ||
                  ''
                ),
                'pt-BR'
              )
          );


      if (!results.length) {

        resultsElement.innerHTML = `
          <div class="empty-state">

            <strong>
              Nenhuma propriedade encontrada.
            </strong>

            <p>
              A pesquisa atual consulta
              os registros armazenados
              neste dispositivo.
            </p>

          </div>
        `;

        return;
      }


      resultsElement.innerHTML =
        results
          .map(item => {

            const property =
              item.property;


            const producer =
              item.producer;


            return `
              <button
                type="button"
                class="result-card property-search-result"
                data-property-id="${this.escapeHTML(
                  property.id
                )}"
              >

                <strong>
                  ${this.escapeHTML(
                    property
                      .Nome_Propriedade ||
                    'Propriedade sem nome'
                  )}
                </strong>


                <span>
                  ${
                    producer
                      ? this.escapeHTML(
                          producer
                            .Nome_Razao_Social ||
                          'Produtor não informado'
                        )
                      : 'Produtor não localizado'
                  }
                </span>


                <small>
                  ${this.escapeHTML(
                    property.Municipio ||
                    'Município não informado'
                  )} - AM
                  •
                  ${
                    property.syncStatus ===
                    'SINCRONIZADO'
                      ? '✓ Sincronizada'
                      : '⏳ Pendente'
                  }
                </small>


                <small>
                  Abrir propriedade →
                </small>

              </button>
            `;
          })
          .join('');


      resultsElement
        .querySelectorAll(
          '.property-search-result'
        )
        .forEach(button => {

          button.addEventListener(
            'click',
            async () => {

              const property =
                await dbGet(
                  'propriedades',
                  button.dataset
                    .propertyId
                );


              if (!property) {

                App.showMessage(
                  'Propriedade não localizada.',
                  'warning'
                );

                return;
              }


              const producer =
                producerMap.get(
                  property
                    .ID_Produtor_Local
                );


              if (!producer) {

                App.showMessage(
                  'O produtor vinculado a esta propriedade não foi localizado neste dispositivo.',
                  'warning'
                );

                return;
              }


              this.currentProducer =
                producer;


              this.currentProperty =
                property;


              await this.showPropertyDetails(
                property
              );
            }
          );
        });
    };


  document
    .getElementById(
      'runPropertySearch'
    )
    .addEventListener(
      'click',
      runSearch
    );


  input.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {

        event.preventDefault();

        runSearch();
      }
    }
  );


  input.focus();
},
  /* =======================================================
     MUNICÍPIOS DO AMAZONAS
  ======================================================= */

  getAmazonasMunicipalities() {

    return [
      'Alvarães',
      'Amaturá',
      'Anamã',
      'Anori',
      'Apuí',
      'Atalaia do Norte',
      'Autazes',
      'Barcelos',
      'Barreirinha',
      'Benjamin Constant',
      'Beruri',
      'Boa Vista do Ramos',
      'Boca do Acre',
      'Borba',
      'Caapiranga',
      'Canutama',
      'Carauari',
      'Careiro',
      'Careiro da Várzea',
      'Coari',
      'Codajás',
      'Eirunepé',
      'Envira',
      'Fonte Boa',
      'Guajará',
      'Humaitá',
      'Ipixuna',
      'Iranduba',
      'Itacoatiara',
      'Itamarati',
      'Itapiranga',
      'Japurá',
      'Juruá',
      'Jutaí',
      'Lábrea',
      'Manacapuru',
      'Manaquiri',
      'Manaus',
      'Manicoré',
      'Maraã',
      'Maués',
      'Nhamundá',
      'Nova Olinda do Norte',
      'Novo Airão',
      'Novo Aripuanã',
      'Parintins',
      'Pauini',
      'Presidente Figueiredo',
      'Rio Preto da Eva',
      'Santa Isabel do Rio Negro',
      'Santo Antônio do Içá',
      'São Gabriel da Cachoeira',
      'São Paulo de Olivença',
      'São Sebastião do Uatumã',
      'Silves',
      'Tabatinga',
      'Tapauá',
      'Tefé',
      'Tonantins',
      'Uarini',
      'Urucará',
      'Urucurituba'
    ];
  },

  /* =======================================================
     UTILITÁRIOS
  ======================================================= */

  onlyNumbers(value) {

    return String(
      value || ''
    ).replace(
      /\D/g,
      ''
    );
  },


  formatCpfCnpj(value) {

    const digits =
      this.onlyNumbers(value)
        .slice(0, 14);


    if (digits.length <= 11) {

      return digits
        .replace(
          /(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /(\d{3})(\d{1,2})$/,
          '$1-$2'
        );
    }


    return digits
      .replace(
        /^(\d{2})(\d)/,
        '$1.$2'
      )
      .replace(
        /^(\d{2})\.(\d{3})(\d)/,
        '$1.$2.$3'
      )
      .replace(
        /\.(\d{3})(\d)/,
        '.$1/$2'
      )
      .replace(
        /(\d{4})(\d{1,2})$/,
        '$1-$2'
      );
  },


  escapeHTML(value) {

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
