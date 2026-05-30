(function () {
  var VERSION = '20260529-force-horizontal-scroll-v9';
  var timer = null;

  function isChartBox(box) {
    if (!box) return false;

    return !!(
      box.querySelector('#scoreChart') ||
      box.querySelector('#pieChart') ||
      box.querySelector('.fintrust-compact-chart') ||
      box.querySelector('.fintrust-dom-chart') ||
      box.querySelector('[id$="__fintrust_compact"]') ||
      box.querySelector('[id$="__fintrust_dom"]') ||
      /Composite Score|Alokasi beli|Grafik skor/i.test(box.textContent || '')
    );
  }

  function unwrapOld(box) {
    if (!box) return;

    box.querySelectorAll('.fintrust-hscroll-inner .fintrust-hscroll-inner, .fintrust-xscroll-inner .fintrust-xscroll-inner').forEach(function (nested) {
      var parent = nested.parentElement;
      while (nested.firstChild) {
        parent.insertBefore(nested.firstChild, nested);
      }
      nested.remove();
    });
  }

  function ensureInner(box) {
    var inner = box.querySelector(':scope > .fintrust-xscroll-inner');

    if (inner) return inner;

    var oldInner = box.querySelector(':scope > .fintrust-hscroll-inner');
    if (oldInner) {
      oldInner.classList.remove('fintrust-hscroll-inner');
      oldInner.classList.add('fintrust-xscroll-inner');
      return oldInner;
    }

    inner = document.createElement('div');
    inner.className = 'fintrust-xscroll-inner';

    var children = Array.from(box.childNodes).filter(function (node) {
      if (!node) return false;

      if (node.nodeType === 3) {
        return (node.textContent || '').trim().length > 0;
      }

      if (node.nodeType !== 1) return false;

      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return false;
      return true;
    });

    children.forEach(function (child) {
      inner.appendChild(child);
    });

    box.appendChild(inner);
    return inner;
  }

  function addHint(box) {
    if (box.querySelector(':scope > .fintrust-scroll-hint')) return;

    var hint = document.createElement('div');
    hint.className = 'fintrust-scroll-hint';
    hint.textContent = 'Geser kiri-kanan untuk melihat grafik penuh ↔';
    box.appendChild(hint);
  }

  function forceScrollable(box) {
    if (!box || !isChartBox(box)) return;

    unwrapOld(box);

    var inner = ensureInner(box);

    box.classList.add('fintrust-xscroll-force');
    box.classList.remove('fintrust-hscroll-ready');
    box.dataset.fintrustForceScroll = '1';

    box.style.removeProperty('overflow');
    box.style.setProperty('overflow-x', 'auto', 'important');
    box.style.setProperty('overflow-y', 'hidden', 'important');
    box.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    box.style.setProperty('touch-action', 'pan-x pan-y', 'important');
    box.style.setProperty('max-width', '100%', 'important');
    box.style.setProperty('min-width', '0', 'important');
    box.style.setProperty('box-sizing', 'border-box', 'important');

    inner.style.setProperty('max-width', 'none', 'important');
    inner.style.setProperty('box-sizing', 'border-box', 'important');

    if (window.innerWidth <= 768) {
      inner.style.setProperty('width', '430px', 'important');
      inner.style.setProperty('min-width', '430px', 'important');
    } else {
      inner.style.setProperty('width', '100%', 'important');
      inner.style.setProperty('min-width', '100%', 'important');
    }

    addHint(box);

    bindDragScroll(box);
  }

  function bindDragScroll(el) {
    if (!el || el.dataset.fintrustDragScroll === '1') return;

    el.dataset.fintrustDragScroll = '1';

    var isDown = false;
    var startX = 0;
    var scrollLeft = 0;
    var moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (el.scrollWidth <= el.clientWidth) return;

      isDown = true;
      moved = false;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;

      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    el.addEventListener('pointermove', function (e) {
      if (!isDown) return;

      var dx = e.clientX - startX;

      if (Math.abs(dx) > 3) {
        moved = true;
        el.scrollLeft = scrollLeft - dx;
        e.preventDefault();
      }
    });

    function endDrag(e) {
      if (!isDown) return;

      isDown = false;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (moved) {
        e.preventDefault();
      }
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('mouseleave', function () {
      isDown = false;
    });

    el.addEventListener('wheel', function (e) {
      if (el.scrollWidth <= el.clientWidth) return;

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  function applyScroll() {
    document.querySelectorAll('.chart-box').forEach(forceScrollable);

    document.querySelectorAll('.recommendation-card, .recommendation-item, .stock-card, .stock-mobile-card').forEach(function (node) {
      node.style.setProperty('overflow-x', 'auto', 'important');
      node.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
      node.style.setProperty('max-width', '100%', 'important');
      bindDragScroll(node);
    });
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(applyScroll, delay || 120);
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
    var observer = new MutationObserver(function () {
      schedule(220);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  schedule(250);
  schedule(1000);
  schedule(2000);

  window.__FINTRUST_FORCE_HORIZONTAL_SCROLL__ = VERSION;
})();
