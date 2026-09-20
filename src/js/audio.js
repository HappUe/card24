/*
  audio.js — весь звук открытки.

  Пока настоящего трека нет, фоновая музыка синтезируется прямо в браузере
  (Web Audio API). Когда трек будет выбран:
    1. положить файл в assets/audio/background.mp3
    2. поменять TRACK_SRC ниже на 'assets/audio/background.mp3'
  Синтез при этом останется запасным вариантом (если файл не загрузится).

  Использование из других файлов:
    Sound.unlock()           — создать звук; вызывать ТОЛЬКО из клика/тапа
    Sound.startMusic()       — плавно включить фон
    Sound.blip(pitch)        — «блип» печатной машинки (pitch в Гц)
    Sound.glitch()           — короткий шум глитча
    Sound.chime()            — звон, когда погасли свечи
    Sound.toggle()           — включить/выключить всё
    Sound.bindButton(btn)    — привязать кнопку «звук: вкл/выкл»
*/
(function () {
  const TRACK_SRC = 'assets/audio/background.mp3';   // null → только синтез
  const MUSIC_VOLUME = 0.6;        // громкость mp3 (0..1)
  const FADE_MS = 2500;            // плавное нарастание фона

  let ctx = null;
  let master = null;               // общий регулятор громкости всего звука
  let musicGain = null;            // громкость фона (синтез)
  let ambient = [];                // осцилляторы синтезированного фона
  let trackEl = null;              // <audio> для настоящего трека
  let soundOn = true;
  let musicStarted = false;
  let button = null;

  /* ---------- iOS: звук при беззвучном режиме ---------- */
  // Web Audio на iPhone молчит, если включён беззвучный режим. Тихий <audio> в цикле
  // (и navigator.audioSession, где он есть) переводит звук страницы в режим
  // «воспроизведение» — как у видео — тогда всё слышно и при беззвучном режиме.
  let keepEl = null;

  function silentWavUrl() {
    const rate = 8000, n = 800;                       // 0,1 с тишины
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);                // 8 бит: тишина = 128
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function keepPlaybackSession() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (keepEl) return;
    try {
      keepEl = new Audio(silentWavUrl());
      keepEl.loop = true;
      keepEl.setAttribute('playsinline', '');
      const p = keepEl.play();
      if (p && p.catch) p.catch(() => { keepEl = null; });
    } catch (e) { keepEl = null; }
  }

  // iOS может приостановить звук (звонок, сворачивание) — возобновляем при касании и возврате
  function resumeIfNeeded() {
    if (ctx && ctx.state !== 'running') ctx.resume();
    if (keepEl && keepEl.paused) { const p = keepEl.play(); if (p && p.catch) p.catch(() => {}); }
  }
  document.addEventListener('touchend', resumeIfNeeded, { passive: true });
  document.addEventListener('click', resumeIfNeeded, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeIfNeeded(); });

  /* ---------- подготовка ---------- */
  function unlock() {
    keepPlaybackSession();
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = soundOn ? 1 : 0;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
    }
    if (ctx.state !== 'running') ctx.resume();
    // «прогревочный» тихий звук внутри тапа — на iOS без него контекст иногда не оживает
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
    return true;
  }

  /* ---------- фоновая музыка ---------- */
  function startSynthAmbient() {
    if (!ctx || ambient.length) return;
    // мягкий аккорд C–E–G, каждый голос чуть «плывёт»
    [261.63, 329.63, 392.0].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.value = 0.02;
      lfo.frequency.value = 0.12 + i * 0.05;
      lfoGain.gain.value = 0.006;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(musicGain);
      osc.start(); lfo.start();
      ambient.push(osc, lfo);
    });
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_MS / 1000);
  }

  function startTrack() {
    trackEl = new Audio(TRACK_SRC);
    trackEl.loop = true;
    trackEl.volume = 0;
    trackEl.muted = !soundOn;
    trackEl.addEventListener('error', () => { trackEl = null; startSynthAmbient(); });
    const p = trackEl.play();
    if (p && p.catch) p.catch(() => { trackEl = null; startSynthAmbient(); });

    // плавное нарастание громкости
    const t0 = performance.now();
    (function step(now) {
      if (!trackEl) return;
      const k = Math.min(1, (now - t0) / FADE_MS);
      trackEl.volume = MUSIC_VOLUME * k;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function startMusic() {
    if (musicStarted) return;
    if (!unlock()) return;
    musicStarted = true;
    if (TRACK_SRC) startTrack(); else startSynthAmbient();
  }

  /* ---------- эффекты ---------- */
  function blip(pitch) {
    if (!soundOn || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = (pitch || 440) * (0.94 + Math.random() * 0.12);
    g.gain.setValueAtTime(0.028, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.07);
  }

  function glitch() {
    if (!soundOn || !ctx) return;
    const t = ctx.currentTime;
    [180, 95, 240].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.025, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.09);
      osc.connect(g).connect(master);
      osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.1);
    });
  }

  function chime() {
    if (!soundOn || !ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.08;
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      osc.connect(g).connect(master);
      osc.start(t); osc.stop(t + 1.05);
    });
  }

  /* ---------- вкл/выкл ---------- */
  function label() {
    const ui = (window.CONTENT && window.CONTENT.ui) || {};
    return soundOn ? (ui.soundOn || 'звук: вкл') : (ui.soundOff || 'звук: выкл');
  }

  function toggle() {
    soundOn = !soundOn;
    if (master) master.gain.setTargetAtTime(soundOn ? 1 : 0, ctx.currentTime, 0.05);
    if (trackEl) trackEl.muted = !soundOn;
    if (button) button.textContent = label();
    return soundOn;
  }

  function bindButton(btn) {
    button = btn;
    btn.textContent = label();
    btn.addEventListener('click', toggle);
  }

  window.Sound = { unlock, startMusic, blip, glitch, chime, toggle, bindButton, isOn: () => soundOn };
})();
