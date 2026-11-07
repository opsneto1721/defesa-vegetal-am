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
      body { font-family: "Segoe UI", Roboto, Arial, Helvetica, sans-serif; color: #1b2430; font-size: 9.6pt; margin: 0; }
      .page { width: 190mm; margin: 0 auto; page-break-after: always; position: relative; }
      .page.last { page-break-after: auto; }
      table { width: 100%; border-collapse: collapse; }

      /* Cabeçalho institucional */
      .hdr td { vertical-align: middle; }
      .hdr .brasao img { height: 14mm; display: block; }
      .hdr .org { padding-left: 3mm; line-height: 1.3; }
      .hdr .org .gov { font-size: 8pt; letter-spacing: 0.06em; color: #4a5866; }
      .hdr .org .ag { font-size: 9.2pt; font-weight: 700; color: #12335f; }
      .hdr .org .ger { font-size: 8pt; color: #4a5866; }
      .hdr .logo { text-align: right; }
      .hdr .logo img { height: 12mm; }
      .rule { height: 1mm; background: #12335f; margin: 1.5mm 0 0; }
      .rule2 { height: 0.5mm; background: #1f8a4c; margin-bottom: 2mm; }

      /* Título e número */
      .titlebar td { vertical-align: middle; }
      .title { font-size: 17pt; font-weight: 800; color: #12335f; letter-spacing: 0.01em; }
      .title small { display: block; font-size: 8pt; font-weight: 400; color: #4a5866; letter-spacing: 0.04em; }
      .num { text-align: right; }
      .numbox { display: inline-block; border: 1.4px solid #12335f; border-radius: 2mm; padding: 1.2mm 2.5mm; }
      .numbox table { width: auto; }
      .numbox td { padding: 0 1mm; text-align: center; }
      .numbox .v { font-size: 13pt; font-weight: 800; color: #12335f; }
      .numbox .sep { color: #9aa7b4; font-size: 12pt; }
      .numbox .l { font-size: 6.2pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7886; }
      .prov { color: #b42318; font-size: 7pt; font-weight: 700; margin-top: 1mm; }

      /* Seções */
      .sec { margin-top: 2.2mm; }
      .sec-h { font-size: 9pt; font-weight: 800; color: #12335f; text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 1mm; border-bottom: 1px solid #12335f; margin-bottom: 1.5mm; }
      .sec-h .n { display: inline-block; width: 5mm; height: 5mm; line-height: 5mm; border-radius: 50%; background: #12335f; color: #fff; text-align: center; font-size: 8pt; margin-right: 1.5mm; }
      .sec-h small { text-transform: none; letter-spacing: 0; font-weight: 400; color: #6b7886; font-size: 7pt; }

      .fields td { border: 1px solid #d5dde5; padding: 0.8mm 2mm 1mm; vertical-align: top; }
      .fields .k { display: block; font-size: 6.4pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7886; margin-bottom: 0.4mm; }
      .fields .v2 { font-weight: 600; font-size: 9.4pt; min-height: 4mm; display: block; }

      .desc { border: 1px solid #d5dde5; border-left: 1.2mm solid #1f8a4c; background: #f6f9f7; padding: 2.2mm 3mm; text-align: justify; line-height: 1.45; min-height: 38mm; }
      .desc.long { font-size: 8.6pt; line-height: 1.35; }
      .desc.xlong { font-size: 7.8pt; line-height: 1.25; }
      .lead { color: #4a5866; }
      .u { font-weight: 700; color: #1b2430; border-bottom: 1px dotted #6b7886; }
      .legal { border: 1px solid #d5dde5; padding: 2mm 3mm; line-height: 1.35; min-height: 11mm; font-size: 9pt; }
      .anexo-note { font-style: italic; color: #4a5866; font-size: 8.4pt; }

      /* Assinaturas */
      .signs { margin-top: 2.2mm; }
      .signs > tbody > tr > td { vertical-align: top; }
      .box { border: 1px solid #d5dde5; border-radius: 1.5mm; padding: 1.6mm 2.5mm; }
      .box-h { font-size: 7.4pt; font-weight: 800; color: #12335f; text-transform: uppercase; letter-spacing: 0.06em; }
      .box-sub { font-size: 7pt; color: #6b7886; }
      .gap { width: 3mm; }
      .sig { text-align: center; margin-top: 1mm; }
      .sig img { max-height: 12mm; max-width: 62mm; display: block; margin: 0 auto -1.5mm; mix-blend-mode: multiply; position: relative; }
      .sig .line { border-top: 1px solid #1b2430; margin: 0 4mm; padding-top: 0.8mm; font-size: 8pt; color: #4a5866; }
      .sig .line b { color: #1b2430; font-size: 8.6pt; }
      .sig .blank { height: 9mm; }
      .elec { border: 1px solid #1f8a4c; background: #eef7f1; color: #17673a; border-radius: 1.2mm; font-size: 7pt; padding: 1.2mm; margin: 0 6mm 1mm; text-align: center; line-height: 1.3; }
      .refused { color: #b42318; font-size: 8pt; font-weight: 700; height: 11mm; padding-top: 6mm; }
      .wit td { padding: 0.5mm 0; font-size: 8pt; color: #4a5866; }
      .wit b { color: #1b2430; }
      .recv { font-size: 8pt; color: #4a5866; margin: 1mm 0; }
      .via { font-size: 7.8pt; color: #1b2430; margin-top: 1.2mm; padding-top: 1mm; border-top: 1px dashed #d5dde5; }
      .team { font-size: 7.4pt; color: #4a5866; margin-top: 1mm; text-align: center; }
      .wit-na { margin-top: 2.2mm; font-size: 8pt; color: #4a5866; padding: 1.6mm 2.5mm; }
      .wit-box { margin-top: 2.2mm; }
      .signs .box { min-height: 33mm; }
      .wit-row td { vertical-align: top; }
      .na { font-size: 8pt; color: #6b7886; font-style: italic; padding: 8mm 0; text-align: center; }

      /* Rodapé */
      .vias { margin-top: 2mm; }
      .vias td { text-align: center; font-size: 7pt; color: #4a5866; }
      .vias span { border: 1px solid #d5dde5; border-radius: 3mm; padding: 0.6mm 3mm; }
      .foot { margin-top: 2mm; border-top: 1px solid #d5dde5; padding-top: 1.5mm; }
      .foot td { vertical-align: middle; font-size: 6.6pt; color: #4a5866; line-height: 1.35; }
      .foot .r { text-align: right; font-weight: 700; color: #12335f; font-size: 7.4pt; }

      .draft { position: absolute; top: 105mm; left: 0; right: 0; text-align: center; font-size: 50pt; color: rgba(180,35,24,0.10); font-weight: 800; transform: rotate(-24deg); letter-spacing: 0.1em; }

      /* Anexo */
      .anx-head td { vertical-align: middle; }
      .anx-title { font-size: 11pt; font-weight: 800; color: #12335f; }
      .anx-sub { font-size: 8pt; color: #4a5866; text-align: right; }
      h3 { font-size: 8.6pt; margin: 4mm 0 1.5mm; color: #12335f; text-transform: uppercase; letter-spacing: 0.06em; }
      .grid th, .grid td { border: 1px solid #d5dde5; padding: 1.1mm 1.6mm; font-size: 8.2pt; text-align: left; vertical-align: top; }
      .grid th { background: #12335f; color: #fff; font-weight: 600; font-size: 7.6pt; }
      .grid tr:nth-child(even) td { background: #f6f8fa; }
      .photos td { width: 33%; padding: 1.5mm; vertical-align: top; font-size: 7.6pt; text-align: center; color: #4a5866; }
      .photos img { width: 100%; max-height: 55mm; object-fit: contain; border: 1px solid #d5dde5; border-radius: 1mm; }
      .hash { font-size: 6.8pt; color: #6b7886; margin-top: 4mm; word-break: break-all; border-top: 1px solid #d5dde5; padding-top: 1.5mm; }
      .noprint { position: fixed; top: 8px; right: 8px; padding: 8px 14px; font-size: 14px; border: 0; border-radius: 8px; background: #12335f; color: #fff; }
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
        <tr><td>Testemunha ${index} — Nome: <b>${this.esc(w?.nome || '')}</b>${w?.nome ? '' : '______________________'}</td></tr>
        <tr><td>CPF/RG: <b>${this.esc(w?.doc || '')}</b>${w?.doc ? '' : '______________________'}</td></tr>
      </table>
      ${this.signature(w?.image ? { image: w.image } : null, '', 'Assinatura')}`;
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
    const r = ctx.ciencia || ctx.recebimento || {};
    const sv = ctx.servidor || {};
    const wits = ctx.testemunhas || [];
    const hasAnexo = ctx.anexo && (ctx.anexo.secoes?.some(s => s.linhas.length) || ctx.anexo.fotos?.length);
    const numeroTexto = n.seq ? `${n.seq}-${n.ano}-${n.unidade}` : '';

    const field = (k, v, attrs = '') => `<td ${attrs}><span class="k">${k}</span><span class="v2">${e(v)}</span></td>`;
    const header = `
      <table class="hdr"><tr>
        <td class="brasao" style="width:19mm"><img src="${TERMO_ASSETS.brasaoAM}" alt=""></td>
        <td class="org">
          <div class="gov">GOVERNO DO ESTADO DO AMAZONAS</div>
          <div class="ag">Agência de Defesa Agropecuária e Florestal do Estado do Amazonas – ADAF/AM</div>
          <div class="ger">Gerência de Defesa Vegetal</div>
        </td>
        <td class="logo" style="width:26mm"><img src="${TERMO_ASSETS.logoADAF}" alt="ADAF"></td>
      </tr></table>
      <div class="rule"></div><div class="rule2"></div>`;

    const page1 = `
      <div class="page ${hasAnexo ? '' : 'last'}">
        ${ctx.preview ? '<div class="draft">PRÉVIA</div>' : ''}
        ${header}

        <table class="titlebar"><tr>
          <td class="title">TERMO DE FISCALIZAÇÃO<small>Defesa Sanitária Vegetal</small></td>
          <td class="num">
            <div class="numbox"><table>
              <tr><td class="v">${e(n.seq || '')}</td><td class="sep">-</td><td class="v">${e(n.ano || '')}</td><td class="sep">-</td><td class="v">${e(n.unidade || '')}</td></tr>
              <tr><td class="l">Nº sequencial</td><td></td><td class="l">Ano</td><td></td><td class="l">Unidade</td></tr>
            </table></div>
            ${n.provisorio ? '<div class="prov">NÚMERO PROVISÓRIO — o definitivo será atribuído na sincronização</div>' : ''}
          </td>
        </tr></table>

        <div class="sec">
          <div class="sec-h"><span class="n">1</span>Identificação</div>
          <table class="fields">
            <tr>${field('Nome', id.nome, 'style="width:46%"')}${field('CPF', id.cpf, 'style="width:22%"')}${field('Atividade', id.atividade, 'style="width:32%"')}</tr>
            <tr>${field('Empresa / Nome fantasia', id.empresa)}${field('CNPJ', id.cnpj)}${field('Atividade', id.atividadeEmpresa)}</tr>
            <tr>${field('Endereço', id.endereco, 'colspan="3"')}</tr>
            <tr>${field('Município', id.municipio)}${field('UF', id.uf)}${field('Telefone', id.telefone)}</tr>
            <tr>${field('Coordenadas geográficas (lat / long)', id.lat || id.lng ? `${id.lat} / ${id.lng}` : '', 'colspan="3"')}</tr>
          </table>
        </div>

        <div class="sec">
          <div class="sec-h"><span class="n">2</span>Descrição da ação</div>
          <div class="desc ${String(a.descricao || '').length > 1500 ? 'xlong' : String(a.descricao || '').length > 950 ? 'long' : ''}">
            <span class="lead">Em <span class="u">${e(a.data)}</span> às <span class="u">${e(a.hora)}</span> hora(s), ao realizar fiscalização no(a)
            <span class="u">${e(a.local)}</span>, constatei:</span><br>
            ${this.text(a.descricao)}
            ${hasAnexo ? '<br><span class="anexo-note">Detalhamento técnico no Anexo I deste termo.</span>' : ''}
          </div>
        </div>

        <div class="sec">
          <div class="sec-h"><span class="n">3</span>Enquadramento legal
            <small>— leis, decretos, resoluções, portarias, instruções normativas, artigos, incisos e alíneas</small></div>
          <div class="legal">${this.text(ctx.enquadramento || '')}</div>
        </div>

        <table class="signs"><tr>
          <td style="width:50%">
            <div class="box">
              <div class="box-h">Ciência do fiscalizado</div>
              <div class="recv">Declaro ciência do inteiro teor deste Termo de Fiscalização${r.quando ? ` — ${e(r.quando)}${r.local ? ', ' + e(r.local) : ''}` : ''}.</div>
              ${this.signature(r.assinatura, r.nome, r.qualificacao || 'Assinatura')}
              <div class="via"><b>2ª via:</b> ${ctx.entrega ? e(ctx.entrega) : '____________________________________________'}</div>
            </div>
          </td>
          <td class="gap"></td>
          <td style="width:50%">
            <div class="box">
              <div class="box-h">Servidor da ADAF</div>
              <div class="recv">Fiscalização realizada por:</div>
              ${this.signature(sv.assinatura, sv.nome, [sv.cargo, sv.matricula ? 'Matrícula ' + sv.matricula : ''].filter(Boolean).join(' — ') || 'Assinatura e identificação')}
              ${sv.equipe ? `<div class="via"><b>Equipe:</b> ${e(sv.equipe)}</div>` : ''}
            </div>
          </td>
        </tr></table>

        ${ctx.testemunhasAplicaveis === false
          ? `<div class="box wit-na"><span class="box-h">4 – Testemunhas:</span> não se aplica — o fiscalizado assinou o termo.</div>`
          : `<div class="box wit-box">
              <div class="box-h"><span class="n" style="display:inline-block;width:4.2mm;height:4.2mm;line-height:4.2mm;border-radius:50%;background:#12335f;color:#fff;text-align:center;font-size:7pt;margin-right:1mm">4</span>Testemunhas
                <span class="box-sub" style="text-transform:none;letter-spacing:0;font-weight:400"> — necessárias quando o autuado se negar a assinar ou estiver ausente</span></div>
              <table class="wit-row"><tr>
                <td style="width:50%">${this.witness(wits[0], 1)}</td>
                <td class="gap"></td>
                <td style="width:50%">${this.witness(wits[1], 2)}</td>
              </tr></table>
            </div>`}

        <table class="foot"><tr>
          <td style="width:62%">
            Av. Carlos Drummond de Andrade, 1460 – Japiim, Conj. Atílio Andreazza, ULBRA, Bloco G, 1º andar – Manaus/AM – CEP 69077-730<br>
            Fone: (92) 99192-3067 / 99983-1176 • E-mail: gabinete@adaf.am.gov.br
          </td>
          <td class="r">Secretaria de Produção Rural do Estado do Amazonas – SEPROR/AM</td>
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
          ${header}
          <table class="anx-head"><tr>
            <td class="anx-title">ANEXO I — TERMO DE FISCALIZAÇÃO N° ${e(numeroTexto || '(a definir)')}</td>
            <td class="anx-sub">${e(ax.titulo || '')}</td>
          </tr></table>
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
