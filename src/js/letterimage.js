/*
  letterimage.js — письмо одной картинкой (для телефонов).

  На телефонах окно печати («Сохранить как PDF») часто не открывается, поэтому вместо него
  письмо рисуется в картинку PNG в том же виде, что и PDF: кремовый лист, золотая рамка,
  рукописные заголовок и подпись, подсвеченная строка «Дополнение» и все абзацы (в том числе
  скрытые под «Дополнением»). Картинка показывается поверх страницы, с кнопками «сохранить»
  (меню «поделиться» / скачивание) и «закрыть»; её также можно сохранить долгим нажатием.

  Использование:  LetterImage.open()   — вызывать из клика/тапа (кнопка на странице письма).
  Тексты кнопок — content.js, раздел ui (imageSave, imageClose, imageHint, imageWait).
*/
(function () {
  const W = 1080;              // ширина листа в условных пикселях
  const SCALE = 1.5;           // во сколько раз увеличить для чёткости (итог 1620 px в ширину)
  const M = 36;                // белое поле вокруг рамки
  const PAD = 64;              // отступ текста от рамки
  const RATIO_MIN = 1.414;     // высота не меньше, чем у листа А4
  const CREAM = '#fff8ec', INK = '#34222a', RED = '#b3432f', GOLD = '#d9a441';

  const ui = () => (window.CONTENT && window.CONTENT.ui) || {};
  const letterText = () => (window.CONTENT && window.CONTENT.letter) || {};
  const strip = s => String(s || '').replace(/\{\{|\}\}/g, '');    // убрать служебные {{ }}

  /* ---------- перенос строк по ширине ---------- */
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- раскладка и рисование листа ----------
     Один и тот же код идёт два раза: draw=false — только измерить высоту, draw=true — нарисовать. */
  function paint(ctx, t, draw) {
    const x0 = M + PAD;
    const tw = W - 2 * (M + PAD);
    let y = M + PAD;

    function block(text, font, size, color, opts) {
      opts = opts || {};
      const x = x0 + (opts.indent || 0);
      const width = tw - (opts.indent || 0);
      const lh = Math.round(size * (opts.lh || 1.6));
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      wrap(ctx, text, width).forEach(line => {
        if (draw) ctx.fillText(line, x, y + lh / 2);
        y += lh;
      });
      y += opts.gap || 0;
    }

    block(strip(t.eyebrow), '600 46px Caveat, cursive', 46, RED, { lh: 1.3, gap: 6 });
    block(strip(t.title), '600 66px "Cormorant Garamond", Georgia, serif', 66, INK, { lh: 1.15, gap: 40 });
    (t.paragraphs || []).forEach(p => block(strip(p), '400 33px "EB Garamond", Georgia, serif', 33, INK, { gap: 22 }));
    y += 8;
    block(strip(t.sign), '600 54px Caveat, cursive', 54, RED, { lh: 1.3 });

    const m = t.more;
    if (m && m.paragraphs && m.paragraphs.length) {
      const label = strip(m.label).replace(/\s*\([^)]*\)\s*/g, ' ').trim() || 'Дополнение';
      y += 40;
      const lh = 60;
      ctx.font = '600 46px Caveat, cursive';
      if (draw) {
        const w = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(217, 164, 65, 0.45)';                    // маркерная подсветка
        ctx.fillRect(x0 - 10, y + lh * 0.55, w + 20, lh * 0.34);
      }
      block(label, '600 46px Caveat, cursive', 46, RED, { lh: 1.3, gap: 14 });

      const top = y;
      m.paragraphs.forEach(p => block(strip(p), '400 31px "EB Garamond", Georgia, serif', 31, INK, { indent: 26, gap: 20 }));
      if (draw) {                                                       // черта слева, как у блока на экране
        ctx.fillStyle = 'rgba(179, 67, 47, 0.4)';
        ctx.fillRect(x0, top, 3, y - top - 20);
      }
    }
    return y;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const wanted = ['600 46px Caveat', '600 66px "Cormorant Garamond"', '400 33px "EB Garamond"'];
    try { await Promise.all(wanted.map(f => document.fonts.load(f, 'Абвгд'))); } catch (e) { /* без шрифтов — запасные */ }
  }

  /* ---------- сборка PNG ---------- */
  async function build() {
    await loadFonts();
    const t = letterText();

    const scratch = document.createElement('canvas').getContext('2d');
    const endY = paint(scratch, t, false);
    const H = Math.max(Math.ceil(endY + PAD + M), Math.round(W * RATIO_MIN));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * SCALE);
    canvas.height = Math.round(H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = '#fff';                                            // белый лист
    ctx.fillRect(0, 0, W, H);
    roundRectPath(ctx, M, M, W - 2 * M, H - 2 * M, 14);                // кремовый «бланк» в золотой рамке
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = GOLD;
    ctx.stroke();

    paint(ctx, t, true);
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png');
    });
  }

  /* ---------- окно с картинкой ---------- */
  let overlay = null, objectUrl = null;

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    document.body.style.overflow = '';
  }

  async function save(blob, name) {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* иначе — скачиваем обычным способом */ }
    }
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function open() {
    if (overlay) return;
    const u = ui();
    const name = (strip(letterText().title).replace(/[!?.\s]+$/, '') || 'Письмо') + '.png';

    overlay = document.createElement('div');
    overlay.className = 'li-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const bar = document.createElement('div');
    bar.className = 'li-bar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'li-btn';
    saveBtn.textContent = u.imageSave || 'сохранить';
    saveBtn.disabled = true;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'li-btn';
    closeBtn.textContent = u.imageClose || 'закрыть';
    closeBtn.addEventListener('click', close);
    bar.append(saveBtn, closeBtn);

    const note = document.createElement('p');
    note.className = 'li-note';
    note.textContent = u.imageWait || 'готовлю письмо…';

    overlay.append(bar, note);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    try {
      const blob = await build();
      if (!overlay) return;                                            // успели закрыть
      objectUrl = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.className = 'li-img';
      img.alt = 'Письмо';
      img.src = objectUrl;
      overlay.appendChild(img);
      note.textContent = u.imageHint || 'Можно и так: нажми на письмо и подержи — «Сохранить».';
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', () => save(blob, name));
    } catch (e) {
      note.textContent = u.imageFail || 'Не получилось собрать картинку. Можно сделать скриншот письма.';
    }
  }

  window.LetterImage = { open, close, build };
})();
