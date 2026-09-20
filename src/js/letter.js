/*
  letter.js — сцена 5: финальное письмо.

  Сценарий:
    1. на экране закрытый конверт с печатью и подсказкой «открой конверт▮»;
    2. клик по конверту — глитч конверта, клапан откидывается, лист выезжает;
    3. конверт уезжает вниз, письмо проявляется и печатается по символу
       (обращение и заголовок → абзацы → подпись; на заголовке и подписи — глитч);
    4. под подписью проявляется подсвеченная строка «Дополнение? (развернуть)»
       (текст строки — CONTENT.letter.more.label). Клик по ней разворачивает дополнительные
       абзацы (CONTENT.letter.more.paragraphs), они печатаются по символу при первом
       раскрытии, письмо становится длиннее; повторный клик сворачивает;
    5. пока письмо на экране, время от времени глючат слова, отмеченные в тексте как {{слово}}
       (сине-белые глюки); после печати иногда сбоит и заголовок. Клик по письму во время
       печати показывает всё сразу;
    6. слева сверху — кнопка «сохранить PDF»: сохраняет письмо целиком (с «Дополнением»)
       через окно печати браузера («Сохранить как PDF»).

  Текст берётся из CONTENT.letter (content/content.js). Если поля `more` там нет,
  блок «Дополнение» просто не создаётся.
  Как только письмо открыто, запоминается отметка «письмо прочитано»
  (main.js использует её, чтобы показать на старте ссылку «перечитать письмо»).

  Для проверки: index.html?scene=letter сразу открывает эту сцену (звук при этом
  не включится — браузеру нужен клик по странице).
*/
(function () {
  const view = document.getElementById('view-letter');
  const envWrap = document.getElementById('env-wrap');
  const envelope = document.getElementById('envelope');
  const envHint = document.getElementById('env-hint');
  const letter = document.getElementById('letter');
  const eyebrow = document.getElementById('letter-eyebrow');
  const title = document.getElementById('letter-title');
  const body = document.getElementById('letter-body');
  const sign = document.getElementById('letter-sign');

  // подсказка «нажми — показать всё сразу» (стили — .hint-bar из layout.css)
  const hintBar = document.createElement('p');
  hintBar.className = 'hint-bar';
  view.appendChild(hintBar);

  const WORD_GLITCH_EVERY = [1800, 3600];   // как часто глючат отмеченные слова, мс

  /* ---------- сохранение письма в PDF ----------
     Кнопка слева сверху (вид — .export-btn в letter.css, как у кнопки звука). Появляется,
     когда письмо открыто. По клику собирается скрытый блок #print-letter с ПОЛНЫМ текстом
     письма (включая «Дополнение», даже свёрнутое) и открывается окно печати браузера —
     там выбирается «Сохранить как PDF». Надпись на кнопке можно поменять в content.js:
     ui.exportPdf. */
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.id = 'export-btn';
  exportBtn.className = 'export-btn';
  exportBtn.hidden = true;
  exportBtn.textContent = (window.CONTENT && window.CONTENT.ui && window.CONTENT.ui.exportPdf) || 'сохранить PDF';
  exportBtn.setAttribute('aria-label', 'Сохранить письмо в PDF');
  document.body.appendChild(exportBtn);

  /* ---------- «пройти заново» ----------
     Появляется внизу по центру, когда письмо напечатано целиком. Перезагружает страницу:
     всё начинается со стартовой сцены (звук снова включается по кнопке «Начать»).
     Надпись — content.js: ui.restart. */
  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.id = 'restart-btn';
  restartBtn.className = 'restart-btn';
  restartBtn.hidden = true;
  restartBtn.textContent = (window.CONTENT && window.CONTENT.ui && window.CONTENT.ui.restart) || 'пройти заново';
  restartBtn.setAttribute('aria-label', 'Пройти открытку заново');
  restartBtn.addEventListener('click', () => window.location.reload());
  document.body.appendChild(restartBtn);

  const stripMarks = s => String(s || '').replace(/\{\{|\}\}/g, '');    // убрать служебные {{ }}
  let savedTitle = null;

  function buildPrintLayout() {
    const old = document.getElementById('print-letter');
    if (old) old.remove();

    const t = (window.CONTENT && window.CONTENT.letter) || {};
    const root = document.createElement('div');
    root.id = 'print-letter';

    const add = (tag, cls, txt, parent) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      el.textContent = txt;
      (parent || root).appendChild(el);
      return el;
    };

    add('div', 'pl-eyebrow', stripMarks(t.eyebrow));
    add('div', 'pl-title', stripMarks(t.title));
    const main = add('div', 'pl-text', '');
    (t.paragraphs || []).forEach(p => add('p', '', stripMarks(p), main));
    add('div', 'pl-sign', stripMarks(t.sign));

    const m = t.more;
    if (m && m.paragraphs && m.paragraphs.length) {
      // в PDF метка без подсказки «(развернуть)»
      const label = stripMarks(m.label).replace(/\s*\([^)]*\)\s*/g, ' ').trim() || 'Дополнение';
      add('div', 'pl-more-label', label);
      const more = add('div', 'pl-more', '');
      m.paragraphs.forEach(p => add('p', '', stripMarks(p), more));
    }

    document.body.appendChild(root);
  }

  function savePdf() {
    buildPrintLayout();
    // имя файла по умолчанию берётся из заголовка вкладки
    const t = (window.CONTENT && window.CONTENT.letter) || {};
    savedTitle = document.title;
    document.title = stripMarks(t.title).replace(/[!?.\s]+$/, '') || 'Письмо';

    const go = () => window.print();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }

  window.addEventListener('afterprint', () => {
    const root = document.getElementById('print-letter');
    if (root) root.remove();
    if (savedTitle !== null) { document.title = savedTitle; savedTitle = null; }
  });

  exportBtn.addEventListener('click', savePdf);

  let state = 'closed';        // closed → opening → typing → done
  let token = 0;               // растёт при каждом сбросе — старые таймеры сами замолкают
  let timers = [];
  let current = null;          // текущая печать
  let skipped = false;
  let stopIdle = null;
  let wordTimer = null;
  let bodyEls = [];

  // блок «Дополнение»
  let moreBlock = null, moreLabel = null, moreParas = [];
  let moreRun = null, moreTyped = false;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(resolve => timers.push(setTimeout(resolve, ms)));
  const text = () => (window.CONTENT && window.CONTENT.letter) || {};

  /* ---------- блок «Дополнение? (развернуть)» ---------- */
  function buildMore() {
    if (moreBlock) moreBlock.remove();
    moreBlock = moreLabel = null;
    moreParas = [];
    moreRun = null;
    moreTyped = false;

    const m = text().more;
    if (!m || !m.paragraphs || !m.paragraphs.length) return;

    moreBlock = document.createElement('div');
    moreBlock.className = 'letter-ps';

    moreLabel = document.createElement('button');
    moreLabel.type = 'button';
    moreLabel.className = 'letter-ps-toggle';
    moreLabel.setAttribute('aria-expanded', 'false');
    Typewriter.prepare(moreLabel, m.label || 'Дополнение');

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'letter-ps-body';
    const inner = document.createElement('div');
    inner.className = 'letter-ps-inner';
    const content = document.createElement('div');
    content.className = 'letter-ps-content';

    moreParas = m.paragraphs.map(par => {
      const p = document.createElement('p');
      Typewriter.prepare(p, par);
      content.appendChild(p);
      return p;
    });

    inner.appendChild(content);
    bodyWrap.appendChild(inner);
    moreBlock.appendChild(moreLabel);
    moreBlock.appendChild(bodyWrap);
    letter.appendChild(moreBlock);

    moreLabel.addEventListener('click', toggleMore);
    // клик по самому дополнению, пока оно печатается, — показать всё сразу
    bodyWrap.addEventListener('click', () => { if (moreRun && !moreTyped) moreRun.skip(); });
  }

  function toggleMore() {
    if (state !== 'done' || !moreBlock) return;
    const open = !moreBlock.classList.contains('open');
    moreBlock.classList.toggle('open', open);
    moreLabel.setAttribute('aria-expanded', String(open));

    if (open) {
      if (!moreRun && !moreTyped) {
        // при первом раскрытии: дождаться, пока блок начнёт раскрываться, и печатать
        const myToken = token;
        timers.push(setTimeout(() => {
          if (myToken !== token || moreRun) return;
          moreRun = Typewriter.typeElements(moreParas, { pitch: 440, linePause: 380 });
          moreRun.done.then(() => { moreTyped = true; });
        }, 350));
      }
      // если раскрывшееся дополнение уходит за нижний край экрана — плавно подкрутить
      timers.push(setTimeout(() => {
        const r = moreBlock.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 20) {
          window.scrollBy({ top: r.bottom - window.innerHeight + 40, behavior: 'smooth' });
        }
      }, 700));
    } else if (moreRun && !moreTyped) {
      moreRun.skip();                                   // свернули посреди печати — дописать молча
    }
  }

  /* ---------- подготовка текста ---------- */
  function fillLetter() {
    const t = text();
    Typewriter.prepare(eyebrow, t.eyebrow || '');
    Typewriter.prepare(title, t.title || '');
    Typewriter.prepare(sign, t.sign || '');

    body.textContent = '';
    bodyEls = (t.paragraphs || []).map(par => {
      const p = document.createElement('p');
      Typewriter.prepare(p, par);
      body.appendChild(p);
      return p;
    });

    buildMore();
  }

  function reset() {
    token++;
    timers.forEach(clearTimeout); timers = [];
    clearTimeout(wordTimer);
    if (current) current.cancel();
    if (moreRun) moreRun.cancel();
    if (stopIdle) { stopIdle(); stopIdle = null; }
    current = null;
    skipped = false;
    state = 'closed';

    view.classList.remove('reading');
    exportBtn.hidden = true;
    restartBtn.hidden = true;
    envelope.classList.remove('open', 'rise', 'box-glitching');
    envHint.classList.remove('gone');
    hintBar.classList.remove('on');
    hintBar.textContent = (window.CONTENT && window.CONTENT.ui && window.CONTENT.ui.skipHint) || '';
    hintBar.classList.add('pixel');
    fillLetter();
  }

  /* ---------- глюки на отмеченных словах ---------- */
  function startWordGlitches(myToken) {
    clearTimeout(wordTimer);
    (function loop() {
      wordTimer = setTimeout(() => {
        if (myToken !== token) return;
        Typewriter.glitchMarked(letter);               // сама выберет напечатанное и видимое слово
        loop();
      }, rnd(WORD_GLITCH_EVERY[0], WORD_GLITCH_EVERY[1]));
    })();
  }

  /* ---------- печать письма ---------- */
  async function typeLetter(myToken) {
    const groups = [
      { els: [eyebrow, title], opts: { pitch: 330, startDelay: 400, glitchAfter: li => (li === 1 ? 'ghost' : false) } },
      { els: bodyEls,          opts: { pitch: 440 } },
      { els: [sign],           opts: { pitch: 520, glitchAfter: () => 'ghost' } }
    ];

    hintBar.classList.add('on');
    startWordGlitches(myToken);

    for (const g of groups) {
      if (myToken !== token) return;
      if (!g.els.length) continue;
      if (skipped) { g.els.forEach(Typewriter.reveal); continue; }
      current = Typewriter.typeElements(g.els, Object.assign({ linePause: 380 }, g.opts));
      await current.done;
    }
    if (myToken !== token) return;

    // «Дополнение»: строка проявляется под подписью
    if (moreBlock) {
      moreBlock.classList.add('ready');
      if (skipped) {
        Typewriter.reveal(moreLabel);
      } else {
        current = Typewriter.typeElements([moreLabel], { pitch: 520, startDelay: 300 });
        await current.done;
      }
      if (myToken !== token) return;
    }

    state = 'done';
    restartBtn.hidden = false;                            // письмо прочитано → можно пройти заново
    hintBar.classList.remove('on');
    stopIdle = Typewriter.idleGlitch(title, () => Scenes.current() === 'letter');
  }

  function skipAll() {
    if (state !== 'typing' || skipped) return;
    skipped = true;
    if (current) current.skip();
  }

  /* ---------- открытие конверта ---------- */
  async function openEnvelope() {
    if (state !== 'closed') return;
    state = 'opening';
    const myToken = token;

    envHint.classList.add('gone');
    Typewriter.boxGlitch(envelope);                       // сбой конверта

    await sleep(350);  if (myToken !== token) return;
    envelope.classList.add('open');                       // клапан откинулся
    await sleep(750);  if (myToken !== token) return;
    envelope.classList.add('rise');                       // лист выехал
    await sleep(1150); if (myToken !== token) return;

    view.classList.add('reading');                        // конверт ушёл, письмо появилось
    exportBtn.hidden = false;                             // кнопка «сохранить PDF»
    state = 'typing';
    await sleep(700);  if (myToken !== token) return;
    typeLetter(myToken);
  }

  /* ---------- управление ---------- */
  envelope.addEventListener('click', openEnvelope);
  letter.addEventListener('click', skipAll);

  Scenes.on('letter', reset);
})();
