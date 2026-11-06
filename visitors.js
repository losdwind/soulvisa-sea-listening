(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const test = params.get('analytics') === 'test';
  const allowed = (location.hostname === 'wcnujr548fca.feishu.link'
      && /^\/app\/app_17hce27jycz\/listen\/?$/.test(location.pathname))
    || (location.hostname === 'losdwind.github.io'
      && /^\/soulvisa-sea-listening\/(?:index\.html)?$/.test(location.pathname));
  const state = value => { document.documentElement.dataset.visitorTracking = value; };
  if (!allowed || params.get('analytics') === 'off' || (navigator.webdriver && !test)
      || /bot|crawler|spider|headless|preview|slurp/i.test(navigator.userAgent)) {
    state('excluded'); return;
  }
  const key = 'soulvisa-visitor-v1';
  const sentKey = `${key}-confirmed-${test ? 'test' : 'live'}`;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const read = name => {
    try { const value = localStorage.getItem(name); if (value) return value; }
    catch { /* First-party cookie fallback below. */ }
    return document.cookie.split('; ').find(item => item.startsWith(`${name}=`))?.split('=')[1];
  };
  const write = (name, value) => {
    try { localStorage.setItem(name, value); }
    catch { document.cookie = `${name}=${value}; Max-Age=63072000; Path=/; SameSite=Lax; Secure`; }
    return read(name) === value;
  };
  let visitorId;
  try {
    visitorId = read(key);
    if (!uuid.test(visitorId || '')) {
      visitorId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
        : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
          digit => (Number(digit) ^ crypto.getRandomValues(new Uint8Array(1))[0]
            & 15 >> Number(digit) / 4).toString(16));
      // Without persistent first-party storage, skip rather than count every
      // refresh as a new person. No browser fingerprint is substituted.
      if (!write(key, visitorId)) { state('storage-unavailable'); return; }
    }
    if (read(sentKey) === visitorId) { state('already-counted'); return; }
  } catch { state('storage-unavailable'); return; }
  let timer;
  let pending = false;
  let attempts = 0;
  let complete = false;
  state('waiting');
  async function record() {
    timer = undefined;
    if (document.visibilityState !== 'visible' || pending || complete) return;
    pending = true; attempts += 1;
    const query = new URLSearchParams({ id: visitorId });
    if (test) query.set('test', '1');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(
        `https://wcnujr548fca.feishu.link/app/app_17hce27jycz/listener-visitors/collect?${query}`,
        { cache: 'no-store', credentials: 'omit', signal: controller.signal },
      );
      const receipt = response.ok ? await response.json() : null;
      if (receipt?.accepted === true) {
        write(sentKey, visitorId); complete = true;
        document.removeEventListener('visibilitychange', schedule);
        state(test ? 'test-counted' : 'counted');
      } else state('unconfirmed');
    } catch { state('unconfirmed'); }
    finally {
      clearTimeout(timeout);
      pending = false;
      if (!complete && attempts < 2) schedule();
    }
  }
  function schedule() {
    if (timer) { clearTimeout(timer); timer = undefined; }
    if (document.visibilityState === 'visible' && !complete && !pending && attempts < 2) {
      // Run after the document loads, away from the first render and playback.
      timer = setTimeout(record, attempts ? 10000 : 800);
    }
  }
  document.addEventListener('visibilitychange', schedule);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
