(function (root) {
  'use strict';
  // Native played ranges exclude audio skipped by seeking. Small edge tolerance
  // accommodates decoder/timeupdate rounding, without allowing skipped sections.
  function isComplete(duration, ranges, tolerance = 0.35) {
    if (!Number.isFinite(duration) || duration <= 0 || !ranges.length) return false;
    let coveredUntil = 0, missing = 0;
    for (const [start, end] of ranges) {
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return false;
      missing += Math.max(0, start - coveredUntil);
      if (missing > tolerance) return false;
      coveredUntil = Math.max(coveredUntil, end);
    }
    return missing + Math.max(0, duration - coveredUntil) <= tolerance;
  }
  const api = { isComplete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ALBUM_COMPLETION = api;
})(typeof window !== 'undefined' ? window : globalThis);
