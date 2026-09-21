/*
  wishes.js — сцена 2: пожелания.

  Абзацы берутся из CONTENT.wishes. На экране один абзац: его строки печатаются
  по символу (Typewriter). Пока идёт печать — клик/тап/свайп/пробел показывают
  абзац сразу. Когда допечатано — появляется «Далее →» (и работает свайп влево).
  После последнего абзаца — переход к торту.

  Глитчи (расписание — в начале файла):
    • текстовые сбои в заданных строках;
    • случайные текстовые сбои прямо во время печати;
    • «окна» — страница осыпается, за ней сердца Undertale (PageFX);
    • фоновые случайные сбои страницы (PageFX.ambient) — тоже во время печати.

  Для проверки: index.html?p=20 откроет пожелания сразу с 20-го абзаца
  (нумерация как на экране, с 1). Кнопку «Начать» всё равно нужно нажать.
*/
(function () {
  const view = document.getElementById('view-wishes');
  const textBox = document.getElementById('wish-text');
  const dotsBox = document.getElementById('wish-dots');
  const nextBtn = document.getElementById('wish-next');
  const hintBar = document.getElementById('wish-hint');

  /* ================= РАСПИСАНИЕ ГЛИТЧЕЙ =================
     Номера абзацев в этом разделе считаются с 0 (первый абзац — «Максим,»). */

  /* 1. Текстовые сбои в конкретных строках (после того, как строка допечаталась):
        { абзац: { строка: 'вид' } }
        виды: 'ghost' (двойник) | 'slice' (срез) | 'flip' (переворот) | 'scramble' (мусорные символы) */
  const TEXT_GLITCHES = {
    1:  { 2: 'ghost' },      // «день рождения наступил.»
    3:  { 1: 'ghost' },      // «…небольшую штуку (?)»
    4:  { 0: 'scramble' },   // «Но сейчас не об этом~»
    12: { 1: 'slice' },      // «пусть остаются за стенами дома!»
    18: { 3: 'flip' },       // «но и на желаемое)»
    25: { 1: 'slice' },      // «Злая штука.»
    29: { 0: 'ghost' }       // «С днём рождения, тебя - Максим)»
  };

  /* 2. Виды случайных текстовых сбоев прямо во время печати (на случайной строке
        текущего абзаца). Виды повторены, чтобы часть была чаще, часть реже.
        Как часто — см. PHASES ниже. */
  const RANDOM_TEXT_KINDS = ['ghost', 'ghost', 'slice', 'slice', 'scramble', 'scramble', 'flip'];

  /* 3. «Окна» — осыпание страницы. Идут по порядку, каждое один раз. Запускаются, когда
        человек дошёл до абзаца `at` (или дальше): через 1–2 секунды после начала абзаца,
        то есть обычно ПРЯМО ВО ВРЕМЯ печати. type — функция из pagefx.js. */
  const PAGE_WINDOWS = [
    { at: 6,  type: 'crumble',      opts: { zone: 'left',  w: 210, h: 150 } },
    { at: 10, type: 'blueHole',     opts: { zone: 'right', w: 270, h: 210 } },   // большое синее
    { at: 13, type: 'crumble',      opts: { zone: 'any',   w: 320, h: 220 } },
    { at: 16, type: 'carouselHole', opts: { zone: 'left',  w: 250, h: 190 } },   // жёлтое + красное
    { at: 19, type: 'brokenHole',   opts: { zone: 'right', w: 260, h: 200 } },   // красное → треснуло → золотое
    { at: 22, type: 'heartHole',    opts: { zone: 'any',   w: 240, h: 190 } },   // зелёное → белое
    { at: 26, type: 'crumble',      opts: { zone: 'left',  w: 300, h: 200 } }
  ];
  const WINDOW_DELAY = { min: 1000, max: 2000 };

  /* 4. НАБОР ПЛОТНОСТИ. Чем дальше абзац, тем чаще фоновые сбои страницы (ambient) и
        случайные сбои текста (textGlitch). Интервалы в мс: сбой раз в min…max.
        null — в этой фазе ничего. Действует фаза с самым большим `from`, не превышающим
        номер абзаца. Хочешь спокойнее — увеличь числа, живее — уменьши. */
  const GLITCH_SPEED = 1.5;   // во сколько раз чаще сбои: интервалы ниже делятся на это число (1 — как записано)
  const PHASES = [
    { from: 0,  ambient: { min: 9000, max: 14000 },  textGlitch: { min: 12000, max: 18000 } },   // начало — мягко, но не пусто
    { from: 3,  ambient: { min: 7000, max: 11000 },  textGlitch: { min: 8000,  max: 13000 } },
    { from: 8,  ambient: { min: 5000, max: 8500 },   textGlitch: { min: 5500,  max: 9500 } },
    { from: 14, ambient: { min: 3600, max: 6500 },   textGlitch: { min: 4000,  max: 7500 } },
    { from: 21, ambient: { min: 2800, max: 5000 },   textGlitch: { min: 3000,  max: 6500 } }    // финал — самое живое
  ];
  /* Читатель не останавливается на абзацах, поэтому на каждой смене фазы (и в самом начале)
     через 1,5–3 с случается один заметный «всплеск», не дожидаясь обычного интервала. */
  const PHASE_FLOURISH = true;

  /* ================= СОСТОЯНИЕ ================= */
  let paragraphs = [];
  let dots = [];
  let index = 0;
  let run = null;
  let ready = false;          // абзац допечатан, можно идти дальше
  let windowIndex = 0;        // какое по счёту окно будет следующим
  let windowTimer = null;
  let textGlitchTimer = null;
  let stopAmbient = null;
  let phase = null;           // текущая фаза плотности (см. PHASES)
  let flourishTimer = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- точки ---------- */
  function buildDots() {
    dotsBox.textContent = '';
    dots = paragraphs.map(() => {
      const d = document.createElement('span');
      dotsBox.appendChild(d);
      return d;
    });
  }
  function updateDots() {
    dots.forEach((d, i) => {
      d.classList.toggle('on', i === index);
      d.classList.toggle('seen', i < index);
    });
  }

  /* ---------- показ абзаца ---------- */
  function setReady(value) {
    ready = value;
    nextBtn.classList.toggle('ready', value);
    hintBar.classList.toggle('on', !value);
  }

  function showParagraph(i) {
    if (run) run.cancel();
    clearTimeout(windowTimer);
    index = i;
    updateDots();
    setReady(false);

    const glitchLines = TEXT_GLITCHES[i] || {};
    run = Typewriter.typeLines(textBox, paragraphs[i], {
      pitch: 440,
      startDelay: i === 0 ? 700 : 300,
      linePause: 420,
      glitchAfter: li => glitchLines[li] || false
    });

    const thisRun = run;
    thisRun.done.then(() => {
      if (thisRun !== run || thisRun.cancelled) return;   // уже другой абзац или сцена сменилась
      setReady(true);
    });

    applyPhase(i);
    scheduleWindow();
  }

  /* ---------- окна: осыпание страницы ---------- */
  function scheduleWindow() {
    const fx = PAGE_WINDOWS[windowIndex];
    if (!fx || index < fx.at) return;
    windowTimer = setTimeout(() => {
      if (Scenes.current() !== 'wishes' || PageFX.busy()) return;   // не вышло — попробуем на следующем абзаце
      windowIndex++;                                                 // засчитываем, только когда реально запустили
      PageFX[fx.type](fx.opts);
    }, rnd(WINDOW_DELAY.min, WINDOW_DELAY.max));
  }

  /* ---------- случайные текстовые сбои во время печати ---------- */
  function startRandomTextGlitches(cfg) {
    clearTimeout(textGlitchTimer);
    if (!cfg) return;
    (function loop() {
      textGlitchTimer = setTimeout(() => {
        if (Scenes.current() === 'wishes') {
          // только строки, где уже что-то напечатано
          const lines = Array.from(textBox.querySelectorAll('.tw-line')).filter(l => l.querySelector('.ch.on'));
          if (lines.length) Typewriter.glitch(pick(lines), pick(RANDOM_TEXT_KINDS));
        }
        loop();
      }, rnd(cfg.min, cfg.max));
    })();
  }

  /* ---------- набор плотности: меняем частоту сбоев по мере чтения ---------- */
  function applyPhase(i) {
    let next = null;
    PHASES.forEach(p => { if (p.from <= i) next = p; });
    if (next === phase) return;                     // фаза не сменилась — ничего не трогаем
    phase = next;

    const faster = cfg => cfg && { min: cfg.min / GLITCH_SPEED, max: cfg.max / GLITCH_SPEED };

    if (stopAmbient) { stopAmbient(); stopAmbient = null; }
    if (phase && phase.ambient) {
      stopAmbient = PageFX.ambient(() => Scenes.current() === 'wishes', faster(phase.ambient));
    }
    startRandomTextGlitches(phase && faster(phase.textGlitch));

    if (PHASE_FLOURISH && phase) {
      clearTimeout(flourishTimer);
      flourishTimer = setTimeout(() => {
        if (Scenes.current() !== 'wishes') return;
        pick([PageFX.artifacts, PageFX.scan, PageFX.tear])();
      }, rnd(1500, 3000));
    }
  }

  /* ---------- остановить все сбои сцены ---------- */
  function stopEffects() {
    phase = null;
    clearTimeout(flourishTimer);
    clearTimeout(windowTimer);
    clearTimeout(textGlitchTimer);
    if (stopAmbient) { stopAmbient(); stopAmbient = null; }
    PageFX.clear();
  }

  /* ---------- действия пользователя ---------- */
  function advance() {
    if (!ready) return;
    if (index + 1 >= paragraphs.length) {
      if (run) run.cancel();
      setReady(false);
      hintBar.classList.remove('on');
      stopEffects();
      Scenes.next();                       // → торт
    } else {
      showParagraph(index + 1);
    }
  }

  function skipOrAdvance() {
    if (!ready && run) run.skip();         // показать абзац сразу (готовность включится сама)
    else advance();
  }

  nextBtn.addEventListener('click', e => { e.stopPropagation(); advance(); });

  // клик/тап по сцене: пока печатается — пропуск (листает только кнопка/свайп)
  view.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (!ready && run) run.skip();
  });

  // свайп влево: пропуск или «дальше»
  let touchX = 0, touchY = 0;
  view.addEventListener('touchstart', e => {
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });
  view.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (dx < -50 && Math.abs(dy) < 60) skipOrAdvance();
  }, { passive: true });

  // клавиатура: → или пробел (Enter на кнопке и так нажимает её сам)
  document.addEventListener('keydown', e => {
    if (Scenes.current() !== 'wishes') return;
    if (e.target.closest && e.target.closest('button, input')) return;   // ползунок музыки сам ловит стрелки
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); skipOrAdvance(); }
  });

  /* ---------- вход в сцену ---------- */
  function startParagraphFromUrl() {
    // Пожелания всегда идут с первого абзаца: пропустить их адресом нельзя
    return 0;
  }

  Scenes.on('wishes', () => {
    paragraphs = (window.CONTENT && window.CONTENT.wishes) || [];
    if (!paragraphs.length) { console.warn('wishes: в content.js нет пожеланий'); return; }
    buildDots();

    const first = startParagraphFromUrl();
    // окна, которые «остались позади» стартового абзаца, пропускаем
    windowIndex = PAGE_WINDOWS.findIndex(fx => fx.at >= first);
    if (windowIndex < 0) windowIndex = PAGE_WINDOWS.length;

    stopEffects();
    showParagraph(first);          // фаза плотности включается внутри
  });

  // на всякий случай: ушли из сцены любым путём — всё выключаем
  Scenes.on('cake', stopEffects);
})();
