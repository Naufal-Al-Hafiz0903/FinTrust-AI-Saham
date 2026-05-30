(function () {
  const VERSION = '20260529-chart-text-cleanup-v7';
  let timer = null;

  function cleanChartBox(chartId) {
    const canvas = document.getElementById(chartId);
    const compact = document.getElementById(chartId + '__fintrust_compact');
    const dom = document.getElementById(chartId + '__fintrust_dom');

    const box =
      compact?.closest?.('.chart-box') ||
      dom?.closest?.('.chart-box') ||
      canvas?.closest?.('.chart-box') ||
      compact?.parentElement ||
      dom?.parentElement ||
      canvas?.parentElement;

    if (!box) return;

    box.classList.add('fintrust-clean-chart');
    box.classList.add('fintrust-compact-ready');

    box.style.setProperty('height', 'auto', 'important');
    box.style.setProperty('min-height', '0', 'important');
    box.style.setProperty('max-height', 'none', 'important');
    box.style.setProperty('overflow', 'hidden', 'important');
    box.style.setProperty('width', '100%', 'important');
    box.style.setProperty('max-width', '100%', 'important');
    box.style.setProperty('min-width', '0', 'important');

    /* Sembunyikan caption lama yang berada langsung di chart-box */
    Array.from(box.children).forEach(function (child) {
      if (!child) return;

      const isOldCaption =
        child.tagName === 'P' &&
        !child.closest('.fintrust-compact-chart') &&
        !child.closest('.fintrust-dom-chart');

      if (isOldCaption) {
        child.style.setProperty('display', 'none', 'important');
        child.style.setProperty('visibility', 'hidden', 'important');
        child.style.setProperty('height', '0', 'important');
        child.style.setProperty('max-height', '0', 'important');
        child.style.setProperty('overflow', 'hidden', 'important');
        child.style.setProperty('margin', '0', 'important');
        child.style.setProperty('padding', '0', 'important');
      }
    });

    /* Hapus caption baru yang dobel dalam chart compact */
    const captions = box.querySelectorAll('.fintrust-compact-chart .fintrust-chart-caption');
    captions.forEach(function (caption, index) {
      if (index > 0) {
        caption.remove();
      }
    });

    /* Pastikan caption tidak keluar layar */
    box.querySelectorAll('.fintrust-chart-caption').forEach(function (caption) {
      caption.style.setProperty('display', '-webkit-box', 'important');
      caption.style.setProperty('-webkit-line-clamp', window.innerWidth <= 768 ? '1' : '2', 'important');
      caption.style.setProperty('line-clamp', window.innerWidth <= 768 ? '1' : '2', 'important');
      caption.style.setProperty('-webkit-box-orient', 'vertical', 'important');
      caption.style.setProperty('white-space', 'normal', 'important');
      caption.style.setProperty('overflow-wrap', 'anywhere', 'important');
      caption.style.setProperty('overflow', 'hidden', 'important');
      caption.style.setProperty('text-overflow', 'ellipsis', 'important');
      caption.style.setProperty('max-width', '100%', 'important');
    });
  }

  function cleanDuplicateTexts() {
    cleanChartBox('scoreChart');
    cleanChartBox('pieChart');

    /* Pastikan teks panjang di rekomendasi tidak keluar layout */
    document.querySelectorAll('.result-area, .results, .panel, .card, .comparison-panel, .recommendation-card, .recommendation-item, .stock-card, .stock-mobile-card').forEach(function (node) {
      node.style.setProperty('min-width', '0', 'important');
      node.style.setProperty('max-width', '100%', 'important');
      node.style.setProperty('box-sizing', 'border-box', 'important');
      node.style.setProperty('overflow-wrap', 'anywhere', 'important');
      node.style.setProperty('white-space', 'normal', 'important');
    });

    /* Fix semua teks BELI agar tidak pecah */
    document.querySelectorAll('td, div, span, b, strong, button').forEach(function (node) {
      if (!node || node.children.length > 3) return;

      const raw = (node.textContent || '').trim();
      const compact = raw.replace(/\s+/g, '').toUpperCase();

      if (compact === 'BELI') {
        node.classList.add('fintrust-nowrap-beli');
        node.style.setProperty('white-space', 'nowrap', 'important');
        node.style.setProperty('word-break', 'keep-all', 'important');
        node.style.setProperty('overflow-wrap', 'normal', 'important');
        node.style.setProperty('writing-mode', 'horizontal-tb', 'important');
        node.style.setProperty('text-orientation', 'mixed', 'important');

        if (node.parentElement) {
          node.parentElement.classList.add('fintrust-beli-parent');
          node.parentElement.style.setProperty('min-width', '68px', 'important');
          node.parentElement.style.setProperty('overflow', 'visible', 'important');
        }
      }
    });
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(cleanDuplicateTexts, delay || 100);
  }

  window.addEventListener('load', function () {
    schedule(80);
    schedule(500);
    schedule(1200);
  });

  window.addEventListener('resize', function () {
    schedule(140);
  });

  window.addEventListener('orientationchange', function () {
    schedule(240);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(80);
    schedule(500);
  });

  document.addEventListener('fintrust:contentchange', function () {
    schedule(100);
  });

  document.addEventListener('fintrust:modechange', function () {
    schedule(100);
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(function () {
      schedule(180);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  schedule(100);
  schedule(700);
  schedule(1500);

  window.__FINTRUST_CHART_TEXT_CLEANUP__ = VERSION;
})();
