/*
  scenes.js — переключение сцен.

  Сцены идут вперёд: старт → предупреждение → пожелания → торт → письмо.
  Возврата назад нет; начать заново можно только перезагрузкой страницы
  (кнопка «пройти заново» в письме).

  Использование из других файлов:
    Scenes.next()            — перейти к следующей сцене
    Scenes.show('cake')      — показать конкретную сцену
    Scenes.current()         — имя текущей сцены
    Scenes.on('cake', fn)    — вызвать fn при входе в сцену
*/
(function () {
  const ORDER = ['start', 'notice', 'wishes', 'cake', 'letter'];
  const views = {};
  const listeners = {};
  let current = 'start';

  ORDER.forEach(name => { views[name] = document.getElementById('view-' + name); });

  function show(name) {
    if (!views[name]) { console.warn('Scenes: нет сцены «' + name + '»'); return; }
    if (name === current && views[name].classList.contains('active')) return;

    ORDER.forEach(n => views[n].classList.toggle('active', n === name));
    current = name;
    window.scrollTo(0, 0);

    (listeners[name] || []).forEach(fn => fn());
  }

  function next() {
    const i = ORDER.indexOf(current);
    if (i >= 0 && i < ORDER.length - 1) show(ORDER[i + 1]);
  }

  function on(name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
  }

  window.Scenes = { show, next, on, current: () => current, order: ORDER };
})();
