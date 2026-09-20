/*
  notice.js — сцена 1б: предупреждение перед пожеланиями.

  Порядок: три строки проявляются сами → подпись автора печатается по букве →
  через паузу приходит кнопка «Далее» → по ней всё гаснет, «Приятного чтения» печатается по букве →
  небольшая пауза → сцена пожеланий («Максим…» и дальше).
  Все тексты — в content.js, раздел notice (lines, sign, next, read).
*/
(function () {
  const view = document.getElementById('view-notice');
  const textBox = document.getElementById('notice-text');
  const signEl = document.getElementById('notice-sign');
  const nextBtn = document.getElementById('notice-next');
  const readEl = document.getElementById('notice-read');

  const SIGN_AFTER = 2900;      // через сколько (мс) начинает печататься подпись (когда все три строки уже видны)
  const READY_PAUSE = 700;      // пауза после подписи перед кнопкой «Далее»
  const FADE_MS = 750;          // столько гаснут текст и кнопка
  const AFTER_TYPING = 1100;    // пауза после «Приятного чтения» перед пожеланиями

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const text = () => (window.CONTENT && window.CONTENT.notice) || {};

  let run = null;               // печать «Приятного чтения»
  let signRun = null;           // печать подписи
  let state = 'idle';           // idle → reading → closing → typing → gone

  function build() {
    const t = text();
    textBox.textContent = '';
    (t.lines || []).forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      textBox.appendChild(p);
    });
    Typewriter.prepare(signEl, t.sign || '');
    nextBtn.textContent = t.next || 'Далее →';
    Typewriter.prepare(readEl, t.read || 'Приятного чтения');
    view.classList.remove('ready', 'closing', 'typing');
  }

  async function enter() {
    build();
    state = 'reading';
    if (signRun) signRun.cancel();

    // подпись печатается по букве, когда три строки уже проявились
    const mine = signRun = Typewriter.typeElements([signEl], { pitch: 400, startDelay: SIGN_AFTER });
    await mine.done;
    if (mine !== signRun || state !== 'reading') return;
    await sleep(READY_PAUSE);
    if (state === 'reading') view.classList.add('ready');
  }

  async function proceed() {
    if (state !== 'reading') return;
    state = 'closing';
    view.classList.add('closing');
    await sleep(FADE_MS);

    state = 'typing';
    view.classList.add('typing');
    run = Typewriter.typeElements([readEl], { pitch: 480, startDelay: 250 });
    await run.done;
    await sleep(AFTER_TYPING);

    state = 'gone';
    Scenes.next();                                   // → пожелания
  }

  nextBtn.addEventListener('click', proceed);
  // клик по сцене, пока подпись или «Приятного чтения» печатается, — допечатать сразу
  view.addEventListener('click', () => {
    if (state === 'typing' && run) run.skip();
    else if (state === 'reading' && signRun) signRun.skip();
  });

  Scenes.on('notice', enter);
})();
