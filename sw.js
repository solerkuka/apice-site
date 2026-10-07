/* Ápice Imóveis — service worker simples: sempre busca a versão nova na internet;
   se estiver sem sinal, abre a última versão guardada. Não guarda nada do Supabase (fotos, login, dados). */
const V = 'apice-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })
      .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
