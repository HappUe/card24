/*
  pagefx.js — глитчи всей страницы в духе Undertale.
  Стили лежат в src/css/effects.css (разделы «ГЛИТЧИ СТРАНИЦЫ», «ДУШИ», «ЕЩЁ СБОИ»).

  ────────── ОКНА: страница осыпается рваными осколками ──────────
  Поверх страницы строится слой. В нём — рваные осколки-треугольники (в каждом копия
  текущей сцены, так что осколок выглядит как настоящий кусок страницы вместе с текстом).
  Осколки быстро дрожат и сыплются вниз, открывая чёрную дыру с рваным краем.
  Потом страница «собирается» обратно с глюком, и слой убирается.

    PageFX.crumble()      просто осыпание и мгновенное восстановление
    PageFX.heartHole()    зелёное сердце → белое перевёрнутое → окно исчезает
    PageFX.blueHole()     большое синее сердце падает на дно окна (гравитация)
    PageFX.carouselHole() маленькие жёлтое и красное сердца ходят по кругу, сменяя друг друга
    PageFX.brokenHole()   красное сердце → трескается → золотое, но меньше

  Параметры окон (все необязательные): w, h («обычный» размер), zone ('any'|'left'|'right'|'top'|'bottom'),
  rect ({x,y,w,h}), cell (размер осколка), hold (пауза в дыре, мс), heart (размер сердца),
  scale (множитель размера; по умолчанию случайный от 0,6 до 1,25 — см. SCALE_MIN/SCALE_MAX ниже).
  Каждая функция возвращает Promise<boolean>. Одновременно идёт не больше 2 окон.

  ────────── ЛЁГКИЕ СБОИ: можно запускать в любой момент, даже пока печатается текст ──────────
    PageFX.tear()         горизонтальные полосы страницы съезжают в стороны
    PageFX.artifacts()    россыпь мелких мигающих «битых» блоков на фоне
    PageFX.scan()         световая полоса пробегает по экрану сверху вниз
    PageFX.staticNoise()  помехи, как у телевизора
    PageFX.shake()        сцена дёргается
    PageFX.invert()       цвета на миг выворачиваются

    const stop = PageFX.ambient(() => Scenes.current() === 'wishes', { min: 2200, max: 5200 });
        сам случайно запускает лёгкие сбои, пока isActive() возвращает true; stop() выключает.

  PageFX.clear() — оборвать всё и убрать (при смене сцены).   PageFX.busy() — идёт ли окно.
*/
(function () {
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const glitchSound = () => { if (window.Sound) window.Sound.glitch(); };
  const thud = () => { if (window.Sound) window.Sound.blip(150); };

  const MAX_WINDOWS = 2;
  const windows = new Set();     // идущие сейчас окна
  const light = new Set();       // временные элементы лёгких сбоев
  const timers = new Set();      // таймеры лёгких сбоев

  /* ---------- вспомогательное ---------- */
  function later(fn, ms) {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  }

  function box(cls, r) {
    const d = document.createElement('div');
    d.className = cls;
    if (r) {
      d.style.left = r.x + 'px'; d.style.top = r.y + 'px';
      d.style.width = r.w + 'px'; d.style.height = r.h + 'px';
    }
    return d;
  }

  function viewport() {
    return { w: document.documentElement.clientWidth, h: window.innerHeight };
  }

  /* копия текущей сцены — клонируется в осколки и полосы */
  function sceneTemplate() {
    const view = document.getElementById('view-' + window.Scenes.current());
    const tpl = view.cloneNode(true);
    tpl.removeAttribute('id');
    tpl.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));   // без дубликатов id
    return tpl;
  }

  /* внутренность осколка/полосы: копия сцены, сдвинутая на -x,-y */
  function sceneInner(tpl, x, y) {
    const vp = viewport();
    const inner = document.createElement('div');
    inner.className = 'fx-tile-inner';
    inner.style.width = vp.w + 'px';
    inner.style.height = vp.h + 'px';
    inner.style.left = -x + 'px';
    inner.style.top = -(y + window.scrollY) + 'px';
    inner.appendChild(tpl.cloneNode(true));
    return inner;
  }

  /* ---------- запуск с возможностью прервать ---------- */
  function newRun() {
    const run = { cancelled: false, layer: null, _waits: [] };
    run.wait = ms => new Promise(resolve => {
      let entry;
      const t = setTimeout(() => {
        run._waits = run._waits.filter(w => w !== entry);
        resolve(true);
      }, ms);
      entry = { t, resolve };
      run._waits.push(entry);
    });
    run.cancel = () => {
      run.cancelled = true;
      run._waits.forEach(w => { clearTimeout(w.t); w.resolve(false); });
      run._waits = [];
    };
    return run;
  }

  function startRun() {
    if (reduced() || windows.size >= MAX_WINDOWS) return null;
    const run = newRun();
    windows.add(run);
    return run;
  }

  function finish(run, ok) {
    if (run.layer) run.layer.remove();
    windows.delete(run);
    return ok;
  }

  /* ---------- размер окна ----------
     Каждое окно получает случайный множитель к заданному размеру: от 0,6 (на 40% меньше)
     до 1,25 (на 25% больше). Соседние окна заметно отличаются друг от друга (не меньше
     чем на MIN_SCALE_GAP). Сердца и орбиты внутри масштабируются вместе с окном. */
  const SCALE_MIN = 0.6, SCALE_MAX = 1.25, MIN_SCALE_GAP = 0.25;
  let lastScale = 1;

  function pickScale() {
    let s, tries = 0;
    do { s = rnd(SCALE_MIN, SCALE_MAX); } while (Math.abs(s - lastScale) < MIN_SCALE_GAP && ++tries < 30);
    lastScale = s;
    return s;
  }

  /* ---------- где рисовать ---------- */
  function pickRect(opts) {
    if (opts.rect) return opts.rect;
    const vp = viewport();
    const m = 16;
    const baseW = Math.min(opts.w || rnd(190, 270), vp.w - 2 * m);     // «обычный» размер
    const baseH = Math.min(opts.h || rnd(140, 200), vp.h - 2 * m);
    const wanted = opts.scale || pickScale();
    const w = Math.min(baseW * wanted, vp.w - 2 * m);
    const h = Math.min(baseH * wanted, vp.h - 2 * m);
    const scale = w / baseW;                                            // во сколько раз реально вышло
    const range = (min, max) => [Math.min(min, max), Math.max(min, max)];
    let xr = range(m, vp.w - w - m);
    let yr = range(m, vp.h - h - m);
    switch (opts.zone) {
      case 'left':   xr = range(m, vp.w * 0.38 - w); break;
      case 'right':  xr = range(vp.w * 0.62, vp.w - w - m); break;
      case 'top':    yr = range(m, vp.h * 0.35 - h); break;
      case 'bottom': yr = range(vp.h * 0.6, vp.h - h - m); break;
    }
    return { x: Math.round(rnd(xr[0], xr[1])), y: Math.round(rnd(yr[0], yr[1])), w: Math.round(w), h: Math.round(h), scale };
  }

  /* ---------- рваные осколки ----------
     Сетка вершин со случайным смещением; каждая ячейка режется на два треугольника.
     Соседние осколки делят вершины, поэтому щелей между ними нет, а внешний край рваный. */
  function buildWindow(rect, cellHint) {
    const vp = viewport();
    const layer = box('fx-layer');
    layer.setAttribute('aria-hidden', 'true');

    const base = cellHint || 46;
    let cols = Math.max(2, Math.round(rect.w / base));
    let rows = Math.max(2, Math.round(rect.h / base));
    while (cols * rows > 30 && (cols > 2 || rows > 2)) {          // не больше ~60 осколков
      cols = Math.max(2, cols - 1);
      rows = Math.max(2, rows - 1);
    }
    const cw = rect.w / cols, ch = rect.h / rows;

    const V = [];
    for (let r = 0; r <= rows; r++) {
      V[r] = [];
      for (let c = 0; c <= cols; c++) {
        const edge = r === 0 || c === 0 || r === rows || c === cols;
        const k = edge ? 0.35 : 0.25;                             // по краю рвём сильнее
        V[r][c] = {
          x: Math.min(vp.w, Math.max(0, rect.x + c * cw + rnd(-k, k) * cw)),
          y: Math.min(vp.h, Math.max(0, rect.y + r * ch + rnd(-k, k) * ch))
        };
      }
    }

    const bbox = pts => {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    };
    const clip = (pts, b) => 'polygon(' + pts.map(p => (p.x - b.x).toFixed(1) + 'px ' + (p.y - b.y).toFixed(1) + 'px').join(', ') + ')';

    // чёрная дыра по внешнему контуру сетки
    const outline = [];
    for (let c = 0; c <= cols; c++) outline.push(V[0][c]);
    for (let r = 1; r <= rows; r++) outline.push(V[r][cols]);
    for (let c = cols - 1; c >= 0; c--) outline.push(V[rows][c]);
    for (let r = rows - 1; r >= 1; r--) outline.push(V[r][0]);
    const ob = bbox(outline);
    const voidEl = box('fx-void', ob);
    voidEl.style.clipPath = clip(outline, ob);
    layer.appendChild(voidEl);

    // осколки
    const tpl = sceneTemplate();
    const seed = { x: rect.x + rnd(0, rect.w), y: rect.y + rnd(0, rect.h) };   // отсюда начинает сыпаться
    let maxEnd = 0;

    const addShard = pts => {
      const b = bbox(pts);
      const tile = box('fx-tile', b);
      tile.style.clipPath = clip(pts, b);
      tile.appendChild(sceneInner(tpl, b.x, b.y));

      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const delay = Math.hypot((cx - seed.x) / cw, (cy - seed.y) / ch) * 0.035 + rnd(0, 0.08);
      const dur = rnd(0.34, 0.7);
      tile.style.setProperty('--delay', delay.toFixed(2) + 's');
      tile.style.setProperty('--dur', dur.toFixed(2) + 's');
      tile.style.setProperty('--dx', Math.round(rnd(-40, 40)) + 'px');
      tile.style.setProperty('--fall', Math.round(vp.h - b.y + rnd(40, 140)) + 'px');
      tile.style.setProperty('--rot', Math.round(rnd(-70, 70)) + 'deg');
      maxEnd = Math.max(maxEnd, delay + 0.15 + dur);
      layer.appendChild(tile);
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = V[r][c], b = V[r][c + 1], d = V[r + 1][c + 1], e = V[r + 1][c];
        if (Math.random() < 0.5) { addShard([a, b, d]); addShard([a, d, e]); }
        else                     { addShard([a, b, e]); addShard([b, d, e]); }
      }
    }

    return { layer, seconds: maxEnd, box: ob, cx: ob.x + ob.w / 2, cy: ob.y + ob.h / 2, scale: rect.scale || 1 };
  }

  /* окно открывается: осколки сыплются. false — прервали. */
  async function openWindow(run, rect, opts) {
    const built = buildWindow(rect, opts.cell);
    run.layer = built.layer;
    run.geo = built;
    document.body.appendChild(built.layer);
    glitchSound();
    if (!await run.wait(30)) return false;        // дать браузеру отрисовать осколки
    built.layer.classList.add('falling');
    return run.wait(built.seconds * 1000 + 80);
  }

  /* окно закрывается: страница «собирается обратно с глюком» */
  async function closeWindow(run) {
    glitchSound();
    run.layer.classList.remove('falling');
    run.layer.classList.add('restoring');
    return run.wait(260);
  }

  /* ---------- сердца ---------- */
  function makeHeart(run, cls, size, cx, cy) {
    const h = document.createElement('div');
    h.className = 'fx-heart ' + cls;
    h.style.setProperty('--heart', size + 'px');
    h.style.left = Math.round(cx - size / 2) + 'px';
    h.style.top = Math.round(cy - (size * 8 / 9) / 2) + 'px';
    h.appendChild(Object.assign(document.createElement('i'), { className: 'fx-heart-shape' }));
    run.layer.appendChild(h);
    return h;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- окна ---------- */

  // 1. просто осыпание
  async function crumble(opts) {
    opts = opts || {};
    const run = startRun(); if (!run) return false;
    if (!await openWindow(run, pickRect(opts), opts)) return false;
    if (!await run.wait(opts.hold === undefined ? 420 : opts.hold)) return false;
    if (!await closeWindow(run)) return false;
    return finish(run, true);
  }

  // 2. зелёное → белое перевёрнутое
  async function heartHole(opts) {
    opts = opts || {};
    const run = startRun(); if (!run) return false;
    if (!await openWindow(run, pickRect(opts), opts)) return false;
    if (!await run.wait(300)) return false;

    const g = run.geo;
    const heart = makeHeart(run, 'h-green', opts.heart || clamp(Math.min(g.box.w, g.box.h) * 0.36, 30 * g.scale, 46 * g.scale), g.cx, g.cy);
    if (!await run.wait(30)) return false;
    heart.classList.add('appear');

    if (!await run.wait(1500)) return false;
    glitchSound();
    heart.classList.add('white', 'flipped', 'flip-glitch');

    if (!await run.wait(1300)) return false;
    if (!await closeWindow(run)) return false;
    return finish(run, true);
  }

  // 3. большое синее: падает на дно окна
  async function blueHole(opts) {
    opts = opts || {};
    const run = startRun(); if (!run) return false;
    if (!await openWindow(run, pickRect(opts), opts)) return false;
    if (!await run.wait(300)) return false;

    const g = run.geo;
    const size = opts.heart || clamp(Math.min(g.box.w, g.box.h) * 0.52, 44 * g.scale, 86 * g.scale);
    const heartH = size * 8 / 9;
    const startY = g.box.y + g.box.h * 0.32;                      // появляется выше центра
    const heart = makeHeart(run, 'h-blue', size, g.cx, startY);
    if (!await run.wait(30)) return false;
    heart.classList.add('appear');
    if (!await run.wait(650)) return false;

    // гравитация: падает на дно и чуть подпрыгивает
    const drop = Math.max(0, g.box.y + g.box.h - heartH / 2 - 14 - startY);
    heart.animate([
      { translate: '0 0', offset: 0 },
      { translate: '0 ' + drop + 'px', offset: 0.55, easing: 'ease-out' },
      { translate: '0 ' + drop * 0.86 + 'px', offset: 0.75, easing: 'ease-in' },
      { translate: '0 ' + drop + 'px', offset: 1 }
    ], { duration: 620, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
    if (!await run.wait(560)) return false;
    thud();

    if (!await run.wait(1500)) return false;
    if (!await closeWindow(run)) return false;
    return finish(run, true);
  }

  // 4. «карусель»: жёлтое и красное по кругу, сменяя друг друга
  async function carouselHole(opts) {
    opts = opts || {};
    const run = startRun(); if (!run) return false;
    if (!await openWindow(run, pickRect(opts), opts)) return false;
    if (!await run.wait(300)) return false;

    const g = run.geo;
    const size = opts.heart || clamp(Math.min(g.box.w, g.box.h) * 0.16, 18 * g.scale, 26 * g.scale);
    const radius = clamp(g.box.w * 0.24, 24 * g.scale, 52 * g.scale);
    [['h-yellow', ''], ['h-red', 'rev']].forEach(([color, rev]) => {
      const orbit = document.createElement('div');
      orbit.className = 'fx-orbit ' + rev;
      orbit.style.left = Math.round(g.cx) + 'px';
      orbit.style.top = Math.round(g.cy) + 'px';
      orbit.style.setProperty('--orbit', radius + 'px');
      orbit.style.setProperty('--orbit-time', '0.95s');
      orbit.style.setProperty('--heart', size + 'px');
      const heart = document.createElement('div');
      heart.className = 'fx-heart appear ' + color;
      heart.appendChild(Object.assign(document.createElement('i'), { className: 'fx-heart-shape' }));
      orbit.appendChild(heart);
      run.layer.appendChild(orbit);
    });

    if (!await run.wait(2600)) return false;
    if (!await closeWindow(run)) return false;
    return finish(run, true);
  }

  // 5. красное → трескается → золотое, но меньше
  async function brokenHole(opts) {
    opts = opts || {};
    const run = startRun(); if (!run) return false;
    if (!await openWindow(run, pickRect(opts), opts)) return false;
    if (!await run.wait(300)) return false;

    const g = run.geo;
    const heart = makeHeart(run, 'h-red', opts.heart || clamp(Math.min(g.box.w, g.box.h) * 0.34, 32 * g.scale, 52 * g.scale), g.cx, g.cy);
    if (!await run.wait(30)) return false;
    heart.classList.add('appear');

    if (!await run.wait(950)) return false;
    heart.classList.remove('appear');
    heart.classList.add('shake');                                 // дрожит…
    if (!await run.wait(450)) return false;

    glitchSound();
    heart.classList.remove('shake');
    heart.classList.add('cracked');                               // …и трескается
    if (!await run.wait(950)) return false;

    glitchSound();
    heart.classList.remove('h-red');
    heart.classList.add('h-gold', 'shrunk', 'swap');              // золотое, но меньше
    if (!await run.wait(1500)) return false;

    if (!await closeWindow(run)) return false;
    return finish(run, true);
  }

  /* ================== ЛЁГКИЕ СБОИ ================== */

  function track(el, ms, parent) {
    (parent || document.body).appendChild(el);
    light.add(el);
    later(() => { el.remove(); light.delete(el); }, ms);
    return el;
  }

  // полосы страницы съезжают в стороны
  function tear() {
    if (reduced()) return false;
    const vp = viewport();
    const layer = box('fx-layer');
    layer.setAttribute('aria-hidden', 'true');
    const tpl = sceneTemplate();
    const n = rint(3, 6);
    for (let i = 0; i < n; i++) {
      const h = rint(10, 46);
      const y = Math.round(rnd(0, vp.h - h));
      const strip = box('fx-strip', { x: 0, y, w: vp.w, h });
      strip.style.left = '0'; strip.style.right = '0'; strip.style.width = '';
      strip.style.setProperty('--sx', (Math.random() < 0.5 ? -1 : 1) * Math.round(rnd(18, 70)) + 'px');
      strip.style.setProperty('--sdur', rnd(0.22, 0.4).toFixed(2) + 's');
      strip.appendChild(sceneInner(tpl, 0, y));
      layer.appendChild(strip);
    }
    glitchSound();
    track(layer, 520);
    return true;
  }

  // россыпь битых блоков
  function artifacts() {
    if (reduced()) return false;
    const vp = viewport();
    const colors = ['var(--glitch-a)', 'var(--glitch-b)', '#fff', '#000', 'var(--gold)'];
    const n = rint(5, 12);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed', zIndex: 26, pointerEvents: 'none',
        left: Math.round(rnd(0, vp.w)) + 'px', top: Math.round(rnd(0, vp.h)) + 'px',
        width: rint(6, 90) + 'px', height: rint(3, 14) + 'px',
        background: pick(colors),
        mixBlendMode: Math.random() < 0.35 ? 'difference' : 'normal',
        opacity: 0
      });
      track(el, 520);
      const dur = rnd(180, 420);
      el.animate(
        [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }, { opacity: 0.7, transform: 'translateX(' + rint(-14, 14) + 'px)' }, { opacity: 0 }],
        { duration: dur, delay: rnd(0, 160), easing: 'steps(1)', fill: 'forwards' }
      );
    }
    return true;
  }

  // световая полоса развёртки
  function scan() {
    if (reduced()) return false;
    const vp = viewport();
    const bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    Object.assign(bar.style, {
      position: 'fixed', left: 0, right: 0, top: 0, height: '70px', zIndex: 26, pointerEvents: 'none',
      background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)'
    });
    track(bar, 760);
    bar.animate(
      [{ transform: 'translateY(-80px)' }, { transform: 'translateY(' + (vp.h + 10) + 'px)' }],
      { duration: 700, easing: 'linear', fill: 'forwards' }
    );
    return true;
  }

  // телевизионные помехи
  function staticNoise() {
    if (reduced()) return false;
    let el = document.querySelector('.fx-static');
    if (!el) { el = document.createElement('div'); el.className = 'fx-static'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    el.classList.remove('on');
    void el.offsetWidth;                          // перезапустить анимацию
    el.classList.add('on');
    later(() => el.classList.remove('on'), 360);
    return true;
  }

  // встряска сцены
  function shake() {
    if (reduced()) return false;
    const app = document.getElementById('app');
    glitchSound();
    app.classList.add('fx-shake');
    later(() => app.classList.remove('fx-shake'), 320);
    return true;
  }

  // мигающая инверсия цветов
  function invert() {
    if (reduced()) return false;
    const root = document.documentElement;
    [[0, true], [80, false], [140, true], [200, false]].forEach(([ms, on]) =>
      later(() => root.classList.toggle('fx-invert', on), ms));
    return true;
  }

  /* ---------- сам запускает лёгкие сбои, пока isActive() истинно ---------- */
  function ambient(isActive, opts) {
    opts = opts || {};
    if (reduced()) return function stop() {};
    const min = opts.min || 2200, max = opts.max || 5200;
    // [действие, вес]: чем больше вес, тем чаще
    const pool = [[artifacts, 5], [scan, 3], [staticNoise, 2], [tear, 3], [shake, 1.5], [invert, 1]];
    const quiet = [[artifacts, 5], [scan, 3]];      // пока идёт окно — только мелочи
    let timer = null, stopped = false;

    const fire = () => {
      const list = windows.size ? quiet : pool;
      let roll = Math.random() * list.reduce((s, p) => s + p[1], 0);
      for (const [fn, weight] of list) { if ((roll -= weight) <= 0) { fn(); return; } }
    };
    (function loop() {
      timer = setTimeout(() => {
        if (stopped) return;
        if (!isActive || isActive()) fire();
        loop();
      }, rnd(min, max));
    })();
    return function stop() { stopped = true; clearTimeout(timer); };
  }

  /* ---------- оборвать всё ---------- */
  function clear() {
    windows.forEach(run => { run.cancel(); finish(run, false); });
    windows.clear();
    light.forEach(el => el.remove());
    light.clear();
    timers.forEach(clearTimeout);
    timers.clear();
    const root = document.documentElement;
    root.classList.remove('fx-invert');
    const app = document.getElementById('app');
    if (app) app.classList.remove('fx-shake');
    const st = document.querySelector('.fx-static');
    if (st) st.classList.remove('on');
  }

  window.PageFX = {
    crumble, heartHole, blueHole, carouselHole, brokenHole,
    tear, artifacts, scan, staticNoise, shake, invert,
    ambient, clear, busy: () => windows.size > 0
  };
})();
