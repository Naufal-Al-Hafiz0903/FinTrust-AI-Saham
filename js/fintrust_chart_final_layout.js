(function () {
  const VERSION = '20260529-chart-final-layout-v5';
  let timer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function forceHideCanvas(canvas) {
    if (!canvas) return;

    canvas.dataset.fintrustDomHidden = '1';
    canvas.dataset.fintrustForceHidden = '1';

    canvas.style.setProperty('display', 'none', 'important');
    canvas.style.setProperty('visibility', 'hidden', 'important');
    canvas.style.setProperty('opacity', '0', 'important');
    canvas.style.setProperty('width', '0', 'important');
    canvas.style.setProperty('height', '0', 'important');
    canvas.style.setProperty('min-width', '0', 'important');
    canvas.style.setProperty('min-height', '0', 'important');
    canvas.style.setProperty('max-width', '0', 'important');
    canvas.style.setProperty('max-height', '0', 'important');
    canvas.style.setProperty('margin', '0', 'important');
    canvas.style.setProperty('padding', '0', 'important');
    canvas.style.setProperty('border', '0', 'important');
    canvas.style.setProperty('position', 'absolute', 'important');
    canvas.style.setProperty('pointer-events', 'none', 'important');
  }

  function normalizeOne(canvasId) {
    const canvas = byId(canvasId);
    const dom = byId(canvasId + '__fintrust_dom');

    if (!canvas && !dom) return;

    const box =
      canvas?.closest?.('.chart-box') ||
      dom?.closest?.('.chart-box') ||
      canvas?.parentElement ||
      dom?.parentElement;

    if (!box) return;

    box.classList.add('fintrust-dom-ready');
    box.style.setProperty('height', 'auto', 'important');
    box.style.setProperty('min-height', '0', 'important');
    box.style.setProperty('max-height', 'none', 'important');
    box.style.setProperty('overflow', 'hidden', 'important');
    box.style.setProperty('width', '100%', 'important');
    box.style.setProperty('max-width', '100%', 'important');
    box.style.setProperty('min-width', '0', 'important');

    if (canvas) {
      forceHideCanvas(canvas);
    }

    if (dom) {
      dom.style.setProperty('display', 'block', 'important');
      dom.style.setProperty('width', '100%', 'important');
      dom.style.setProperty('max-width', '100%', 'important');
      dom.style.setProperty('min-width', '0', 'important');
      dom.style.setProperty('height', 'auto', 'important');

      if (dom.parentElement !== box) {
        box.appendChild(dom);
      }
    }
  }

  function normalizeAll() {
    normalizeOne('scoreChart');
    normalizeOne('pieChart');

    document.querySelectorAll('.chart-box canvas[data-fintrust-dom-hidden="1"], .chart-box canvas[data-fintrust-force-hidden="1"]').forEach(forceHideCanvas);

    document.querySelectorAll('.chart-box').forEach(function (box) {
      if (box.querySelector('.fintrust-dom-chart')) {
        box.classList.add('fintrust-dom-ready');
        box.style.setProperty('height', 'auto', 'important');
        box.style.setProperty('min-height', '0', 'important');
        box.style.setProperty('max-height', 'none', 'important');
      }
    });
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(normalizeAll, delay || 100);
  }

  const oldBar = window.drawBarChart;
  const oldPie = window.drawPieChart;

  if (typeof oldBar === 'function' && !oldBar.__fintrustFinalWrapped) {
    window.drawBarChart = function () {
      const result = oldBar.apply(this, arguments);
      schedule(0);
      schedule(150);
      return result;
    };
    window.drawBarChart.__fintrustFinalWrapped = true;
  }

  if (typeof oldPie === 'function' && !oldPie.__fintrustFinalWrapped) {
    window.drawPieChart = function () {
      const result = oldPie.apply(this, arguments);
      schedule(0);
      schedule(150);
      return result;
    };
    window.drawPieChart.__fintrustFinalWrapped = true;
  }

  window.addEventListener('load', function () {
    schedule(50);
    schedule(500);
    schedule(1200);
  });

  window.addEventListener('resize', function () {
    schedule(150);
  });

  window.addEventListener('orientationchange', function () {
    schedule(250);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(50);
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
      attributes: true,
      attributeFilter: ['style', 'class', 'data-fintrust-dom-hidden']
    });
  }

  schedule(100);
  schedule(700);
  schedule(1500);

  window.__FINTRUST_CHART_FINAL_LAYOUT__ = VERSION;
})();
