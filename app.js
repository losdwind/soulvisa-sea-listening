(() => {
  'use strict';
  const data = window.ALBUM_DATA;
  const $ = id => document.getElementById(id);
  const audio = $('audio');
  let selected = data.tracks.findIndex(t => t.audio);
  let seeking = false;
  let playbackNotice = '';
  const systemMedia = window.ALBUM_MEDIA_SESSION?.create({
    audio, getTrack: () => data.tracks[selected], artist: data.artist, album: `《${data.title}》`,
    artwork: new URL('./assets/cover.jpg', location.href).href,
    onPlay: () => { if (audio.paused) togglePlay(); },
    onPrevious: () => skipTrack(-1), onNext: () => skipTrack(1)
  });
  const format = n => Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '—:—';
  function paragraph(parent, text, cls) { const p = document.createElement('p'); p.textContent = text; if (cls) p.className = cls; parent.append(p); }
  paragraph($('introduction'), data.introduction[0]);
  data.introduction.slice(1).forEach(p => paragraph($('intro-more'), p));
  const introDisclosure = document.querySelector('.about');
  introDisclosure.addEventListener('toggle', () => {
    introDisclosure.querySelector('.intro-toggle-label').textContent = introDisclosure.open ? '收起' : '展开';
  });
  function update() {
    const t = data.tracks[selected];
    $('now-title').textContent = t.title;
    $('status').textContent = !t.audio ? '尚未开放试听' : audio.error ? '音频加载失败' : !audio.paused ? '正在播放' : audio.ended ? '试听结束' : '待播放';
    $('play').disabled = !t.audio;
    $('rewind').disabled = !t.audio;
    $('play').textContent = audio.paused ? '▶' : 'Ⅱ';
    $('play').setAttribute('aria-label', `${audio.paused ? '播放' : '暂停'}${t.title}`);
    $('message').textContent = playbackNotice || (t.audio ? audio.error ? '音频暂时无法加载，请点击播放重试。' : audio.ended ? ($('continuous-play').checked ? '本次试听已结束。' : '本曲已结束，可点击播放重听。') : `《${t.title}》· 专辑试听` : '本曲暂未开放试听，可展开查看已有歌词。');
    $('elapsed').textContent = format(audio.currentTime);
    $('duration').textContent = t.audio ? format(Number.isFinite(audio.duration) ? audio.duration : t.duration) : '—:—';
    $('seek').disabled = !t.audio || !Number.isFinite(audio.duration);
    if (!seeking) $('seek').value = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
    document.querySelectorAll('.track').forEach((row, i) => {
      row.dataset.selected = String(i === selected);
      row.querySelector('.select-track').setAttribute('aria-pressed', String(i === selected));
      row.querySelector('.number').textContent = i === selected && !audio.paused ? 'Ⅱ' : String(i + 1).padStart(2, '0');
    });
  }
  function choose(i) {
    audio.pause();
    selected = i;
    playbackNotice = '';
    seeking = false;
    const t = data.tracks[i];
    if (t.audio) audio.src = t.audio;
    else { audio.removeAttribute('src'); audio.load(); }
    systemMedia?.syncTrack();
    update();
  }
  function skipTrack(direction) {
    if (direction < 0 && audio.currentTime > 3) { audio.currentTime = 0; if (audio.paused) togglePlay(); return; }
    let next = selected + direction;
    while (next >= 0 && next < data.tracks.length && !data.tracks[next].audio) next += direction;
    if (next < 0 || next >= data.tracks.length) return;
    choose(next); togglePlay(true);
  }
  async function togglePlay(automatic = false) {
    if (!data.tracks[selected].audio) return;
    playbackNotice = '';
    if (!audio.paused) { audio.pause(); return; }
    const requestedIndex = selected;
    try { systemMedia?.requestPlayback(); if (audio.error) { audio.load(); } await audio.play(); }
    catch (e) {
      if (requestedIndex !== selected) return;
      if (e.name === 'AbortError' && audio.paused) return;
      playbackNotice = automatic === true ? '自动播放未能开始，请点击播放继续。' : '暂时没能开始播放，请再点一次曲名或播放按钮。';
      update();
    }
  }
  async function advanceAfterEnd() {
    if (selected === data.tracks.length - 1) revealArrivalIfComplete();
    if (!$('continuous-play').checked) { update(); return; }
    const next = data.tracks.findIndex((track, i) => i > selected && track.audio);
    if (next < 0) { update(); return; }
    choose(next);
    await togglePlay(true);
  }
  let arrivalShown = false;
  function revealArrivalIfComplete() {
    const ranges = Array.from({ length: audio.played.length }, (_, i) => [audio.played.start(i), audio.played.end(i)]);
    if (arrivalShown || !audio.ended || !window.ALBUM_COMPLETION.isComplete(audio.duration, ranges)) return;
    arrivalShown = true;
    $('arrival').dataset.complete = 'true';
    $('arrival-title').focus({ preventScroll: true });
    $('arrival').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  let messageRequestId = null;
  let messageEncryptionKey;
  const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function encryptedCallback(payload) {
    if (!crypto.subtle) throw new Error('请使用系统浏览器打开此页后重试留言。');
    messageEncryptionKey ||= crypto.subtle.importKey('spki', Uint8Array.from(atob(data.messagePublicKey), c => c.charCodeAt(0)), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const rsa = await messageEncryptionKey;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const text = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text);
    const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsa, await crypto.subtle.exportKey('raw', key));
    const envelope = { key: base64url(new Uint8Array(wrapped)), iv: base64url(iv), payload: base64url(new Uint8Array(cipher)) };
    return data.messageEndpoint + '?data=' + base64url(new TextEncoder().encode(JSON.stringify(envelope)));
  }
  $('message-text').addEventListener('input', () => { messageRequestId = null; $('message-result').textContent = ''; });
  $('message-form').addEventListener('submit', async event => {
    event.preventDefault();
    const content = $('message-text').value.trim();
    if (!content) { $('message-result').textContent = '先写下一句话吧。'; return; }
    $('send-message').disabled = true; $('message-result').textContent = '正在留下这句话……';
    messageRequestId ||= crypto.randomUUID();
    try {
      const payload = { id: messageRequestId, content };
      const response = data.messageTransport === 'encrypted-callback'
        ? await fetch(await encryptedCallback(payload), { cache: 'no-store' })
        : await fetch(data.messageEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const receipt = await response.json();
      if (!response.ok) throw new Error(receipt.error || '暂时未能保存，请稍后重试。');
      $('message-result').textContent = receipt.storage === 'local-preview' ? '预览留言已保存在本地，未发送给李奥。' : '你的话已留下，谢谢你。';
      $('message-text').value = ''; messageRequestId = null;
    } catch (error) { $('message-result').textContent = error.message || '暂时未能保存，请稍后重试。'; }
    finally { $('send-message').disabled = false; }
  });
  let chapterContainer = $('tracks');
  data.tracks.forEach((t, i) => {
    const chapter = (data.chapters || []).find(c => c.startTrack === t.number);
    if (chapter) {
      chapterContainer = document.createElement('section'); chapterContainer.className = 'chapter'; chapterContainer.setAttribute('aria-labelledby', `chapter-${chapter.id}`);
      const heading = document.createElement('header'); heading.className = 'chapter-heading';
      paragraph(heading, `CHAPTER ${chapter.number}`, 'eyebrow');
      const title = document.createElement('h3'); title.id = `chapter-${chapter.id}`;
      const name = document.createElement('span'); name.textContent = chapter.title;
      const english = document.createElement('span'); english.className = 'chapter-english'; english.textContent = ` / ${chapter.titleEn}`;
      title.append(name, english); heading.append(title); chapterContainer.append(heading); $('tracks').append(chapterContainer);
    }
    const row = document.createElement('section'); row.className = 'track';
    const header = document.createElement('div'); header.className = 'row';
    const select = document.createElement('button'); select.className = 'select-track';
    select.setAttribute('aria-label', `${t.audio ? '试听' : '选择'} ${t.title}`);
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(i + 1).padStart(2, '0');
    const copy = document.createElement('span'); copy.className = 'track-copy';
    const title = document.createElement('span'); title.className = 'track-title'; title.textContent = t.title; copy.append(title);
    if (t.brief) { const summary = document.createElement('span'); summary.className = 'track-summary'; summary.textContent = t.brief; copy.append(summary); }
    select.append(number, copy);
    select.addEventListener('click', () => { if (selected !== i) choose(i); if (t.audio) togglePlay(); });
    header.append(select);
    if (t.lyrics.length || t.credit) {
      const contentLabel = t.lyrics.length ? '歌词' : '制作名单';
      const button = document.createElement('button'); button.className = `chevron${t.lyrics.length ? '' : ' credits-only'}`; const label = document.createElement('span'); label.textContent = contentLabel; const arrow = document.createElement('span'); arrow.className = 'chevron-icon'; arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden', 'true'); button.append(label, arrow); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', `展开${t.title}${contentLabel}`); button.setAttribute('aria-controls', `lyrics-${i}`);
      const details = document.createElement('div'); details.id = `lyrics-${i}`; details.className = 'track-details'; details.hidden = true;
      if (t.documentHeading) paragraph(details, t.documentHeading, 'document-heading');
      if (t.creditsTop?.length) paragraph(details, t.creditsTop.join('\n'), 'credit');
      if (t.lyrics.length) paragraph(details, t.lyrics.join('\n'), 'lyrics');
      if (t.creditsBottom?.length) paragraph(details, t.creditsBottom.join('\n'), 'credit credit-after');
      button.addEventListener('click', () => { details.hidden = !details.hidden; button.setAttribute('aria-expanded', String(!details.hidden)); button.setAttribute('aria-label', `${details.hidden ? '展开' : '收起'}${t.title}${contentLabel}`); });
      header.append(button); row.append(header, details);
    } else { const state = document.createElement('span'); state.className = 'track-unavailable'; state.textContent = t.audio ? '暂无歌词' : '未开放'; header.append(state); row.append(header); }
    chapterContainer.append(row);
  });
  audio.volume = 0.8;
  choose(selected);
  $('play').addEventListener('click', () => togglePlay());
  $('continuous-play').addEventListener('change', update);
  audio.addEventListener('ended', advanceAfterEnd);
  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'ended', 'error', 'emptied'].forEach(event => audio.addEventListener(event, update));
  $('seek').addEventListener('input', () => { seeking = true; $('elapsed').textContent = format(Number($('seek').value) / 100 * audio.duration); });
  $('seek').addEventListener('change', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number($('seek').value) / 100 * audio.duration; seeking = false; update(); });
  $('rewind').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  $('volume').addEventListener('input', () => { audio.volume = Number($('volume').value); audio.muted = false; muteUpdate(); });
  function muteUpdate() { $('mute').textContent = audio.muted ? '×' : '♪'; $('mute').setAttribute('aria-label', audio.muted ? '取消静音' : '静音'); }
  $('mute').addEventListener('click', () => { audio.muted = !audio.muted; muteUpdate(); });
  let theme = 'dark'; try { theme = localStorage.getItem('liao-listening-theme') || 'dark'; } catch {}
  function setTheme(value) { document.documentElement.dataset.theme = value; $('theme').setAttribute('aria-label', `切换到${value === 'dark' ? '浅' : '深'}色模式`); $('theme').textContent = value === 'dark' ? '☼' : '◐'; }
  setTheme(theme);
  $('theme').addEventListener('click', () => { theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(theme); try { localStorage.setItem('liao-listening-theme', theme); } catch {} });
  $('cover-open').addEventListener('click', () => {
    const dialog = $('cover-dialog');
    const image = dialog.querySelector('img[data-src]');
    if (image && !image.getAttribute('src')) image.src = image.dataset.src;
    dialog.showModal();
  });
  document.querySelectorAll('dialog').forEach(dialog => { dialog.querySelector('.close').addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } }); });
})();
