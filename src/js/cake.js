/*
  cake.js — сцена 3: задувание свечей.

  Как гасить:
    • компьютер — правая кнопка мыши по торту (контекстное меню браузера над тортом
      отключено, в остальных местах страницы работает как обычно);
    • телефон/планшет — долгое нажатие (~0,4 с) на торт;
    • клавиатура — Enter или пробел, когда торт в фокусе (запасной путь для доступности).
  Нужно 9 «дуновений»: с каждым пламя слабеет, дрожит чаще и уменьшается, свет вокруг
  торта тускнеет. Свеча «4» гаснет на 8-м, свеча «2» — на 9-м. После последнего
  дуновения сцена сообщает, что всё готово: конфетти (КТ-4) подписывается на это.

  Как подписаться на «свечи погасли»:
    Cake.onDone(fn)                                  // или:
    document.addEventListener('cake:done', fn)

  Стили состояний (--burn, .out, --glow, .puff, .done) — src/css/scenes/cake.css.
*/
(function () {
  const STEPS = 9;                 // сколько дуновений до полной темноты
  const END_STEP = [9, 8];         // на каком дуновении гаснет свеча: «2», «4» (слева направо)
  const LONG_PRESS_MS = 400;       // долгое нажатие на сенсорном экране
  const MOVE_TOLERANCE = 14;       // насколько можно сместить палец, не сбив нажатие, px
  const TOUCH_GUARD_MS = 1200;     // после касания игнорируем «contextmenu» (Android шлёт его после долгого нажатия)

  const wrap = document.getElementById('cake-wrap');
  const hint = document.getElementById('cake-hint');
  const candles = Array.from(document.querySelectorAll('#candles .digit-candle'));
  const doneHandlers = [];

  let step = 0;
  let finished = false;
  let lastTouchAt = 0;
  let pressTimer = null;
  let pressX = 0, pressY = 0;
  let puffTimer = null;

  const text = () => (window.CONTENT && window.CONTENT.cake) || {};
  const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------- вид свечей по текущему шагу ---------- */
  function render() {
    candles.forEach((candle, i) => {
      const end = END_STEP[i] || STEPS;
      const burn = Math.max(0, 1 - step / end);
      candle.style.setProperty('--burn', burn.toFixed(3));
      candle.classList.toggle('out', burn <= 0);
    });
    wrap.style.setProperty('--glow', (1 - step / STEPS).toFixed(3));
  }

  function puff() {
    wrap.classList.remove('puff');
    void wrap.offsetWidth;                       // перезапустить анимацию покачивания
    wrap.classList.add('puff');
    clearTimeout(puffTimer);
    puffTimer = setTimeout(() => wrap.classList.remove('puff'), 320);
  }

  /* ---------- одно дуновение ---------- */
  function blow() {
    if (finished) return;
    const wasOut = candles.map(c => c.classList.contains('out'));

    step++;
    render();
    puff();

    if (window.Sound) {
      window.Sound.blip(300 - step * 14);        // короткий «фью», с каждым разом ниже
      candles.forEach((c, i) => { if (!wasOut[i] && c.classList.contains('out')) window.Sound.blip(110); });
    }

    if (step >= STEPS) finish();
  }

  function finish() {
    finished = true;
    clearTimeout(pressTimer);
    hint.textContent = text().done || 'свечи погасли ✦';
    hint.classList.add('done');
    wrap.style.cursor = 'default';
    wrap.removeAttribute('tabindex');
    doneHandlers.forEach(fn => fn());
    document.dispatchEvent(new CustomEvent('cake:done'));
  }

  /* ---------- вход в сцену / сброс ---------- */
  function reset() {
    step = 0;
    finished = false;
    clearTimeout(pressTimer);
    wrap.classList.remove('puff');
    wrap.style.cursor = '';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', 'Задуть свечи');
    hint.classList.remove('done');
    hint.textContent = isTouchDevice() ? (text().hintTouch || '') : (text().hintDesktop || '');
    render();
  }

  /* ---------- управление ---------- */

  // ПКМ над тортом: меню браузера гасим только здесь
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (Date.now() - lastTouchAt < TOUCH_GUARD_MS) return;   // это «хвост» долгого нажатия — уже посчитано таймером
    blow();
  });

  // долгое нажатие пальцем
  function cancelPress() { clearTimeout(pressTimer); pressTimer = null; }

  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    lastTouchAt = Date.now();
    pressX = e.clientX; pressY = e.clientY;
    cancelPress();
    pressTimer = setTimeout(() => { pressTimer = null; blow(); }, LONG_PRESS_MS);
  });
  wrap.addEventListener('pointermove', e => {
    if (pressTimer && Math.hypot(e.clientX - pressX, e.clientY - pressY) > MOVE_TOLERANCE) cancelPress();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => wrap.addEventListener(type, cancelPress));

  // клавиатура
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blow(); }
  });

  Scenes.on('cake', reset);

  window.Cake = {
    onDone: fn => doneHandlers.push(fn),
    isDone: () => finished,
    steps: STEPS
  };
})();
