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
                    <div class="mini-card">

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

                    </div>
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
        () => {

          App.showMessage(
            'Propriedade selecionada. O cadastro de cultura será conectado na Etapa 3.',
            'info'
          );
        }
      );
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
