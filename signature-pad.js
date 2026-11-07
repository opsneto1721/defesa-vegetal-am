/* =========================================================
   DEFESA VEGETAL AM - V2
   COLETA DE ASSINATURA EM TELA CHEIA

   SignaturePad.capture({ title, name, detail, allowRefusal })
   → Promise que resolve com:
     { status: 'ASSINADO', image: 'data:image/png;base64,...' }
     { status: 'RECUSADO' }
     null  (cancelado)
========================================================= */

const SignaturePad = {

  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  async capture({ title = 'Assinatura', name = '', detail = '', allowRefusal = false } = {}) {

    const overlay = document.createElement('div');
    overlay.className = 'sig-overlay';
    overlay.innerHTML = `
      <div class="sig-top">
        <div>
          <strong>${this.esc(title)}</strong>
          <small>Assine com o dedo ou caneta dentro da área branca. Gire o aparelho para ter mais espaço.</small>
        </div>
        <button type="button" class="sig-btn sig-ghost" data-act="cancel">Cancelar</button>
      </div>
      <div class="sig-area">
        <canvas></canvas>
        <div class="sig-baseline">
          <span>${this.esc(name)}</span>
          ${detail ? `<small>${this.esc(detail)}</small>` : ''}
        </div>
        <div class="sig-hint">Assine aqui</div>
      </div>
      <div class="sig-bottom">
        <button type="button" class="sig-btn sig-ghost" data-act="clear">Limpar</button>
        ${allowRefusal ? '<button type="button" class="sig-btn sig-warn" data-act="refuse">Recusou-se a assinar</button>' : ''}
        <button type="button" class="sig-btn sig-primary" data-act="ok" disabled>Confirmar assinatura</button>
      </div>`;

    document.body.appendChild(overlay);
    document.body.classList.add('sig-open');

    // Tela cheia + paisagem quando o aparelho permitir
    try {
      if (overlay.requestFullscreen) await overlay.requestFullscreen({ navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch {
      /* nem todo navegador permite; segue normalmente */
    }

    const canvas = overlay.querySelector('canvas');
    const area = overlay.querySelector('.sig-area');
    const okBtn = overlay.querySelector('[data-act=ok]');
    const hint = overlay.querySelector('.sig-hint');
    const ctx = canvas.getContext('2d');
    let strokes = [];
    let current = null;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = area.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };

    const redraw = () => {
      const rect = area.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0b1f3a';
      strokes.forEach(stroke => {
        ctx.beginPath();
        stroke.forEach(([x, y, w], i) => {
          ctx.lineWidth = w;
          if (i === 0) ctx.moveTo(x * rect.width, y * rect.height);
          else ctx.lineTo(x * rect.width, y * rect.height);
        });
        ctx.stroke();
      });
    };

    const point = e => {
      const rect = area.getBoundingClientRect();
      const pressure = e.pressure && e.pressure !== 0.5 ? e.pressure : 0.5;
      return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, 1.5 + pressure * 3];
    };

    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      current = [point(e)];
      strokes.push(current);
      hint.hidden = true;
    });
    canvas.addEventListener('pointermove', e => {
      if (!current) return;
      e.preventDefault();
      current.push(point(e));
      redraw();
    });
    const end = () => {
      if (current && current.length > 1) okBtn.disabled = false;
      current = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    window.addEventListener('resize', resize);
    setTimeout(resize, 50);

    /* Exporta só a área assinada, com fundo branco */
    const exportImage = () => {
      const rect = area.getBoundingClientRect();
      const w = 900;
      const h = Math.round(w * rect.height / rect.width);
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const o = out.getContext('2d');
      // Fundo transparente: a assinatura não cobre as linhas do documento
      o.lineCap = 'round';
      o.lineJoin = 'round';
      o.strokeStyle = '#0b1f3a';
      const scale = w / rect.width;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      strokes.forEach(stroke => {
        o.beginPath();
        stroke.forEach(([x, y, lw], i) => {
          const px = x * w, py = y * h;
          minX = Math.min(minX, px); minY = Math.min(minY, py);
          maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
          o.lineWidth = lw * scale;
          if (i === 0) o.moveTo(px, py); else o.lineTo(px, py);
        });
        o.stroke();
      });
      const pad = 20;
      const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
      const cw = Math.min(w, maxX + pad) - cx, ch = Math.min(h, maxY + pad) - cy;
      const crop = document.createElement('canvas');
      crop.width = Math.max(1, Math.round(cw));
      crop.height = Math.max(1, Math.round(ch));
      crop.getContext('2d').drawImage(out, cx, cy, cw, ch, 0, 0, crop.width, crop.height);
      return crop.toDataURL('image/png');
    };

    return new Promise(resolve => {
      const finish = async result => {
        window.removeEventListener('resize', resize);
        try {
          if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
          if (document.fullscreenElement) await document.exitFullscreen();
        } catch {
          /* ignorado */
        }
        overlay.remove();
        document.body.classList.remove('sig-open');
        resolve(result);
      };

      overlay.querySelector('[data-act=cancel]').onclick = () => finish(null);
      overlay.querySelector('[data-act=clear]').onclick = () => {
        strokes = [];
        okBtn.disabled = true;
        hint.hidden = false;
        redraw();
      };
      const refuse = overlay.querySelector('[data-act=refuse]');
      if (refuse) {
        refuse.onclick = () => {
          if (confirm('Registrar que o responsável se recusou a assinar?')) finish({ status: 'RECUSADO' });
        };
      }
      okBtn.onclick = () => finish({ status: 'ASSINADO', image: exportImage() });
    });
  }
};
