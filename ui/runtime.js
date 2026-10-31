// Shared runtime for the title/loading UI direction mock-ups.
// A page is a fixed 1920x1080 stage scaled to the viewport. Query: ?mode=title|loading&bg=<image url>&progress=0.65
// window.UI.frame(t, bg) sets the background frame and freezes every CSS animation at t seconds (deterministic).
(function () {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  root.dataset.mode = q.get('mode') || 'title';
  const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); root.style.setProperty('--scale', s); };
  addEventListener('resize', fit); fit();
  const bg = document.getElementById('bg');
  if (q.get('bg')) bg.src = q.get('bg');
  const prog = parseFloat(q.get('progress') || '0.65');
  root.style.setProperty('--p', prog);
  window.UI = {
    progress: prog,
    async frame(t, src) {
      if (src && bg.getAttribute('src') !== src) { bg.src = src; await bg.decode(); }
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
      root.style.setProperty('--t', t);
      if (window.onFrame) window.onFrame(t);
      await document.fonts.ready;
    },
  };
  // Live mode: let CSS animations run on their own. Recording mode (?record=1): start paused at 0.
  if (q.get('record')) document.addEventListener('DOMContentLoaded', () => window.UI.frame(0));
})();
