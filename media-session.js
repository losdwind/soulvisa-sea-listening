(function (root) {
  'use strict';
  function create(options) {
    const audio = options.audio;
    const nav = options.navigator || root.navigator;
    const Metadata = options.MediaMetadata || root.MediaMetadata;
    const session = nav?.mediaSession;
    function requestPlayback() {
      try { if (nav?.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback'; } catch {}
    }
    function syncTrack() {
      if (!session || !Metadata) return;
      const track = options.getTrack();
      if (!track) return;
      try {
        session.metadata = new Metadata({ title: track.title, artist: options.artist, album: options.album, artwork: [{ src: options.artwork, type: 'image/jpeg' }] });
      } catch {}
    }
    function syncPlayback() {
      if (!session) return;
      try { session.playbackState = audio.paused || audio.ended ? 'paused' : 'playing'; } catch {}
      if (typeof session.setPositionState !== 'function') return;
      try {
        if (Number.isFinite(audio.duration) && audio.duration > 0 && Number.isFinite(audio.playbackRate) && audio.playbackRate > 0) {
          session.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.max(0, Math.min(audio.currentTime, audio.duration)) });
        } else session.setPositionState();
      } catch {}
    }
    function seek(position, fast) {
      if (!Number.isFinite(position) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const target = Math.max(0, Math.min(position, audio.duration));
      if (fast && typeof audio.fastSeek === 'function') audio.fastSeek(target);
      else audio.currentTime = target;
      syncPlayback();
    }
    if (session && typeof session.setActionHandler === 'function') {
      const actions = {
        play: () => { if (audio.paused) options.onPlay(); },
        pause: () => audio.pause(),
        stop: () => { audio.pause(); seek(0); },
        previoustrack: options.onPrevious,
        nexttrack: options.onNext,
        seekbackward: details => seek(audio.currentTime - (details.seekOffset || 10)),
        seekforward: details => seek(audio.currentTime + (details.seekOffset || 10)),
        seekto: details => seek(details.seekTime, details.fastSeek)
      };
      for (const [action, handler] of Object.entries(actions)) {
        try { session.setActionHandler(action, handler); } catch {}
      }
    }
    for (const name of ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'timeupdate', 'ratechange', 'seeked', 'emptied']) audio.addEventListener(name, syncPlayback);
    return { requestPlayback, syncTrack, syncPlayback };
  }
  if (typeof module === 'object' && module.exports) module.exports = { create };
  else root.ALBUM_MEDIA_SESSION = { create };
})(typeof window === 'object' ? window : globalThis);
