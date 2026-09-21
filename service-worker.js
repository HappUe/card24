/*
  service-worker.js — сохраняет файлы открытки на устройстве.

  Что это даёт: после первого захода страница открывается мгновенно (файлы уже
  на телефоне) и продолжает работать без интернета. Шрифты Google Fonts не
  кешируются здесь — это отдельный источник (CDN), браузер сам умеет их кешировать.

  Как обновляется: у кеша есть номер версии (CACHE_VERSION). Если правишь файлы
  открытки и хочешь, чтобы у людей, которые уже открывали её раньше, обновилась
  версия, — подними число в CACHE_VERSION на 1. Старый кеш удалится сам.

  Стратегия: «сеть, если есть, иначе — сохранённая копия». Так, пока есть
  интернет, человек всегда видит свежую версию; без интернета — последнюю
  сохранённую.
*/
const CACHE_VERSION = 4;
const CACHE_NAME = 'birthday-card-v' + CACHE_VERSION;

// всё, без чего открытка не соберётся — сохраняем сразу при установке
const PRECACHE_FILES = [
  './',
  './index.html',
  './manifest.json',

  './content/content.js',
  './content/clouds.js',

  './src/css/base.css',
  './src/css/effects.css',
  './src/css/layout.css',
  './src/css/scenes/start.css',
  './src/css/scenes/notice.css',
  './src/css/scenes/wishes.css',
  './src/css/scenes/cake.css',
  './src/css/scenes/confetti.css',
  './src/css/scenes/letter.css',
  './src/css/scenes/clouds.css',

  './src/js/audio.js',
  './src/js/typewriter.js',
  './src/js/pagefx.js',
  './src/js/scenes.js',
  './src/js/notice.js',
  './src/js/wishes.js',
  './src/js/cake.js',
  './src/js/confetti.js',
  './src/js/letterimage.js',
  './src/js/letter.js',
  './src/js/clouds.js',
  './src/js/main.js',

  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',

  './assets/audio/background.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_FILES))
      .then(() => self.skipWaiting())            // не ждать закрытия старых вкладок — обновиться сразу
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))   // убрать старые версии кеша
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;               // сохраняем только обычные загрузки страницы/файлов
  if (new URL(req.url).origin !== location.origin) return;   // шрифты и прочее внешнее — мимо кеша, обычной сетью

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));   // держим кеш свежим, пока есть сеть
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
