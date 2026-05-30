(function () {
  const VERSION = '20260529-scroll-final-v10';
  let timer = null;

  function directChildren(node, selector) {
    return Array.from(node.children || []).filter(function (child) {
      return child.matches && child.matches(selector);
    });
  }

  function unwrapOldWrappers(box) {
    if (!box) return;

    box.querySelectorAll('.fintrust-hscroll-inner, .fintrust-xscroll-inner').forEach(function (wrapper) {
      const parent = wrapper.parentElement;
      if (!parent) return;

      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }

      wrapper.remove();
    });

    box.querySelectorAll('.fintrust-scroll-hint').forEach(function (hint) {
      hint.remove();
    });
  }

  function isChartBox(box) {
    if (!box) return false;

    return !!(
      box.querySelector('#scoreChart') ||
      box.querySelector('#pieChart') ||
      box.querySelector('#scoreChart__fintrust_compact') ||
      box.querySelector('#pieChart__fintrust_compact') ||
      box.querySelector('.fintrust-compact-chart') ||
      /Composite Score|Alokasi beli/i.test(box.textContent || '')
    );
  }

  function hideOldCanvas(box) {
    box.querySelectorAll('canvas, [id$="__fintrust_dom"]').forEach(function (node) {
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('opacity', '0', 'important');
      node.style.setProperty('width', '0', 'important');
      node.style.setProperty('height', '0', 'important');
      node.style.setProperty('max-width', '0', 'important');
      node.style.setProperty('max-height', '0', 'important');
      node.style.setProperty('position', 'absolute', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
    });
  }

  function ensureViewport(box) {
    let viewport = directChildren(box, '.fintrust-scroll-v10-viewport')[0];

    if (!viewport) {
      viewport = document.createElement('div');
      viewport.className = 'fintrust-scroll-v10-viewport';
      box.appendChild(viewport);
    }

    let inner = directChildren(viewport, '.fintrust-scroll-v10-inner')[0];

    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'fintrust-scroll-v10-inner';
      viewport.appendChild(inner);
    }

    return { viewport, inner };
  }

  function ensureControls(box, viewport) {
    let controls = directChildren(box, '.fintrust-scroll-v10-controls')[0];

    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'fintrust-scroll-v10-controls';
      controls.innerHTML = `
        <span class="fintrust-scroll-v10-hint">Geser grafik kiri-kanan</span>
        <button type="button" class="fintrust-scroll-v10-btn" data-dir="-1">←</button>
        <button type="button" class="fintrust-scroll-v10-btn" data-dir="1">→</button>
      `;
      box.appendChild(controls);
    }

    controls.querySelectorAll('.fintrust-scroll-v10-btn').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';

      btn.addEventListener('click', function () {
        const dir = Number(btn.dataset.dir || 1);
        viewport.scrollBy({ left: dir * 180, behavior: 'smooth' });
      });
    });
  }

  function bindDrag(viewport) {
    if (!viewport || viewport.dataset.dragBound === '1') return;
    viewport.dataset.dragBound = '1';

    let down = false;
    let startX = 0;
    let startScroll = 0;

    viewport.addEventListener('pointerdown', function (event) {
      if (viewport.scrollWidth <= viewport.clientWidth) return;

      down = true;
      startX = event.clientX;
      startScroll = viewport.scrollLeft;

      try {
        viewport.setPointerCapture(event.pointerId);
      } catch (error) {}
    });

    viewport.addEventListener('pointermove', function (event) {
      if (!down) return;

      const dx = event.clientX - startX;
      viewport.scrollLeft = startScroll - dx;

      if (Math.abs(dx) > 3) {
        event.preventDefault();
      }
    });

    function stop(event) {
      down = false;

      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch (error) {}
    }

    viewport.addEventListener('pointerup', stop);
    viewport.addEventListener('pointercancel', stop);
    viewport.addEventListener('mouseleave', function () {
      down = false;
    });

    viewport.addEventListener('wheel', function (event) {
      if (viewport.scrollWidth <= viewport.clientWidth) return;

      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        viewport.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });
  }

  function moveChartsIntoViewport(box, inner) {
    const charts = Array.from(box.querySelectorAll('.fintrust-compact-chart')).filter(function (chart) {
      return chart.closest('.chart-box') === box && chart.parentElement !== inner;
    });

    charts.forEach(function (chart) {
      inner.appendChild(chart);
    });

    /* Jika compact chart belum dibuat ulang, biarkan script chart v6 membuatnya lalu v10 akan jalan ulang */
  }

  function patchBox(box) {
    if (!isChartBox(box)) return;

    unwrapOldWrappers(box);
    hideOldCanvas(box);

    box.classList.add('fintrust-scroll-v10');
    box.classList.remove('fintrust-hscroll-ready', 'fintrust-xscroll-force');

    box.style.setProperty('overflow', 'visible', 'important');
    box.style.setProperty('overflow-x', 'visible', 'important');
    box.style.setProperty('overflow-y', 'visible', 'important');
    box.style.setProperty('width', '100%', 'important');
    box.style.setProperty('max-width', '100%', 'important');
    box.style.setProperty('min-width', '0', 'important');

    const parts = ensureViewport(box);
    moveChartsIntoViewport(box, parts.inner);
    ensureControls(box, parts.viewport);
    bindDrag(parts.viewport);

    if (window.innerWidth <= 768) {
      parts.inner.style.setProperty('width', '520px', 'important');
      parts.inner.style.setProperty('min-width', '520px', 'important');
      parts.inner.style.setProperty('max-width', 'none', 'important');
      parts.viewport.style.setProperty('overflow-x', 'scroll', 'important');
    } else {
      parts.inner.style.setProperty('width', '100%', 'important');
      parts.inner.style.setProperty('min-width', '100%', 'important');
      parts.viewport.style.setProperty('overflow-x', 'auto', 'important');
    }

    /* Sembunyikan caption lama langsung di dalam chart-box */
    Array.from(box.children).forEach(function (child) {
      if (child.tagName === 'P') {
        child.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function apply() {
    document.querySelectorAll('.chart-box').forEach(patchBox);
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay || 120);
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
      subtree: true
    });
  }

  schedule(120);
  schedule(700);
  schedule(1500);
  schedule(2500);

  window.__FINTRUST_SCROLL_FINAL__ = VERSION;
})();
