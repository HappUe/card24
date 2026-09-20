/*
  typewriter.js — побуквенная печать в духе Undertale + глитч-вспышки.
  Используется сценами пожеланий и письма. Стили — в src/css/effects.css,
  звуки — из audio.js (если он подключён; без него всё работает молча).

  Главное:
    const run = Typewriter.typeLines(container, ['строка 1', 'строка 2'], opts);
    await run.done;          // дождаться конца печати (или пропуска)
    run.skip();              // показать всё сразу (по клику пользователя)
    run.cancel();            // остановить молча (при смене сцены)

  Для готового элемента (например, заголовок письма):
    Typewriter.prepare(el, 'Текст');           // подготовить (буквы скрыты)
    const run = Typewriter.typeElements([el1, el2], opts);

  opts (всё необязательно):
    pitch         тон блипа в Гц                            (440)
    charDelay     пауза между буквами, мс                    (38)
    linePause     пауза после строки, мс                     (380)
    startDelay    пауза перед началом, мс                    (0)
    glitchAfter   (index, text) => вид глитча после строки: true | 'ghost' | 'slice'
                  | 'flip' | 'scramble' — или false/undefined, если сбоя нет
    onLine        (index, el) => … — после каждой строки

  Вспышки:
    Typewriter.glitch(el, kind) — текстовый глитч строки. Виды (kind):
        'ghost'    красный и бирюзовый «призраки» текста      (по умолчанию)
        'slice'    полосы строки съезжают в стороны
        'flip'     строка на миг переворачивается вверх ногами
        'scramble' часть букв на миг превращается в мусорные символы
    Typewriter.glitchMarked(container, kind) — глитч случайного слова, отмеченного в тексте
        как {{слово}} или {{несколько слов}} (сине-белые глюки; виды: 'ghost' | 'slice' | 'flip' | 'scramble')
    Typewriter.boxGlitch(el)    — глитч целого блока (конверт, карточка)
    Typewriter.idleGlitch(el, isActive) — редкие случайные сбои; возвращает stop()
*/
(function () {
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = () => window.Sound || null;

  const COMMA = ',;:';
  const STOP = '.!?—…';

  /* ---------- подготовка строки: слова → буквы (скрытые) ----------
     В тексте можно отметить слова для глюков: «обычный текст {{глючащие слова}} снова обычный».
     Скобки на экран не попадают; буквы отмеченных слов получают data-g (номер группы),
     дальше их глючит Typewriter.glitchMarked(). */
  let groupUid = 0;

  function parseMarks(raw) {
    const src = Array.from(raw);
    const chars = [];                        // { c: символ, g: номер группы или '' }
    let group = '';
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '{' && src[i + 1] === '{') { group = 'g' + (++groupUid); i++; continue; }
      if (src[i] === '}' && src[i + 1] === '}') { group = ''; i++; continue; }
      chars.push({ c: src[i], g: group });
    }
    return chars;
  }

  function prepare(el, text) {
    if (text === undefined) text = el.textContent;
    const chars = parseMarks(String(text).trim());
    const plain = chars.map(o => o.c).join('');

    el.classList.add('tw-line');
    el.dataset.text = plain;
    el.setAttribute('aria-label', plain);
    el.textContent = '';

    // слова — куски между пробелами
    const words = [[]];
    chars.forEach(o => { if (o.c === ' ') words.push([]); else words[words.length - 1].push(o); });

    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      word.forEach(o => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = o.c;
        if (o.g) { s.dataset.g = o.g; s.style.display = 'inline-block'; }   // inline-block — чтобы букву можно было двигать
        w.appendChild(s);
      });
      el.appendChild(w);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return el;
  }

  const letters = el => Array.from(el.querySelectorAll('.ch'));
  const revealNow = el => letters(el).forEach(c => c.classList.add('on'));

  /* ---------- вспышки ---------- */
  function flash(el, cls, ms) {
    if (reduced()) return;
    if (sound()) sound().glitch();
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  const boxGlitch = el => flash(el, 'box-glitching', 460);

  /* «скремблинг»: часть уже напечатанных букв на миг заменяется мусорными символами */
  const NOISE = '▒░▓█#%&@$?!¤§<>/\\|';
  function scramble(el) {
    if (reduced()) return;
    const targets = letters(el).filter(c =>
      c.classList.contains('on') && c.textContent.trim() && c.textContent.length === 1 && Math.random() < 0.45);
    if (!targets.length) return;
    if (sound()) sound().glitch();

    const original = targets.map(c => c.textContent);
    let frame = 0;
    const timer = setInterval(() => {
      frame++;
      if (frame > 3) {
        clearInterval(timer);
        targets.forEach((c, i) => { c.textContent = original[i]; c.classList.remove('scr'); });
        return;
      }
      targets.forEach(c => {
        c.textContent = NOISE[Math.floor(Math.random() * NOISE.length)];
        c.classList.add('scr');
      });
    }, 90);
  }

  /* kind: 'ghost' (по умолчанию) | 'slice' | 'flip' | 'scramble' */
  function glitch(el, kind) {
    switch (kind) {
      case 'slice':    return flash(el, 'slicing', 520);
      case 'flip':     return flash(el, 'flipping', 440);
      case 'scramble': return scramble(el);
      default:         return flash(el, 'glitching', 440);
    }
  }

  function idleGlitch(el, isActive) {
    let timer = null, stopped = false;
    (function schedule() {
      timer = setTimeout(() => {
        if (stopped) return;
        if (!isActive || isActive()) glitch(el);
        schedule();
      }, 6500 + Math.random() * 4000);
    })();
    return function stop() { stopped = true; clearTimeout(timer); };
  }

  /* ---------- глюки на отмеченных словах ({{…}}) ----------
     Берёт случайное отмеченное слово/фразу внутри container (только уже напечатанное
     и реально видимое на экране) и глючит его в сине-белых тонах, в духе Undertale —
     теми же приёмами, что и глюки строк в пожеланиях:
       'ghost'    сине-белые «призраки» слова разъезжаются в стороны;
       'slice'    сине-белые полосы слова съезжают в стороны;
       'flip'     буквы на миг переворачиваются вверх ногами и вспыхивают синим;
       'scramble' буквы на миг превращаются в мусорные символы синего цвета.
     Без kind выбирается случайный. Возвращает true, если что-то заглючило. */
  const BLUE = '#1f5bff';
  const WHITE = '#ffffff';

  // слой для копий-«призраков» поверх страницы (в координатах документа)
  function fxLayer() {
    let layer = document.getElementById('tw-fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'tw-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', zIndex: '44', pointerEvents: 'none' });
      document.body.appendChild(layer);
    }
    return layer;
  }

  // копия одной буквы точно поверх оригинала, нужного цвета
  function ghostChar(c, color) {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    const o = document.createElement('span');
    o.textContent = c.textContent;
    Object.assign(o.style, {
      position: 'absolute',
      left: (r.left + window.scrollX) + 'px', top: (r.top + window.scrollY) + 'px',
      width: r.width + 'px', height: r.height + 'px', lineHeight: r.height + 'px',
      whiteSpace: 'pre', pointerEvents: 'none',
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle, letterSpacing: cs.letterSpacing,
      color,
      // белые буквы обводим синим, чтобы они были видны и на светлой бумаге
      webkitTextStroke: color === WHITE ? '0.7px ' + BLUE : '0',
      textShadow: '0 0 6px ' + (color === BLUE ? 'rgba(31,91,255,0.7)' : 'rgba(255,255,255,0.9)')
    });
    return o;
  }

  function glitchMarked(container, kind) {
    if (reduced()) return false;

    const groups = new Map();
    container.querySelectorAll('.ch[data-g]').forEach(ch => {
      if (!groups.has(ch.dataset.g)) groups.set(ch.dataset.g, []);
      groups.get(ch.dataset.g).push(ch);
    });

    const ready = Array.from(groups.values()).filter(chars => {
      if (!chars.every(c => c.classList.contains('on'))) return false;           // ещё печатается
      const r = chars[0].getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && !!hit.closest && hit.closest('.tw-line') === chars[0].closest('.tw-line');   // на экране, не свёрнуто
    });
    if (!ready.length) return false;

    const chars = ready[Math.floor(Math.random() * ready.length)];
    const type = kind || ['ghost', 'ghost', 'ghost', 'slice', 'slice', 'flip', 'scramble', 'scramble'][Math.floor(Math.random() * 8)];
    if (sound()) sound().glitch();

    // копии живут меньше секунды и убираются сами
    const layer = fxLayer();
    const made = [];
    const add = o => { layer.appendChild(o); made.push(o); return o; };
    setTimeout(() => made.forEach(o => o.remove()), 800);
    const steps = { duration: 460, easing: 'steps(1)', fill: 'forwards' };

    if (type === 'ghost') {
      chars.forEach(c => {
        add(ghostChar(c, BLUE)).animate([
          { transform: 'translate(-4px, 1px)', opacity: 1 }, { transform: 'translate(-8px, 0)', opacity: 1 },
          { transform: 'translate(-3px, -1px)', opacity: 0.9 }, { transform: 'translate(-7px, 1px)', opacity: 1 },
          { transform: 'translate(0, 0)', opacity: 0 }
        ], steps);
        add(ghostChar(c, WHITE)).animate([
          { transform: 'translate(4px, -1px)', opacity: 1 }, { transform: 'translate(7px, 0)', opacity: 0.9 },
          { transform: 'translate(3px, 1px)', opacity: 1 }, { transform: 'translate(8px, -1px)', opacity: 0.9 },
          { transform: 'translate(0, 0)', opacity: 0 }
        ], steps);
        c.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }], steps);   // оригинал мерцает
      });
      return true;
    }

    if (type === 'slice') {
      chars.forEach(c => {
        [[BLUE, -1], [WHITE, 1]].forEach(([color, dir]) => {
          add(ghostChar(c, color)).animate([
            { clipPath: 'inset(0 0 70% 0)',   transform: 'translateX(' + dir * -10 + 'px)' },
            { clipPath: 'inset(35% 0 35% 0)', transform: 'translateX(' + dir * 12 + 'px)' },
            { clipPath: 'inset(60% 0 8% 0)',  transform: 'translateX(' + dir * -7 + 'px)' },
            { clipPath: 'inset(15% 0 55% 0)', transform: 'translateX(' + dir * 9 + 'px)' },
            { clipPath: 'inset(0 0 100% 0)',  transform: 'none' }
          ], { duration: 520, easing: 'steps(1)', fill: 'forwards' });
        });
      });
      return true;
    }

    if (type === 'flip') {
      chars.forEach((c, i) => {
        const orig = getComputedStyle(c).color;
        c.animate([
          { transform: 'none',         color: orig },
          { transform: 'scaleY(-1)',   color: BLUE },
          { transform: 'none',         color: orig },
          { transform: 'scaleY(-1)',   color: BLUE },
          { transform: 'none',         color: orig }
        ], { duration: 420, easing: 'steps(1)', delay: (i % 3) * 40 });
      });
      return true;
    }

    // scramble: мусорные символы синего цвета
    const original = chars.map(c => c.textContent);
    let frame = 0;
    const timer = setInterval(() => {
      frame++;
      if (frame > 3) {
        clearInterval(timer);
        chars.forEach((c, i) => { c.textContent = original[i]; c.style.color = ''; });
        return;
      }
      chars.forEach(c => {
        if (c.textContent.trim()) c.textContent = NOISE[Math.floor(Math.random() * NOISE.length)];
        c.style.color = BLUE;
      });
    }, 90);
    return true;
  }

  /* ---------- сам движок ---------- */
  function typeElements(els, opts) {
    opts = opts || {};
    const pitch = opts.pitch || 440;
    const charDelay = opts.charDelay || 38;
    const linePause = opts.linePause || 380;

    const run = { skipped: false, cancelled: false, _timer: null, _wake: null };

    const sleep = ms => new Promise(resolve => {
      run._wake = resolve;
      run._timer = setTimeout(resolve, ms);
    });
    const interrupt = () => {
      clearTimeout(run._timer);
      if (run._wake) run._wake();
    };

    run.skip = function () {
      if (run.skipped || run.cancelled) return;
      run.skipped = true;
      els.forEach(revealNow);
      interrupt();
    };
    run.cancel = function () {
      run.cancelled = true;
      interrupt();
    };

    run.done = (async function () {
      if (reduced()) { els.forEach(revealNow); return; }

      if (opts.startDelay) await sleep(opts.startDelay);

      for (let li = 0; li < els.length; li++) {
        if (run.skipped || run.cancelled) return;
        const el = els[li];
        const chars = letters(el);

        for (let i = 0; i < chars.length; i++) {
          if (run.skipped || run.cancelled) return;
          const c = chars[i].textContent;
          chars[i].classList.add('on');
          if (c.trim() && i % 2 === 0 && sound()) sound().blip(pitch);
          await sleep(COMMA.includes(c) ? charDelay * 4.5 : STOP.includes(c) ? charDelay * 8 : charDelay);
        }
        if (run.skipped || run.cancelled) return;

        const kind = opts.glitchAfter && opts.glitchAfter(li, el.dataset.text);
        if (kind) {
          await sleep(150);
          if (run.skipped || run.cancelled) return;
          glitch(el, kind === true ? 'ghost' : kind);
        }
        if (opts.onLine) opts.onLine(li, el);
        await sleep(linePause);
      }
    })();

    return run;
  }

  /* строки создаются внутри контейнера: по одному <p> на строку */
  function typeLines(container, lines, opts) {
    opts = opts || {};
    container.textContent = '';
    const els = lines.map(text => {
      const p = document.createElement('p');
      p.className = opts.lineClass || '';
      prepare(p, text);
      container.appendChild(p);
      return p;
    });
    return typeElements(els, opts);
  }

  window.Typewriter = { prepare, typeLines, typeElements, glitch, glitchMarked, boxGlitch, idleGlitch, reveal: revealNow };
})();
