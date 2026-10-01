/* =========================================================
   DEFESA VEGETAL AM V2
   MÓDULO DE CADASTROS
========================================================= */

const CadastrosModule = {

  currentProducer: null,

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
        () => {

          /*
            Entraremos aqui na Etapa 2.
          */

          App.showMessage(
            'Produtor selecionado. O formulário de propriedade será conectado na próxima etapa.',
            'info'
          );
        }
      );
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
/* =========================================================
   MÓDULOS / FORMULÁRIOS
========================================================= */

.btn-secondary {
  background: #ffffff;
  color: var(--text);
  border: 1px solid var(--border);
}

.module-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.action-card {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  box-shadow: var(--shadow);
}

.action-card:hover {
  border-color: var(--primary);
}

.action-icon {
  font-size: 30px;
}

.action-card strong,
.action-card small {
  display: block;
}

.action-card small {
  color: var(--muted);
  margin-top: 4px;
}

.workspace {
  margin-top: 20px;
}

.form-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 22px;
  box-shadow: var(--shadow);
}

.form-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.form-heading h3 {
  margin: 0 0 5px;
}

.form-heading p {
  margin: 0;
  color: var(--muted);
}

.step-badge {
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 12px;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-wide {
  grid-column: span 2;
}

.field label {
  font-weight: 700;
  font-size: 14px;
}

.field input,
.field select,
.field textarea,
.search-row input {
  width: 100%;
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--text);
  outline: none;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.search-row input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.field small {
  color: var(--muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.search-row {
  display: flex;
  gap: 10px;
}

.search-results {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.result-card {
  width: 100%;
  border: 1px solid var(--border);
  background: #ffffff;
  border-radius: 12px;
  padding: 14px;
  text-align: left;
}

.result-card:hover {
  border-color: var(--primary);
}

.result-card strong,
.result-card span,
.result-card small {
  display: block;
}

.result-card span {
  margin-top: 4px;
}

.result-card small {
  margin-top: 6px;
  color: var(--muted);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.summary-grid > div {
  padding: 14px;
  background: var(--background);
  border-radius: 12px;
}

.summary-grid small,
.summary-grid strong {
  display: block;
}

.summary-grid small {
  color: var(--muted);
  margin-bottom: 5px;
}

.subsection {
  margin-top: 26px;
}

.subsection h4 {
  margin-bottom: 12px;
}

.mini-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
}

.mini-card strong,
.mini-card span {
  display: block;
}

.mini-card span {
  color: var(--muted);
  margin-top: 3px;
  font-size: 14px;
}

.empty-state {
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 700px) {
  .module-actions,
  .form-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: span 1;
  }

  .form-actions,
  .search-row {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }
}
