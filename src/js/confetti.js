/*
  confetti.js — сцена 4: салют, конфетти, шарики и переход к письму.

  Слушает сигнал «свечи погасли» (cake:done) и проводит последовательность:
    1. свечи погасли — короткая тишина;
    2. звон;
    3. пауза (звон затихает);
    4. вспышка света + залпы конфетти из нижних углов + дождь конфетти сверху
       (прямоугольники, кружки, треугольники, пиксели и пиксельные сердца-души)
       + САЛЮТ (ракеты и взрывы: кольцо, двойное кольцо, звезда, сердце)
       + ШАРИКИ (10 ближних и 6 дальних на компьютере, 6 и 4 на телефоне; разного размера и стиля:
         пиксельный, мультяшный, «стикер», Temmie, «24», звезда, сердце, смайлик, котик, мишка,
         белое перевёрнутое сердце-душа…) плывут снизу вверх;
    5. пока всё ещё летит — плавный переход к сцене письма.

  Стили частиц конфетти и их переменные — src/css/scenes/confetti.css.
  Салют и шарики рисуются и анимируются прямо здесь (без стилей и картинок).
  Можно запустить вручную для проверки: Confetti.launch()
*/
(function () {
  /* ---------- тайминг (мс) ---------- */
  const T_BEFORE_CHIME = 450;       // после последней свечи: тишина, потом звон
  const T_PAUSE_AFTER_CHIME = 1100; // звон, потом «вдох» перед залпом
  const T_TO_LETTER = 3200;         // от залпа до перехода к письму (праздник летит и поверх письма)

  const layer = document.getElementById('confetti-layer');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

  const COLORS = ['#d9a441', '#e8c26e', '#b3432f', '#f3e9d8', '#e0453a', '#2fb8b0', '#f2a7c3'];
  const SOULS = ['#ff0000', '#ffff00', '#0a3cff', '#00c000', '#ffc21a'];   // цвета душ Undertale

  /* ================================================================
     КОНФЕТТИ
     ================================================================ */
  function shapeFor() {
    const r = Math.random();
    if (r < 0.50) return 'rect';
    if (r < 0.66) return 'round';
    if (r < 0.78) return 'tri';
    if (r < 0.88) return 'px';
    return 'heart';
  }

  function makeParticle(mode, vw, vh, origin) {
    const shape = shapeFor();
    const el = document.createElement('div');
    el.className = 'confetto ' + mode + (shape === 'rect' ? '' : ' ' + shape);

    let w, h;
    switch (shape) {
      case 'round': w = h = rnd(7, 11); break;
      case 'tri':   w = h = rnd(10, 15); break;
      case 'px':    w = h = rnd(6, 9); break;
      case 'heart': w = rnd(12, 18); h = w * 8 / 9; break;
      default:      w = rnd(6, 11); h = rnd(10, 18);
    }
    el.style.setProperty('--w', w.toFixed(1) + 'px');
    el.style.setProperty('--h', h.toFixed(1) + 'px');
    el.style.setProperty('--c', shape === 'heart' ? pick(SOULS) : pick(COLORS));
    el.style.setProperty('--rot', Math.round(rnd(360, 900) * (Math.random() < 0.5 ? -1 : 1)) + 'deg');

    let dur, delay;
    if (mode === 'fall') {
      dur = rnd(2.6, 4.2);
      delay = rnd(0, 1.6);
      el.style.left = Math.round(rnd(0, vw)) + 'px';
      el.style.setProperty('--drift', Math.round(rnd(-90, 90)) + 'px');
    } else {
      dur = rnd(2.8, 4.2);
      delay = rnd(0, 0.25);
      el.style.left = Math.round(origin.x) + 'px';
      el.style.top = Math.round(origin.y) + 'px';
      el.style.setProperty('--bx', Math.round(origin.dir * rnd(0.12, 0.6) * vw) + 'px');
      el.style.setProperty('--by', Math.round(-rnd(0.35, 0.9) * vh) + 'px');
      el.style.setProperty('--end-y', Math.round(vh - origin.y + 80) + 'px');
    }
    el.style.setProperty('--dur', dur.toFixed(2) + 's');
    el.style.setProperty('--delay', delay.toFixed(2) + 's');

    layer.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 300);
  }

  /* ================================================================
     САЛЮТ: ракета взлетает, взрывается фигурой из искр
     ================================================================ */
  const FIRE_COLORS = ['#ffd23f', '#ff5a4d', '#4dd2ff', '#7dff9a', '#ff7eb6', '#b48bff', '#ffffff'];

  // точки фигуры взрыва (в пикселях от центра)
  function burstPoints(type, R) {
    const pts = [];
    if (type === 'ring' || type === 'double') {
      const n = type === 'ring' ? 28 : 20;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([Math.cos(a) * R, Math.sin(a) * R]);
      }
      if (type === 'double') {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + 0.2;
          pts.push([Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5]);
        }
      }
    } else if (type === 'heart') {
      for (let i = 0; i < 34; i++) {
        const t = (i / 34) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push([x * R / 17, y * R / 17]);
      }
    } else {                                                        // star: пятиконечная звезда
      const v = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? R : R * 0.45;
        v.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      for (let i = 0; i < 10; i++) {
        const p = v[i], q = v[(i + 1) % 10];
        for (let s = 0; s < 3; s++) pts.push([p[0] + (q[0] - p[0]) * s / 3, p[1] + (q[1] - p[1]) * s / 3]);
      }
    }
    return pts;
  }

  function explode(x, y, type, R, colors) {
    if (window.Sound) window.Sound.blip(rnd(70, 110));

    // вспышка в центре
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'absolute', left: (x - R * 0.35) + 'px', top: (y - R * 0.35) + 'px',
      width: R * 0.7 + 'px', height: R * 0.7 + 'px', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%)'
    });
    layer.appendChild(flash);
    flash.animate([{ transform: 'scale(0.1)', opacity: 0.9 }, { transform: 'scale(1.3)', opacity: 0 }],
      { duration: 380, easing: 'ease-out', fill: 'forwards' }).onfinish = () => flash.remove();

    // искры
    burstPoints(type, R).forEach(([dx, dy], i) => {
      const size = rnd(4, 6.5);
      const color = colors[i % colors.length];
      const spark = document.createElement('div');
      Object.assign(spark.style, {
        position: 'absolute', left: (x - size / 2) + 'px', top: (y - size / 2) + 'px',
        width: size + 'px', height: size + 'px', borderRadius: '50%',
        background: color, boxShadow: '0 0 8px ' + color
      });
      layer.appendChild(spark);
      const fall = rnd(35, 70);
      spark.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx * 1.05 + 'px, ' + (dy + fall) + 'px) scale(0.3)', opacity: 0 }
      ], { duration: rnd(1100, 1600), easing: 'cubic-bezier(0.12, 0.75, 0.3, 1)', fill: 'forwards' })
        .onfinish = () => spark.remove();
    });
  }

  function firework(vw, vh, delayMs, type) {
    const x = rnd(vw * 0.15, vw * 0.85);
    const y = rnd(vh * 0.14, vh * 0.48);
    const R = Math.min(vw, vh) * (vw < 520 ? 0.2 : 0.17);
    const colors = shuffle(FIRE_COLORS).slice(0, 2);

    setTimeout(() => {
      // ракета: светящаяся черта взлетает к точке взрыва
      const rocket = document.createElement('div');
      Object.assign(rocket.style, {
        position: 'absolute', left: (x - 1.5) + 'px', top: '0', width: '3px', height: '18px',
        background: 'linear-gradient(180deg, #fff, ' + colors[0] + ', transparent)', borderRadius: '2px'
      });
      layer.appendChild(rocket);
      rocket.animate(
        [{ transform: 'translateY(' + vh + 'px)' }, { transform: 'translateY(' + y + 'px)' }],
        { duration: 480, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' }
      ).onfinish = () => { rocket.remove(); explode(x, y, type, R, colors); };
    }, delayMs);
  }

  /* ================================================================
     ШАРИКИ: 4 стиля — пиксельный, мультяшный, «стикер», Temmie
     ================================================================ */
  let uid = 0;
  const BALLOON_COLORS = ['#e0453a', '#2f6bff', '#ffd23f', '#3ecf8e', '#ff7eb6', '#9b6bff'];

  // светлее (amt > 0) / темнее (amt < 0) цвета вида #rrggbb
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map(v => Math.round((t - v) * p + v).toString(16).padStart(2, '0')).join('');
  }

  // 1. пиксельный
  const PIXEL_MAP = [
    '...XXXX...',
    '..XHHXXX..',
    '.XHHXXXXD.',
    '.XHXXXXXD.',
    'XXXXXXXXDD',
    'XXXXXXXXDD',
    'XXXXXXXDDD',
    '.XXXXXXDD.',
    '.XXXXXDDD.',
    '..XXXDDD..',
    '...XDDD...',
    '....KK....',
    '....S.....',
    '.....S....',
    '....S.....',
    '.....S....',
    '....S.....'
  ];
  function svgPixel(color) {
    const fill = { X: color, H: shade(color, 0.5), D: shade(color, -0.3), K: shade(color, -0.45), S: '#d6cfdc' };
    let rects = '';
    PIXEL_MAP.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '.') { x++; continue; }
        let end = x;
        while (end + 1 < row.length && row[end + 1] === ch) end++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + (end - x + 1) + '" height="1" fill="' + fill[ch] + '"/>';
        x = end + 1;
      }
    });
    return '<svg viewBox="0 0 10 17" shape-rendering="crispEdges" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">' + rects + '</svg>';
  }

  // 2. мультяшный: глянец, чёрный контур, узелок
  function svgCartoon(color) {
    const id = 'bg' + (++uid);
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' +
      '<defs><radialGradient id="' + id + '" cx="0.35" cy="0.3" r="0.85">' +
      '<stop offset="0" stop-color="' + shade(color, 0.55) + '"/><stop offset="0.55" stop-color="' + color + '"/>' +
      '<stop offset="1" stop-color="' + shade(color, -0.3) + '"/></radialGradient></defs>' +
      '<path d="M50 102 C46 114 56 122 50 138" fill="none" stroke="#2b1c33" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="48" rx="38" ry="46" fill="url(#' + id + ')" stroke="#2b1c33" stroke-width="3.5"/>' +
      '<polygon points="43,103 57,103 50,93" fill="' + shade(color, -0.25) + '" stroke="#2b1c33" stroke-width="3" stroke-linejoin="round"/>' +
      '<ellipse cx="33" cy="27" rx="9" ry="15" fill="#fff" opacity="0.5" transform="rotate(25 33 27)"/>' +
      '</svg>';
  }

  // 3. «стикер»: белая вырубка, милое личико, тень
  function svgSticker(color) {
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))">' +
      '<path d="M50 100 C46 114 56 122 50 136" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="48" rx="38" ry="46" fill="#fff" stroke="#fff" stroke-width="11"/>' +
      '<polygon points="42,104 58,104 50,92" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>' +
      '<path d="M50 100 C46 114 56 122 50 136" fill="none" stroke="' + shade(color, -0.3) + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="48" rx="38" ry="46" fill="' + color + '"/>' +
      '<polygon points="43,102 57,102 50,93" fill="' + shade(color, -0.2) + '"/>' +
      '<path d="M22 36 Q25 20 40 14" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity="0.7"/>' +
      '<circle cx="38" cy="46" r="4.6" fill="#2b1c33"/><circle cx="62" cy="46" r="4.6" fill="#2b1c33"/>' +
      '<circle cx="39.6" cy="44.4" r="1.5" fill="#fff"/><circle cx="63.6" cy="44.4" r="1.5" fill="#fff"/>' +
      '<ellipse cx="29" cy="60" rx="6.5" ry="4" fill="#ff8fab" opacity="0.75"/><ellipse cx="71" cy="60" rx="6.5" ry="4" fill="#ff8fab" opacity="0.75"/>' +
      '<path d="M40 60 Q50 71 60 60" fill="none" stroke="#2b1c33" stroke-width="3.6" stroke-linecap="round"/>' +
      '</svg>';
  }

  // 4. Temmie (упрощённый рисунок «в духе»): белая мордочка-шарик, уши, большие глаза, «ω» и «hOI!»
  function svgTemmie() {
    const ink = '#22182a';
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))">' +
      '<path d="M50 106 C46 118 56 126 50 138" fill="none" stroke="#e8e4ec" stroke-width="2.6" stroke-linecap="round"/>' +
      '<polygon points="20,42 24,5 47,26" fill="#fff" stroke="' + ink + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<polygon points="80,42 76,5 53,26" fill="#fff" stroke="' + ink + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<polygon points="26,34 28,15 40,26" fill="#f3b6c8"/><polygon points="74,34 72,15 60,26" fill="#f3b6c8"/>' +
      '<ellipse cx="50" cy="58" rx="38" ry="38" fill="#fff" stroke="' + ink + '" stroke-width="3"/>' +
      '<ellipse cx="35" cy="54" rx="8" ry="10.5" fill="' + ink + '"/><ellipse cx="65" cy="54" rx="8" ry="10.5" fill="' + ink + '"/>' +
      '<circle cx="32.6" cy="49.5" r="3.2" fill="#fff"/><circle cx="62.6" cy="49.5" r="3.2" fill="#fff"/>' +
      '<ellipse cx="24" cy="72" rx="6" ry="3.6" fill="#f3b6c8" opacity="0.85"/><ellipse cx="76" cy="72" rx="6" ry="3.6" fill="#f3b6c8" opacity="0.85"/>' +
      '<path d="M37 75 Q43.5 85 50 75 Q56.5 85 63 75" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<polygon points="44,107 56,107 50,96" fill="#e8e4ec" stroke="' + ink + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<text x="60" y="124" transform="rotate(-8 60 124)" font-family="Pixelify Sans, monospace" font-size="19" fill="#fff8ec" ' +
        'stroke="' + ink + '" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">hOI!</text>' +
      '</svg>';
  }

  // 5. мишка: круглая мордочка с ушками (для дальних шариков)
  function svgBear() {
    const ink = '#3a2418', fur = '#b97a4a';
    return '<svg viewBox="0 0 100 140">' +
      '<path d="M50 106 C46 118 56 126 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.8" stroke-linecap="round"/>' +
      '<circle cx="24" cy="26" r="16" fill="' + fur + '" stroke="' + ink + '" stroke-width="3.5"/><circle cx="24" cy="26" r="7.5" fill="#e7b98f"/>' +
      '<circle cx="76" cy="26" r="16" fill="' + fur + '" stroke="' + ink + '" stroke-width="3.5"/><circle cx="76" cy="26" r="7.5" fill="#e7b98f"/>' +
      '<circle cx="50" cy="58" r="40" fill="' + fur + '" stroke="' + ink + '" stroke-width="3.5"/>' +
      '<ellipse cx="50" cy="71" rx="17" ry="13" fill="#f1d4a8"/>' +
      '<ellipse cx="50" cy="64" rx="6.5" ry="4.8" fill="' + ink + '"/>' +
      '<path d="M50 68 V73 M50 73 Q44 79 38 74 M50 73 Q56 79 62 74" fill="none" stroke="' + ink + '" stroke-width="2.8" stroke-linecap="round"/>' +
      '<circle cx="36" cy="50" r="4.8" fill="' + ink + '"/><circle cx="64" cy="50" r="4.8" fill="' + ink + '"/>' +
      '<circle cx="37.6" cy="48.4" r="1.6" fill="#fff"/><circle cx="65.6" cy="48.4" r="1.6" fill="#fff"/>' +
      '<ellipse cx="26" cy="66" rx="6" ry="3.8" fill="#ff8fab" opacity="0.65"/><ellipse cx="74" cy="66" rx="6" ry="3.8" fill="#ff8fab" opacity="0.65"/>' +
      '<polygon points="44,108 56,108 50,97" fill="' + shade(fur, -0.2) + '" stroke="' + ink + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // 6. просто цветной глянцевый шарик (без контура), для дальнего плана
  function svgPlain(color) {
    const id = 'bg' + (++uid);
    return '<svg viewBox="0 0 100 140">' +
      '<defs><radialGradient id="' + id + '" cx="0.35" cy="0.3" r="0.85">' +
      '<stop offset="0" stop-color="' + shade(color, 0.6) + '"/><stop offset="0.6" stop-color="' + color + '"/>' +
      '<stop offset="1" stop-color="' + shade(color, -0.25) + '"/></radialGradient></defs>' +
      '<path d="M50 102 C46 114 56 122 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="48" rx="38" ry="46" fill="url(#' + id + ')"/>' +
      '<polygon points="44,103 56,103 50,94" fill="' + shade(color, -0.3) + '"/>' +
      '<ellipse cx="34" cy="28" rx="8" ry="14" fill="#fff" opacity="0.4" transform="rotate(25 34 28)"/>' +
      '</svg>';
  }

  // 7. белое перевёрнутое сердце-душа (Undertale) в виде шарика
  const HEART_RUNS = [[[1, 2], [6, 2]], [[0, 4], [5, 4]], [[0, 9]], [[0, 9]], [[1, 7]], [[2, 5]], [[3, 3]], [[4, 1]]];   // строки сердца: [x, ширина]
  function svgSoul() {
    let rects = '';
    HEART_RUNS.forEach((runs, y) => {
      runs.forEach(([x, w]) => { rects += '<rect x="' + x + '" y="' + (7 - y) + '" width="' + w + '" height="1" fill="#fff"/>'; });   // 7 − y: вверх ногами
    });
    rects += '<rect x="4" y="8" width="1" height="1" fill="#bdb6c6"/>';                                                     // узелок
    [4, 5, 4, 5, 4].forEach((x, i) => { rects += '<rect x="' + x + '" y="' + (9 + i) + '" width="1" height="1" fill="#d6cfdc"/>'; });   // ниточка
    return '<svg viewBox="0 0 9 14" shape-rendering="crispEdges" style="filter:drop-shadow(0 0 5px rgba(255,255,255,.75))">' + rects + '</svg>';
  }

  // ---------- новые стили: звезда, сердце, «24», смайлик, котик ----------

  // градиент «фольги»
  function foilDefs(id, color) {
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + shade(color, 0.6) + '"/><stop offset="0.45" stop-color="' + color + '"/>' +
      '<stop offset="0.6" stop-color="' + shade(color, 0.35) + '"/><stop offset="1" stop-color="' + shade(color, -0.3) + '"/>' +
      '</linearGradient></defs>';
  }

  function starPoints(cx, cy, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 ? r : R;
      pts.push((cx + Math.cos(a) * rad).toFixed(1) + ',' + (cy + Math.sin(a) * rad).toFixed(1));
    }
    return pts.join(' ');
  }

  // 8. фольгированная звезда
  function svgStar(color) {
    const id = 'bg' + (++uid);
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' + foilDefs(id, color) +
      '<path d="M50 76 C46 100 56 120 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<polygon points="' + starPoints(50, 52, 48, 21) + '" fill="url(#' + id + ')" stroke="' + shade(color, -0.35) + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<polygon points="' + starPoints(50, 52, 30, 13) + '" fill="#fff" opacity="0.22"/>' +
      '<circle cx="50" cy="76" r="3.4" fill="' + shade(color, -0.35) + '"/>' +
      '</svg>';
  }

  // 9. фольгированное сердце
  function svgHeartBalloon(color) {
    const id = 'bg' + (++uid);
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' + foilDefs(id, color) +
      '<path d="M50 102 C46 114 56 124 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M50 94 C6 62 4 26 28 16 C40 11 50 19 50 30 C50 19 60 11 72 16 C96 26 94 62 50 94 Z" fill="url(#' + id + ')" stroke="' + shade(color, -0.35) + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M25 30 Q27 21 36 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>' +
      '<polygon points="44,105 56,105 50,94" fill="' + shade(color, -0.3) + '"/>' +
      '</svg>';
  }

  // 10. золотой шарик с числом «24»
  function svgNum24() {
    const id = 'bg' + (++uid);
    const gold = '#e8c26e';
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' + foilDefs(id, gold) +
      '<path d="M50 102 C46 114 56 124 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<rect x="8" y="6" width="84" height="86" rx="32" fill="url(#' + id + ')" stroke="' + shade(gold, -0.4) + '" stroke-width="3.5"/>' +
      '<text x="50" y="66" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="46" ' +
        'fill="#7c2a1c" stroke="#fff8ec" stroke-width="1.6" paint-order="stroke">24</text>' +
      '<path d="M22 30 Q26 16 40 12" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity="0.6"/>' +
      '<polygon points="44,104 56,104 50,93" fill="' + shade(gold, -0.35) + '"/>' +
      '</svg>';
  }

  // 11. смайлик
  function svgSmile(color) {
    const id = 'bg' + (++uid);
    const c = pick(['#ffd23f', '#ffb347', '#ff9ecb', color]);
    const ink = '#2b1c33';
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' +
      '<defs><radialGradient id="' + id + '" cx="0.35" cy="0.3" r="0.85">' +
      '<stop offset="0" stop-color="' + shade(c, 0.55) + '"/><stop offset="0.6" stop-color="' + c + '"/><stop offset="1" stop-color="' + shade(c, -0.25) + '"/></radialGradient></defs>' +
      '<path d="M50 102 C46 114 56 122 50 138" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="48" rx="38" ry="46" fill="url(#' + id + ')" stroke="' + ink + '" stroke-width="3.5"/>' +
      '<ellipse cx="36" cy="38" rx="4.4" ry="7" fill="' + ink + '"/><ellipse cx="64" cy="38" rx="4.4" ry="7" fill="' + ink + '"/>' +
      '<path d="M27 56 Q50 90 73 56" fill="none" stroke="' + ink + '" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="24" cy="54" rx="6" ry="4" fill="#ff8fab" opacity="0.55"/><ellipse cx="76" cy="54" rx="6" ry="4" fill="#ff8fab" opacity="0.55"/>' +
      '<polygon points="43,103 57,103 50,93" fill="' + shade(c, -0.3) + '" stroke="' + ink + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<ellipse cx="33" cy="26" rx="8" ry="13" fill="#fff" opacity="0.45" transform="rotate(25 33 26)"/>' +
      '</svg>';
  }

  // 12. котик
  function svgCat(color) {
    const ink = '#2b1c33';
    return '<svg viewBox="0 0 100 140" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">' +
      '<path d="M50 106 C46 118 56 126 50 138" fill="none" stroke="#d6cfdc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<polygon points="15,42 21,8 45,26" fill="' + color + '" stroke="' + ink + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<polygon points="85,42 79,8 55,26" fill="' + color + '" stroke="' + ink + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<polygon points="22,34 25,17 38,27" fill="#f3b6c8"/><polygon points="78,34 75,17 62,27" fill="#f3b6c8"/>' +
      '<ellipse cx="50" cy="58" rx="38" ry="36" fill="' + color + '" stroke="' + ink + '" stroke-width="3.5"/>' +
      '<ellipse cx="36" cy="52" rx="4.2" ry="6.4" fill="' + ink + '"/><ellipse cx="64" cy="52" rx="4.2" ry="6.4" fill="' + ink + '"/>' +
      '<circle cx="37.4" cy="49.6" r="1.6" fill="#fff"/><circle cx="65.4" cy="49.6" r="1.6" fill="#fff"/>' +
      '<polygon points="46,64 54,64 50,69.5" fill="#f3b6c8" stroke="' + ink + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M50 69.5 V73 M50 73 Q45 78 40 74 M50 73 Q55 78 60 74" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M12 62 L28 65 M12 72 L28 70 M88 62 L72 65 M88 72 L72 70" stroke="' + ink + '" stroke-width="2" stroke-linecap="round"/>' +
      '<polygon points="44,106 56,106 50,95" fill="' + shade(color, -0.3) + '" stroke="' + ink + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '</svg>';
  }

  const BALLOONS = {
    pixel:   { svg: svgPixel,        ratio: 1.7 },
    cartoon: { svg: svgCartoon,      ratio: 1.4 },
    sticker: { svg: svgSticker,      ratio: 1.4 },
    temmie:  { svg: svgTemmie,       ratio: 1.4 },
    bear:    { svg: svgBear,         ratio: 1.4 },
    plain:   { svg: svgPlain,        ratio: 1.4 },
    soul:    { svg: svgSoul,         ratio: 14 / 9 },
    star:    { svg: svgStar,         ratio: 1.4 },
    hearty:  { svg: svgHeartBalloon, ratio: 1.4 },
    num24:   { svg: svgNum24,        ratio: 1.4 },
    smile:   { svg: svgSmile,        ratio: 1.4 },
    cat:     { svg: svgCat,          ratio: 1.4 }
  };

  // far = дальний шарик: мельче, чуть бледнее и размытее, плывёт медленнее
  function balloon(kind, w, x, delayMs, vh, far) {
    const def = BALLOONS[kind];
    const h = w * def.ratio;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute', left: Math.round(x - w / 2) + 'px', top: '0',
      width: Math.round(w) + 'px', height: Math.round(h) + 'px', willChange: 'transform'
    });
    if (far) { el.style.opacity = '0.8'; el.style.filter = 'blur(0.6px)'; }
    el.innerHTML = def.svg(pick(BALLOON_COLORS));
    const svg = el.firstChild;
    svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; svg.style.overflow = 'visible';
    layer.appendChild(el);

    // подъём снизу вверх (до старта прячется за нижним краем)
    const rise = el.animate(
      [{ transform: 'translateY(' + (vh + 30) + 'px)' }, { transform: 'translateY(' + (-h - 50) + 'px)' }],
      { duration: far ? rnd(11000, 15000) : rnd(7500, 10500), delay: delayMs, easing: 'cubic-bezier(0.25, 0.1, 0.6, 1)', fill: 'both' }
    );
    // покачивание вбок и лёгкий наклон
    el.animate(
      [{ translate: '0px 0', rotate: '-3.5deg' }, { translate: Math.round((far ? rnd(8, 18) : rnd(16, 34)) * (Math.random() < 0.5 ? -1 : 1)) + 'px 0', rotate: '3.5deg' }],
      { duration: far ? rnd(3200, 4600) : rnd(2200, 3400), delay: delayMs, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
    );
    rise.onfinish = () => el.remove();
  }

  function balloons(vw, vh) {
    const phone = vw < 520;
    const nearCount = phone ? 6 : 10;                              // ближних шариков (было 3 и 5 — удвоено)
    const farCount = phone ? 4 : 6;                                // дальних (было 2 и 3 — удвоено)
    const base = phone ? vw * 0.2 : Math.min(112, Math.max(70, vw * 0.075));

    // ДАЛЬНИЙ ПЛАН (создаётся первым, чтобы лежать «позади»): мишка и белое перевёрнутое сердце —
    // всегда; остальные из набора вперемешку. Все мелкие.
    const farKinds = ['bear', 'soul'].concat(shuffle(['plain', 'hearty', 'star', 'smile', 'cat'])).slice(0, farCount);
    const farSlots = shuffle(Array.from({ length: farKinds.length }, (_, i) => i));
    const farSlotW = vw / farKinds.length;
    farKinds.forEach((kind, i) => {
      const x = farSlotW * (farSlots[i] + 0.5) + rnd(-farSlotW * 0.2, farSlotW * 0.2);
      balloon(kind, base * rnd(0.36, 0.52), x, rnd(200, 4500), vh, true);
    });

    // БЛИЖНИЙ ПЛАН: Temmie и «24» — всегда; остальные стили вперемешку,
    // повторы (другим цветом) только когда стили кончились
    const NEAR = ['pixel', 'cartoon', 'sticker', 'star', 'hearty', 'smile', 'cat'];
    const kinds = ['temmie', 'num24'].concat(shuffle(NEAR));
    while (kinds.length < nearCount) kinds.push(pick(NEAR));
    kinds.length = nearCount;

    // экран делится на полосы, шарики по полосам вперемешку — не слипаются
    const slots = shuffle(Array.from({ length: nearCount }, (_, i) => i));
    const slotW = vw / nearCount;
    for (let i = 0; i < nearCount; i++) {
      const x = slotW * (slots[i] + 0.5) + rnd(-slotW * 0.18, slotW * 0.18);
      balloon(kinds[i], base * rnd(0.7, 1.4), x, rnd(300, 4200), vh);   // размеры разные
    }
  }

  /* ================================================================
     ЗАЛП: всё вместе
     ================================================================ */
  function launch() {
    if (reduced()) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const k = vw < 520 ? 0.6 : 1;                                  // на телефоне частиц меньше

    const flash = document.createElement('div');
    flash.className = 'confetti-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);

    // залпы конфетти из нижних углов
    [{ x: vw * 0.03, dir: 1 }, { x: vw * 0.97, dir: -1 }].forEach(o => {
      const origin = { x: o.x, y: vh * 0.96, dir: o.dir };
      for (let i = 0; i < Math.round(34 * k); i++) makeParticle('burst', vw, vh, origin);
    });

    // дождь конфетти сверху
    for (let i = 0; i < Math.round(90 * k); i++) makeParticle('fall', vw, vh);

    // салют: три взрыва сразу, а остальные — волнами, пока плывут шарики (~10 секунд)
    const fireTotal = vw < 520 ? 5 : 8;
    const figures = shuffle(['heart', 'ring', 'star', 'double', 'heart', 'star', 'ring', 'double']);
    for (let i = 0; i < fireTotal; i++) {
      const delay = i < 3
        ? 250 + i * rnd(450, 650)
        : 2600 + (i - 3) * (6900 / Math.max(1, fireTotal - 3)) + rnd(-300, 300);
      firework(vw, vh, Math.max(250, delay), figures[i % figures.length]);
    }

    // шарики
    balloons(vw, vh);

    // подстраховка: через 24 с слой точно пустой (самый дальний шарик летит до ~20 с)
    setTimeout(() => { layer.textContent = ""; }, 24000);
  }

  /* ---------- последовательность после задувания ---------- */
  let running = false;

  function sequence() {
    if (running) return;
    running = true;

    setTimeout(() => { if (window.Sound) window.Sound.chime(); }, T_BEFORE_CHIME);
    setTimeout(launch, T_BEFORE_CHIME + T_PAUSE_AFTER_CHIME);
    setTimeout(() => {
      running = false;
      Scenes.next();                                               // → письмо
    }, T_BEFORE_CHIME + T_PAUSE_AFTER_CHIME + T_TO_LETTER);
  }

  document.addEventListener('cake:done', sequence);

  window.Confetti = { launch };
})();
