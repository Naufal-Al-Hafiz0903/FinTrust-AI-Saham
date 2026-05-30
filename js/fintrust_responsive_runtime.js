(function () {
  'use strict';

  const MOBILE_MAX = 768;
  const TABLET_MAX = 1024;
  let lastMode = '';
  let timer = null;

  function width() {
    const selectors = ['.content', '.main', '.app-shell', '#results'];
    const elementWidths = selectors.reduce(function(acc, sel) {
      document.querySelectorAll(sel).forEach(function(node) {
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        const w = (rect && rect.width) || node.clientWidth || 0;
        if (w > 0) acc.push(w);
      });
      return acc;
    }, []);
    const vals = [
      window.visualViewport && window.visualViewport.width,
      document.documentElement.clientWidth,
      window.innerWidth,
      document.body && document.body.clientWidth,
      window.screen && window.screen.width
    ].concat(elementWidths).map(Number).filter(function(v){ return Number.isFinite(v) && v > 0; });
    return vals.length ? Math.min.apply(Math, vals) : 1024;
  }

  function compactByContainer(node, bp) {
    const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    const w = (rect && rect.width) || (node && node.clientWidth) || width();
    return w > 0 && w <= (bp || 680);
  }

  function syncCompactBlocks(mode) {
    document.querySelectorAll('[data-fintrust-comparison]').forEach(function(panel) {
      panel.classList.toggle('is-compact', mode === 'mobile' || compactByContainer(panel, 680));
    });
    document.querySelectorAll('#predictionContainerMount, .prediction-card').forEach(function(panel) {
      panel.classList.toggle('is-compact', mode === 'mobile' || compactByContainer(panel, 680));
    });
    document.querySelectorAll('.mode-row').forEach(function(row) {
      row.classList.toggle('is-compact', mode === 'mobile' || compactByContainer(row, 560));
    });
  }

  function getMode() {
    const w = width();
    if (w <= MOBILE_MAX) return 'mobile';
    if (w <= TABLET_MAX) return 'tablet';
    return 'desktop';
  }

  function closeDrawerForDesktop(mode) {
    if (mode === 'mobile') return;
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }

  function applyMode() {
    const mode = getMode();
    const root = document.documentElement;
    const body = document.body;

    root.dataset.uiMode = mode;
    body.classList.toggle('is-mobile-ui', mode === 'mobile');
    body.classList.toggle('is-tablet-ui', mode === 'tablet');
    body.classList.toggle('is-desktop-ui', mode === 'desktop');

    closeDrawerForDesktop(mode);
    syncCompactBlocks(mode);

    if (mode !== lastMode) {
      lastMode = mode;
      document.dispatchEvent(new CustomEvent('fintrust:modechange', { detail: { mode } }));
    }
  }

  function scheduleApply() {
    clearTimeout(timer);
    timer = setTimeout(applyMode, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMode, { once: true });
  } else {
    applyMode();
  }

  window.addEventListener('resize', scheduleApply, { passive: true });
  document.addEventListener('fintrust:contentchange', scheduleApply);
  window.addEventListener('orientationchange', function () {
    setTimeout(applyMode, 180);
  }, { passive: true });
  window.addEventListener('pageshow', applyMode, { passive: true });
})();
