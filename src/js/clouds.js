/*
  clouds.js — «облака» слов на заднем плане.

  Сквозной слой: появляется с началом пожеланий и живёт до открытия конверта
  (торт, конфетти и шарики — поверх него). Стили — src/css/scenes/clouds.css,
  фразы — content/clouds.js.

  Что делает:
    • 8–10 заметных облаков (шрифт ~14 px) и 4–6 малых (~9 px); на телефоне меньше.
      Облака расставляются по краям и не заходят в центр, где основной текст.
    • У каждого облака свой шрифт (из 18, все разные одновременно). Шрифт меняется
      у каждого по своему таймеру: у части раз в 3–5 с, у остальных раз в 5–8 с.
    • Примерно раз в 10 с облако гаснет, берёт другую фразу и в другом месте проявляется.
    • Выбор фраз: «колода» — категория перетасована, фразы не повторяются, пока колода
      не пройдена; точная копия уже видимой фразы не берётся никогда; малые облака берут
      только короткие фразы. Тасуется заново при каждой загрузке страницы.
    • «Личные» фразы (glitch: true в подборке) глючат: срез, переворот, дёрганье,
      замена букв мусорными символами — без цвета.
    • После клика по конверту облака испаряются: часть плавно растворяется, часть
      теряет по нескольку символов «глюком», потом исчезает.

  Управление (обычно не нужно — всё запускается само):
    Clouds.start()      Clouds.evaporate()      Clouds.stop()
*/
(function () {
  /* ---------- настройки ---------- */
  const COUNTS = {
    desktop: { normal: [8, 10], small: [4, 6] },
    phone:   { normal: [4, 5],  small: [3, 3] }     // телефон: экран узкий, облаков меньше
  };
  const FONT_COUNT = 18;                            // классы .f0 … .f17 в clouds.css
  const FONT_FAST = [3000, 5000];                   // часть облаков меняет шрифт раз в 3–5 с
  const FONT_SLOW = [5000, 8000];                   // остальные — раз в 5–8 с
  const TEXT_EVERY = 10000;                         // смена фразы ≈ раз в 10 с
  const TEXT_JITTER = 1200;
  const FADE_MS = 1300;                             // сколько облако гаснет перед сменой фразы
  const SHORT_MAX = 32;                             // малые облака берут фразы не длиннее этого
  const GLITCH_EVERY = [2200, 4200];                // как часто глючат «личные» облака
  const NOISE = '▒░▓█#%&@$?!¤§<>/\\|';

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // текст без регистра, знаков и переносов: так «Ты классный!» и «ты  классный» — одно и то же
  const norm = s => s.toLowerCase().replace(/[^0-9a-zа-яё]/g, '');

  /* ---------- слой ---------- */
  let layer = document.getElementById('clouds-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'clouds-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(layer, document.body.firstChild);
  }

  /* ================================================================
     ВЫБОР ФРАЗ: перетасованные колоды по категориям
     ================================================================ */
  let pools = [];

  function buildPools() {
    const data = window.CLOUD_PHRASES || {};
    pools = Object.keys(data).map(key => {
      const cat = data[key];
      const all = (cat.phrases || []).map(p => {
        const text = typeof p === 'string' ? p : p.text;
        return { text, glitch: typeof p === 'object' && !!p.glitch, norm: norm(text), short: text.length <= SHORT_MAX };
      });
      return { key, weight: cat.weight === undefined ? 1 : cat.weight, all, deck: [] };
    }).filter(p => p.weight > 0 && p.all.length);
  }

  const refill = pool => { pool.deck = shuffle(pool.all.slice()); };

  function chooseCategory(needShort) {
    const list = pools.filter(p => !needShort || p.all.some(e => e.short));
    let roll = Math.random() * list.reduce((s, p) => s + p.weight, 0);
    for (const p of list) { if ((roll -= p.weight) <= 0) return p; }
    return list[list.length - 1];
  }

  /* фразы, которые сейчас на экране (в любом облаке) */
  const visibleNorms = () => new Set(clouds.map(c => c.norm).filter(Boolean));

  function draw(needShort) {
    const visible = visibleNorms();
    const ok = e => !visible.has(e.norm) && (!needShort || e.short);

    for (let attempt = 0; attempt < 16; attempt++) {
      const pool = chooseCategory(needShort);
      if (!pool) return null;
      if (!pool.deck.length) refill(pool);
      let idx = pool.deck.findIndex(ok);
      if (idx < 0) { refill(pool); idx = pool.deck.findIndex(ok); }
      if (idx >= 0) return pool.deck.splice(idx, 1)[0];
    }
    // запасной вариант: любая фраза, которой нет на экране
    const any = pools.flatMap(p => p.all).filter(e => !visible.has(e.norm));
    return any.length ? pick(any) : null;
  }

  /* ================================================================
     РАССТАНОВКА: по краям, в обход центра и друг друга
     ================================================================ */
  const viewport = () => ({ w: document.documentElement.clientWidth, h: window.innerHeight });

  function exclusion(vp) {
    const phone = vp.w < 520;
    const w = phone ? vp.w * 0.94 : Math.min(vp.w * 0.5, 700);
    const h = phone ? vp.h * 0.52 : Math.min(vp.h * 0.68, 540);
    return { x: (vp.w - w) / 2, y: (vp.h - h) / 2, w, h };
  }

  const hit = (a, b, pad) =>
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

  /* ищет место для облака; true — нашли и поставили */
  function place(cloud) {
    const vp = viewport();
    const ex = exclusion(vp);
    const drift = 30;                                   // запас на дрейф
    const w = cloud.el.offsetWidth + drift * 2;
    const h = cloud.el.offsetHeight + drift * 2;
    const margin = 8;
    if (w > vp.w - margin * 2 || h > vp.h - margin * 2) return false;

    for (let i = 0; i < 60; i++) {
      const box = {
        x: rnd(margin, vp.w - margin - w),
        y: rnd(margin, vp.h - margin - h),
        w, h
      };
      if (hit(box, ex, 0)) continue;
      // не под кнопками «звук» (справа сверху) и «сохранить PDF» (слева сверху)
      if (hit(box, { x: 0, y: 0, w: 170, h: 72 }, 0) || hit(box, { x: vp.w - 170, y: 0, w: 170, h: 72 }, 0)) continue;
      if (clouds.some(o => o !== cloud && o.box && hit(box, o.box, 6))) continue;
      cloud.box = box;
      cloud.el.style.left = Math.round(box.x + drift) + 'px';
      cloud.el.style.top = Math.round(box.y + drift) + 'px';
      return true;
    }
    return false;
  }

  /* ================================================================
     ОБЛАКА
     ================================================================ */
  let clouds = [];
  let started = false;
  let finished = false;      // испарились или остановлены
  let resizeTimer = null;

  const later = (cloud, fn, ms) => {
    const t = setTimeout(() => { cloud.timers.delete(t); fn(); }, ms);
    cloud.timers.add(t);
    return t;
  };

  function unusedFont(exceptCloud) {
    const used = new Set(clouds.filter(c => c !== exceptCloud).map(c => c.font));
    const free = [];
    for (let i = 0; i < FONT_COUNT; i++) if (!used.has(i) && (!exceptCloud || exceptCloud.font !== i)) free.push(i);
    return free.length ? pick(free) : rint(0, FONT_COUNT - 1);
  }

  function setFont(cloud, index) {
    if (cloud.font !== null) cloud.el.classList.remove('f' + cloud.font);
    cloud.font = index;
    cloud.el.classList.add('f' + index);
  }

  function setText(cloud, entry) {
    cloud.norm = entry.norm;
    cloud.glitchy = entry.glitch;
    cloud.inner.textContent = entry.text;
    cloud.inner.dataset.text = entry.text;
    cloud.el.classList.toggle('glitchy', entry.glitch);
  }

  function makeCloud(kind) {
    const el = document.createElement('div');
    el.className = 'cloud ' + kind;
    const inner = document.createElement('div');
    inner.className = 'cloud-text';
    el.appendChild(inner);

    const cloud = {
      el, inner, kind,
      font: null, norm: '', glitchy: false, box: null,
      fontRange: Math.random() < 0.5 ? FONT_FAST : FONT_SLOW,     // у каждого облака свой ритм смены шрифта
      timers: new Set(), gone: false
    };

    el.style.setProperty('--op', (kind === 'small' ? rnd(0.2, 0.3) : rnd(0.24, 0.36)).toFixed(2));
    el.style.setProperty('--dx', Math.round(rnd(-26, 26)) + 'px');
    el.style.setProperty('--dy', Math.round(rnd(-20, 20)) + 'px');
    el.style.setProperty('--drift-dur', rnd(30, 55).toFixed(1) + 's');
    el.style.animationDelay = '-' + rnd(0, 40).toFixed(1) + 's';         // облака дрейфуют не в такт

    const entry = draw(kind === 'small');
    if (!entry) return null;
    setFont(cloud, unusedFont(null));
    setText(cloud, entry);

    layer.appendChild(el);
    clouds.push(cloud);                                                  // раньше place(): чтобы фраза считалась видимой
    if (!place(cloud)) { discard(cloud); return null; }
    return cloud;
  }

  function discard(cloud) {
    cloud.gone = true;
    cloud.timers.forEach(clearTimeout);
    cloud.timers.clear();
    cloud.el.remove();
    clouds = clouds.filter(c => c !== cloud);
  }

  /* ---------- жизнь облака: шрифты, фразы, глюки ---------- */
  function scheduleFont(cloud) {
    later(cloud, () => {
      if (!reduced()) {
        cloud.el.classList.add('reface');
        const prevFont = cloud.font;
        setFont(cloud, unusedFont(cloud));
        later(cloud, () => cloud.el.classList.remove('reface'), 240);
        // новый шрифт мог раздуть облако: до центра или за край экрана — тогда переставляем;
        // если места нет, возвращаем прежний шрифт
        const vp = viewport();
        const r = cloud.el.getBoundingClientRect();
        const outside = r.left < 4 || r.right > vp.w - 4 || r.top < 4 || r.bottom > vp.h - 4;
        if ((outside || hit({ x: r.left, y: r.top, w: r.width, h: r.height }, exclusion(vp), 0)) && !place(cloud)) {
          setFont(cloud, prevFont);
        }
      }
      scheduleFont(cloud);
    }, rnd(cloud.fontRange[0], cloud.fontRange[1]));
  }

  function scheduleText(cloud, firstDelay) {
    later(cloud, () => {
      cloud.el.classList.remove('show');                                  // гаснет…
      later(cloud, () => {
        const entry = draw(cloud.kind === 'small');                       // …меняет фразу…
        if (entry) { setText(cloud, entry); place(cloud); }               // …и проявляется в новом месте
        cloud.el.classList.add('show');
        scheduleText(cloud);
      }, FADE_MS);
    }, firstDelay !== undefined ? firstDelay : TEXT_EVERY + rnd(-TEXT_JITTER, TEXT_JITTER));
  }

  function scheduleGlitch(cloud) {
    later(cloud, () => {
      if (cloud.glitchy && !reduced() && cloud.el.classList.contains('show')) {
        const kind = pick(['slice', 'slice', 'flip', 'jitter', 'scramble', 'scramble']);
        if (kind === 'scramble') scramble(cloud);
        else {
          const cls = 'g-' + kind;
          cloud.el.classList.add(cls);
          later(cloud, () => cloud.el.classList.remove(cls), 540);
        }
      }
      scheduleGlitch(cloud);
    }, rnd(GLITCH_EVERY[0], GLITCH_EVERY[1]));
  }

  // часть букв на миг заменяется мусорными символами
  function scramble(cloud) {
    const original = Array.from(cloud.inner.textContent);
    const changeable = original.map((c, i) => (/\S/.test(c) && Math.random() < 0.4 ? i : -1)).filter(i => i >= 0);
    if (!changeable.length) return;
    let frame = 0;
    const step = () => {
      if (cloud.gone) return;
      frame++;
      if (frame > 3) { cloud.inner.textContent = original.join(''); return; }
      const chars = original.slice();
      changeable.forEach(i => { chars[i] = NOISE[Math.floor(Math.random() * NOISE.length)]; });
      cloud.inner.textContent = chars.join('');
      later(cloud, step, 90);
    };
    step();
  }

  /* ================================================================
     ЗАПУСК И ИСПАРЕНИЕ
     ================================================================ */
  function start() {
    if (started) return;
    started = true;

    buildPools();
    if (!pools.length) { console.warn('clouds: в content/clouds.js нет фраз'); return; }

    const vp = viewport();
    const cfg = vp.w < 520 ? COUNTS.phone : COUNTS.desktop;
    const want = [];
    for (let i = rint(cfg.normal[0], cfg.normal[1]); i > 0; i--) want.push('normal');
    for (let i = rint(cfg.small[0], cfg.small[1]); i > 0; i--) want.push('small');

    shuffle(want).forEach(kind => {
      const cloud = makeCloud(kind);
      if (!cloud) return;
      // облака проявляются не разом, а постепенно
      later(cloud, () => cloud.el.classList.add('show'), rnd(300, 3500));
      scheduleFont(cloud);
      scheduleText(cloud, rnd(3000, TEXT_EVERY + TEXT_JITTER));           // у каждого своя фаза смены фразы
      scheduleGlitch(cloud);
    });

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (finished) return;
      clouds.forEach(c => { c.box = null; });
      clouds.slice().forEach(c => { if (!place(c)) discard(c); });
    }, 250);
  }

  // испарение: плавно растворяется вверх
  function evapFade(cloud) {
    cloud.el.classList.remove('show', 'glitchy');
    cloud.el.classList.add('evap-fade');
    later(cloud, () => discard(cloud), 3000);
  }

  // испарение с глюком: символы пропадают пачками, потом гаснет остаток
  function evapGlitch(cloud) {
    cloud.el.classList.remove('glitchy', 'g-slice', 'g-flip', 'g-jitter', 'reface');
    cloud.el.classList.add('dying');
    const chars = Array.from(cloud.inner.textContent);
    const alive = chars.map((c, i) => (/\S/.test(c) ? i : -1)).filter(i => i >= 0);
    cloud.inner.dataset.text = '';

    (function tick() {
      if (!alive.length) {
        cloud.el.classList.remove('show');
        later(cloud, () => discard(cloud), 1500);
        return;
      }
      for (let n = rint(2, 4); n > 0 && alive.length; n--) {
        const i = alive.splice(rint(0, alive.length - 1), 1)[0];
        chars[i] = ' ';                                             // пробел без схлопывания: облако не «прыгает»
      }
      cloud.inner.textContent = chars.join('');
      later(cloud, tick, rnd(80, 140));
    })();
  }

  function evaporate() {
    if (finished || !started) return;
    finished = true;
    window.removeEventListener('resize', onResize);

    clouds.slice().forEach(cloud => {
      // остановить обычную жизнь облака
      cloud.timers.forEach(clearTimeout);
      cloud.timers.clear();

      const glitchy = Math.random() < 0.45;
      later(cloud, () => (glitchy ? evapGlitch(cloud) : evapFade(cloud)), rnd(0, 1400));   // не все сразу
    });
  }

  function stop() {
    finished = true;
    window.removeEventListener('resize', onResize);
    clouds.slice().forEach(discard);
  }

  /* ---------- подключение к сценарию ---------- */
  // Запуск: первое появление любой из сцен «пожелания / торт / письмо»
  // (при обычном прохождении — с началом пожеланий; ?scene=letter тоже покажет облака).
  ['wishes', 'cake', 'letter'].forEach(name => Scenes.on(name, start));

  // Испарение: клик по конверту (он же его открывает — см. letter.js)
  const envelope = document.getElementById('envelope');
  if (envelope) envelope.addEventListener('click', evaporate);

  window.Clouds = { start, evaporate, stop };
})();
