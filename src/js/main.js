/*
  main.js — точка входа: связывает всё вместе.
  Подключается последним, когда уже загружены content, audio, typewriter, scenes
  и скрипты сцен.
*/
(function () {
  /* ---------- тексты из content/content.js ---------- */
  // Всё, у чего есть data-content="раздел.ключ", получает текст из CONTENT.
  function fillTexts() {
    const C = window.CONTENT;
    if (!C) { console.warn('main: content.js не загрузился'); return; }
    document.querySelectorAll('[data-content]').forEach(el => {
      const value = el.dataset.content.split('.').reduce((o, k) => (o ? o[k] : undefined), C);
      if (typeof value === 'string') el.textContent = value;
    });
  }

  /* ---------- старт ---------- */
  // Прохождение всегда идёт с начала: ни ссылки «перечитать письмо», ни запоминания
  // в браузере нет — к письму можно дойти только через пожелания и торт.
  const soundBtn = document.getElementById('sound-toggle');
  const startBtn = document.getElementById('start-btn');
  const musicVol = document.getElementById('music-vol');

  function beginExperience() {
    // Звук можно включать только из клика/тапа — поэтому здесь
    Sound.unlock();
    Sound.startMusic();
    soundBtn.hidden = false;
    musicVol.hidden = false;
  }

  function init() {
    fillTexts();
    Sound.bindButton(soundBtn);
    Sound.bindMusicSlider(document.getElementById('music-vol-range'), document.getElementById('music-vol-val'));

    startBtn.addEventListener('click', () => {
      beginExperience();
      Scenes.next();                  // старт → предупреждение (дальше — пожелания)
    });
  }

  init();
})();
