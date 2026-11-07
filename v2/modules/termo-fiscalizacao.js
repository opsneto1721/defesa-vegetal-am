/* =========================================================
   DEFESA VEGETAL AM - V2
   DOCUMENTO: TERMO DE FISCALIZAÇÃO (modelo ADAF/AM)

   TermoFiscalizacao.build(ctx) devolve o HTML completo
   (A4) do termo + anexo. O mesmo HTML é usado:
   - no aparelho, para imprimir / salvar PDF (offline);
   - no Apps Script, que gera o PDF oficial no Drive.

   Layout em tabelas e CSS simples para que os dois
   renderizadores produzam o mesmo resultado.
========================================================= */

const TermoFiscalizacao = {

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  text(value) {
    return this.esc(value).replace(/\n/g, '<br>');
  },

  css() {
    return `
      @page { size: A4; margin: 7mm 10mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10.5pt; margin: 0; }
      .page { width: 190mm; margin: 0 auto; page-break-after: always; position: relative; }
      .page.last { page-break-after: auto; }
      .gov { text-align: center; line-height: 1.2; margin-bottom: 1.5mm; }
      .gov img { height: 14mm; }
      .gov b { display: block; font-size: 9pt; }
      table { width: 100%; border-collapse: collapse; }
      .frame { border: 1px solid #000; }
      .frame td { border: 1px solid #000; padding: 0.9mm 1.6mm; vertical-align: top; }
      .title { font-size: 18pt; font-weight: bold; white-space: nowrap; border-right: 0 !important; }
      .num { text-align: right; border-left: 0 !important; white-space: nowrap; }
      .num table { width: auto; margin-left: auto; }
      .num td { border: 0 !important; padding: 0 1mm !important; text-align: center; }
      .num .v { font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000 !important; min-width: 22mm; }
      .num .l { font-size: 7pt; font-weight: bold; }
      .prov { color: #b00; font-size: 7pt; font-weight: bold; }
      .sec { font-weight: bold; font-size: 11.5pt; background: #fff; }
      .sec small { font-weight: normal; font-size: 7.5pt; }
      .lbl { font-size: 9pt; }
      .val { font-weight: bold; }
      .desc { text-align: justify; line-height: 1.45; height: 44mm; }
      .desc.long { font-size: 9pt; line-height: 1.3; }
      .desc.xlong { font-size: 8pt; line-height: 1.2; }
      .legal { line-height: 1.35; height: 11mm; font-size: 9.5pt; }
      .hint { font-size: 7pt; color: #333; text-align: center; }
      .u { border-bottom: 1px dotted #000; font-weight: bold; }
      .sig { text-align: center; }
      .sig img { max-height: 12mm; max-width: 65mm; display: block; margin: 0 auto; }
      .sig .line { border-top: 1px solid #000; margin: 0 6mm; padding-top: 0.8mm; font-size: 9pt; }
      .sig .blank { height: 11mm; }
      .elec { border: 1px dashed #176b3a; color: #176b3a; font-size: 7.5pt; padding: 1.5mm; margin: 0 8mm 1mm; text-align: center; }
      .refused { color: #b00; font-size: 8.5pt; font-weight: bold; height: 11mm; padding-top: 6mm; }
      .wit td { border: 0 !important; padding: 0.6mm 0 !important; font-size: 9pt; }
      .vias { width: 100%; margin-top: 2mm; font-size: 9pt; border-top: 1px solid #000; }
      .vias td { text-align: center; padding-top: 1mm; }
      .foot { margin-top: 2.5mm; width: 100%; }
      .foot td { vertical-align: middle; }
      .addr { font-size: 6.8pt; color: #1f3a6b; line-height: 1.3; }
      .foot img { height: 11mm; }
      .sepror { font-size: 8.5pt; font-weight: bold; color: #1f3a6b; text-align: center; }
      .draft { position: absolute; top: 95mm; left: 0; right: 0; text-align: center; font-size: 46pt; color: rgba(200,0,0,0.13); font-weight: bold; transform: rotate(-24deg); }
      .anx-head { border-bottom: 2px solid #000; padding-bottom: 1.5mm; margin-bottom: 3mm; }
      .anx-head b { font-size: 11pt; }
      .anx-head span { float: right; font-size: 8.5pt; }
      h3 { font-size: 10pt; margin: 4mm 0 1.5mm; }
      .grid td, .grid th { border: 1px solid #777; padding: 1mm 1.5mm; font-size: 8.5pt; text-align: left; vertical-align: top; }
      .grid th { background: #e8efe9; }
      .photos td { width: 33%; padding: 1.5mm; vertical-align: top; font-size: 8pt; text-align: center; }
      .photos img { width: 100%; max-height: 55mm; object-fit: contain; border: 1px solid #aaa; }
      .hash { font-size: 7pt; color: #444; margin-top: 4mm; word-break: break-all; }
      .noprint { position: fixed; top: 8px; right: 8px; padding: 8px 14px; font-size: 14px; }
      @media print { .noprint { display: none; } }
    `;
  },

  /* Bloco de assinatura */
  signature(s, name, role) {
    let top;
    if (s && s.image) top = `<img src="${this.esc(s.image)}" alt="">`;
    else if (s && s.electronic) top = `<div class="elec"><b>Assinado eletronicamente</b><br>${this.esc(s.electronic)}</div>`;
    else if (s && s.status === 'RECUSADO') top = '<div class="refused">Recusou-se a assinar</div>';
    else if (s && s.status === 'AUSENTE') top = '<div class="refused">Responsável ausente</div>';
    else top = '<div class="blank"></div>';
    return `<div class="sig">${top}<div class="line">${name ? `<b>${this.esc(name)}</b><br>` : ''}${this.esc(role)}</div></div>`;
  },

  witness(w, index) {
    return `
      <table class="wit">
        <tr><td>Nome: <span class="u">${this.esc(w?.nome || '')}</span>${w?.nome ? '' : '_______________________________'}</td></tr>
        <tr><td>CPF/RG: <span class="u">${this.esc(w?.doc || '')}</span>${w?.doc ? '' : '_____________________________'}</td></tr>
      </table>
      ${this.signature(w?.image ? { image: w.image } : null, '', `Assinatura (testemunha ${index})`)}`;
  },

  /*
    ctx = {
      numero: { seq, ano, unidade, provisorio },
      preview, emitidoEm,
      ident: { nome, cpf, atividade, empresa, cnpj, atividadeEmpresa, endereco, municipio, uf, telefone, lat, lng },
      acao: { data, hora, local, descricao, anexo },
      enquadramento,
      testemunhas: [ {nome, doc, image}, ... ],
      recebimento: { quando, local, assinatura: {image|status}, nome, qualificacao },
      servidor: { nome, matricula, cargo, assinatura: {image|electronic} },
      anexo: { titulo, secoes: [ {titulo, colunas, linhas} ], fotos: [ {src, legenda} ], hash }
    }
  */
  build(ctx) {
    const e = v => this.esc(v);
    const n = ctx.numero || {};
    const id = ctx.ident || {};
    const a = ctx.acao || {};
    const r = ctx.recebimento || {};
    const sv = ctx.servidor || {};
    const wits = ctx.testemunhas || [];
    const hasAnexo = ctx.anexo && (ctx.anexo.secoes?.some(s => s.linhas.length) || ctx.anexo.fotos?.length);
    const numeroTexto = n.seq ? `${n.seq}-${n.ano}-${n.unidade}` : '';

    const page1 = `
      <div class="page ${hasAnexo ? '' : 'last'}">
        ${ctx.preview ? '<div class="draft">PRÉVIA</div>' : ''}
        <div class="gov">
          <img src="${TERMO_ASSETS.brasaoAM}" alt=""><br>
          <b>GOVERNO DO ESTADO DO AMAZONAS</b>
          <b>Agência de Defesa Agropecuária e Florestal do Estado do Amazonas – ADAF/AM</b>
        </div>

        <table class="frame">
          <tr>
            <td colspan="2" class="title">TERMO DE FISCALIZAÇÃO N°</td>
            <td colspan="2" class="num">
              <table>
                <tr>
                  <td class="v">${e(n.seq || '')}</td><td>-</td>
                  <td class="v">${e(n.ano || '')}</td><td>-</td>
                  <td class="v">${e(n.unidade || '')}</td>
                </tr>
                <tr>
                  <td class="l">N° sequencial</td><td></td>
                  <td class="l">Ano</td><td></td>
                  <td class="l">Unidade</td>
                </tr>
              </table>
              ${n.provisorio ? '<div class="prov">NÚMERO PROVISÓRIO — o definitivo será atribuído na sincronização</div>' : ''}
            </td>
          </tr>

          <tr><td colspan="4" class="sec">1- Identificação</td></tr>
          <tr>
            <td style="width:42%"><span class="lbl">Nome:</span> <span class="val">${e(id.nome)}</span></td>
            <td colspan="2" style="width:28%"><span class="lbl">CPF:</span> <span class="val">${e(id.cpf)}</span></td>
            <td style="width:30%"><span class="lbl">Atividade:</span> <span class="val">${e(id.atividade)}</span></td>
          </tr>
          <tr>
            <td><span class="lbl">Empresa / Fantasia:</span> <span class="val">${e(id.empresa)}</span></td>
            <td colspan="2"><span class="lbl">CNPJ:</span> <span class="val">${e(id.cnpj)}</span></td>
            <td><span class="lbl">Atividade:</span> <span class="val">${e(id.atividadeEmpresa)}</span></td>
          </tr>
          <tr><td colspan="4"><span class="lbl">Endereço:</span> <span class="val">${e(id.endereco)}</span></td></tr>
          <tr>
            <td><span class="lbl">Município:</span> <span class="val">${e(id.municipio)}</span></td>
            <td colspan="2"><span class="lbl">UF:</span> <span class="val">${e(id.uf)}</span></td>
            <td><span class="lbl">Telefone:</span> <span class="val">${e(id.telefone)}</span></td>
          </tr>
          <tr><td colspan="4"><span class="lbl">Coordenadas Geográficas:</span>
            <span class="val">${e(id.lat)}</span> &nbsp;/&nbsp; <span class="val">${e(id.lng)}</span></td></tr>

          <tr><td colspan="4" class="sec">2 – Descrição da Ação</td></tr>
          <tr><td colspan="4" class="desc ${String(a.descricao || '').length > 1500 ? 'xlong' : String(a.descricao || '').length > 950 ? 'long' : ''}">
            Em <span class="u">${e(a.data)}</span> às <span class="u">${e(a.hora)}</span> hora(s) ao realizar fiscalização
            no(a) <span class="u">${e(a.local)}</span> constatei:<br>
            ${this.text(a.descricao)}
            ${hasAnexo ? '<br><i>(Detalhamento técnico no Anexo I deste termo.)</i>' : ''}
          </td></tr>

          <tr><td colspan="4" class="sec">3 – Enquadramento Legal
            <small>(citar leis, decretos, resoluções, portarias, instruções normativas, artigos, incisos e alíneas)</small></td></tr>
          <tr><td colspan="4" class="legal">${this.text(ctx.enquadramento || '')}</td></tr>

          <tr>
            <td colspan="2" rowspan="2" style="width:50%">
              <div class="sec">4 – Testemunhas</div>
              <div class="hint">(necessário apenas quando o autuado se negar em assinar o documento ou quando estiver ausente).</div>
              ${this.witness(wits[0], 1)}
              ${this.witness(wits[1], 2)}
            </td>
            <td colspan="2">
              <b>Recebi a 2ªvia deste Termo em:</b><br>
              <span class="lbl">${r.quando ? e(r.quando) + (r.local ? ' — ' + e(r.local) : '') : '<span class="hint">(Data, hora e local).</span>'}</span>
              <br>
              ${this.signature(r.assinatura, r.nome, r.qualificacao ? 'Assinatura — ' + r.qualificacao : 'Assinatura')}
            </td>
          </tr>
          <tr>
            <td colspan="2">
              ${this.signature(sv.assinatura, sv.nome, [sv.cargo, sv.matricula ? 'Matrícula ' + sv.matricula : ''].filter(Boolean).join(' — ') || 'Servidor da ADAF')}
              <div style="text-align:center;font-weight:bold;font-size:10pt">Assinatura e Identificação do Servidor da ADAF</div>
            </td>
          </tr>
        </table>

        <table class="vias"><tr>
          <td>1ª via: Interessado</td><td>2ª via: ADAF Central</td><td>3ª via: Unidade Local</td>
        </tr></table>

        <table class="foot"><tr>
          <td style="width:38%" class="addr">
            Avenida Carlos Drummond de Andrade, 1460 Japiim<br>
            Conj. Atílio Andreazza. ULBRA, Bloco G, 1º andar<br>
            Fone: (92) 99192-3067 / 99983-1176<br>
            Manaus-AM-CEP 69077-730<br>
            E-mail: gabinete@adaf.am.gov.br
          </td>
          <td style="width:24%;text-align:center"><img src="${TERMO_ASSETS.logoADAF}" alt="ADAF"></td>
          <td style="width:38%" class="sepror">Secretaria de Produção Rural do Estado<br>do Amazonas – SEPROR/AM</td>
        </tr></table>
      </div>`;

    let anexo = '';
    if (hasAnexo) {
      const ax = ctx.anexo;
      const sections = (ax.secoes || []).filter(s => s.linhas.length).map(s => `
        <h3>${e(s.titulo)}</h3>
        <table class="grid">
          <tr>${s.colunas.map(c => `<th>${e(c)}</th>`).join('')}</tr>
          ${s.linhas.map(l => `<tr>${l.map(c => `<td>${this.text(c)}</td>`).join('')}</tr>`).join('')}
        </table>`).join('');

      const photos = (ax.fotos || []).length ? `
        <h3>Evidências fotográficas</h3>
        <table class="photos">
          ${ax.fotos.reduce((rows, p, i) => {
            if (i % 3 === 0) rows.push([]);
            rows[rows.length - 1].push(p);
            return rows;
          }, []).map(row => `<tr>${row.map(p => `<td><img src="${e(p.src)}" alt=""><br>${e(p.legenda)}</td>`).join('')}${'<td></td>'.repeat(3 - row.length)}</tr>`).join('')}
        </table>` : '';

      anexo = `
        <div class="page last">
          ${ctx.preview ? '<div class="draft">PRÉVIA</div>' : ''}
          <div class="anx-head"><b>ANEXO I — TERMO DE FISCALIZAÇÃO N° ${e(numeroTexto || '(a definir)')}</b>
            <span>${e(ax.titulo || '')}</span></div>
          ${sections}
          ${photos}
          ${ax.hash ? `<div class="hash">Código de integridade do documento (SHA-256): ${e(ax.hash)}</div>` : ''}
        </div>`;
    }

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Termo de Fiscalização ${e(numeroTexto)}</title>
      <style>${this.css()}</style></head><body>
      ${ctx.forPrint ? '<button class="noprint" onclick="print()">Imprimir / salvar PDF</button>' : ''}
      ${page1}${anexo}
      </body></html>`;
  }
};
