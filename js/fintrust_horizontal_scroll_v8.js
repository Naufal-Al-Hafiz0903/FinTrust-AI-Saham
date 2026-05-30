(function () {
  const VERSION = '20260529-horizontal-scroll-v8';
  let timer = null;

  function wrapChartBox(box) {
    if (!box || box.dataset.fintrustHscroll === '1') return;

    const children = Array.from(box.children).filter(function (child) {
      if (!child) return false;
      if (child.tagName === 'CANVAS') return false;
      if (child.id && child.id.includes('__fintrust_dom')) return true;
      if (child.id && child.id.includes('__fintrust_compact')) return true;
      if (child.classList && child.classList.contains('fintrust-compact-chart')) return true;
      if (child.classList && child.classList.contains('fintrust-dom-chart')) return true;
      if (child.tagName === 'P') return true;
      return false;
    });

    if (!children.length) return;

    const inner = document.createElement('div');
    inner.className = 'fintrust-hscroll-inner';

    children.forEach(function (child) {
      inner.appendChild(child);
    });

    box.appendChild(inner);
    box.classList.add('fintrust-hscroll-ready');
    box.dataset.fintrustHscroll = '1';

    box.style.setProperty('overflow-x', 'auto', 'important');
    box.style.setProperty('overflow-y', 'hidden', 'important');
    box.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    box.style.setProperty('max-width', '100%', 'important');
  }

  function unwrapBrokenNested() {
    document.querySelectorAll('.fintrust-hscroll-inner .fintrust-hscroll-inner').forEach(function (nested) {
      const parent = nested.parentElement;
      while (nested.firstChild) {
        parent.insertBefore(nested.firstChild, nested);
      }
      nested.remove();
    });
  }

  function applyHorizontalScroll() {
    document.querySelectorAll('.chart-box').forEach(function (box) {
      const hasChart =
        box.querySelector('#scoreChart, #pieChart, .fintrust-compact-chart, .fintrust-dom-chart, [id*="__fintrust_compact"], [id*="__fintrust_dom"]');

      if (hasChart) {
        wrapChartBox(box);
      }
    });

    unwrapBrokenNested();

    document.querySelectorAll('.recommendation-card, .recommendation-item, .stock-card, .stock-mobile-card').forEach(function (node) {
      node.classList.add('fintrust-hscroll-ready');
      node.style.setProperty('overflow-x', 'auto', 'important');
      node.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    });
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(applyHorizontalScroll, delay || 120);
  }

  window.addEventListener('load', function () {
    schedule(100);
    schedule(700);
    schedule(1500);
  });

  window.addEventListener('resize', function () {
    schedule(160);
  });

  window.addEventListener('orientationchange', function () {
    schedule(260);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(100);
    schedule(700);
  });

  document.addEventListener('fintrust:contentchange', function () {
    schedule(120);
  });

  document.addEventListener('fintrust:modechange', function () {
    schedule(120);
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(function () {
      schedule(220);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  schedule(250);
  schedule(1000);

  window.__FINTRUST_HORIZONTAL_SCROLL__ = VERSION;
})();
