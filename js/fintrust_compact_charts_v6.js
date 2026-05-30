(function () {
  const VERSION = '20260529-compact-charts-v6';
  const COLORS = ['#63d28a', '#76aeff', '#e2c45d', '#ee7777', '#a8b8ae', '#b995ff'];

  let timer = null;
  let drawing = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function tickerOf(item) {
    return String(item?.ticker || item?.symbol || '-').replace('.JK', '');
  }

  function scoreOf(item) {
    return clamp(item?.scoreData?.score ?? item?.score ?? item?.compositeScore ?? 0, 0, 100);
  }

  function scoreClass(score) {
    if (score >= 62) return 'high';
    if (score >= 42) return 'mid';
    return 'low';
  }

  function viewportWidth() {
    return Math.min(
      window.visualViewport?.width || 9999,
      document.documentElement?.clientWidth || 9999,
      window.innerWidth || 9999
    );
  }

  function isMobile() {
    return viewportWidth() <= 768;
  }

  function chartBoxFor(canvas, dom) {
    return canvas?.closest?.('.chart-box') ||
      dom?.closest?.('.chart-box') ||
      canvas?.parentElement ||
      dom?.parentElement ||
      null;
  }

  function hideOldChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    const oldDom = document.getElementById(canvasId + '__fintrust_dom');

    [canvas, oldDom].forEach(function (node) {
      if (!node) return;
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

  function ensureCompactChart(canvasId, type) {
    const canvas = document.getElementById(canvasId);
    let dom = document.getElementById(canvasId + '__fintrust_compact');

    if (!dom) {
      dom = document.createElement('div');
      dom.id = canvasId + '__fintrust_compact';

      if (canvas) {
        canvas.insertAdjacentElement('afterend', dom);
      } else {
        const box = document.querySelector('.chart-box');
        if (box) box.appendChild(dom);
      }
    }

    dom.className = 'fintrust-compact-chart fintrust-compact-' + type;

    const box = chartBoxFor(canvas, dom);
    if (box) {
      box.classList.add('fintrust-compact-ready');
      box.style.setProperty('height', 'auto', 'important');
      box.style.setProperty('min-height', '0', 'important');
      box.style.setProperty('max-height', 'none', 'important');
      box.style.setProperty('overflow', 'hidden', 'important');
      box.style.setProperty('width', '100%', 'important');
      box.style.setProperty('max-width', '100%', 'important');

      if (dom.parentElement !== box) {
        box.appendChild(dom);
      }
    }

    hideOldChart(canvasId);
    return dom;
  }

  function updateState(items, allocs) {
    window.__fintrustChartState = window.__fintrustChartState || {};
    if (Array.isArray(items)) window.__fintrustChartState.items = items;
    if (Array.isArray(allocs)) window.__fintrustChartState.allocs = allocs;
  }

  window.drawBarChart = function drawBarChart(id, items) {
    updateState(items, null);

    const dom = ensureCompactChart(id, 'bar');
    if (!dom) return;

    const limit = isMobile() ? 8 : 10;
    const list = (Array.isArray(items) ? items : []).slice(0, limit);

    drawing = true;

    if (!list.length) {
      dom.innerHTML = `
        <div class="fintrust-compact-title">Composite Score</div>
        <div class="fintrust-chart-caption">Data grafik belum tersedia.</div>
      `;
      drawing = false;
      return;
    }

    const rows = list.map(function (item) {
      const score = Math.round(scoreOf(item));
      const cls = scoreClass(score);
      const ticker = tickerOf(item);

      return `
        <div class="fintrust-compact-bar-row">
          <div class="fintrust-compact-bar-label" title="${esc(ticker)}">${esc(ticker)}</div>
          <div class="fintrust-compact-bar-track">
            <span class="fintrust-compact-bar-fill ${cls}" style="--value:${score}%"></span>
          </div>
          <div class="fintrust-compact-bar-value">${score}</div>
        </div>
      `;
    }).join('');

    dom.innerHTML = `
      <div class="fintrust-compact-title">Composite Score</div>
      <div class="fintrust-compact-bar-list">${rows}</div>
      <p class="fintrust-chart-caption">Grafik skor per saham.</p>
    `;

    drawing = false;
  };

  window.drawPieChart = function drawPieChart(id, items, allocs) {
    updateState(items, allocs);

    const dom = ensureCompactChart(id, 'pie');
    if (!dom) return;

    const safeItems = Array.isArray(items) ? items : [];
    const safeAllocs = Array.isArray(allocs) ? allocs : [];

    let data = safeItems.map(function (item, i) {
      return {
        label: tickerOf(item),
        value: Number(safeAllocs[i]?.used || safeAllocs[i]?.amount || safeAllocs[i]?.value || 0)
      };
    }).filter(function (x) {
      return x.value > 0;
    }).slice(0, isMobile() ? 5 : 6);

    let total = data.reduce(function (sum, item) {
      return sum + item.value;
    }, 0);

    if (!data.length || total <= 0) {
      data = safeItems.slice(0, isMobile() ? 5 : 6).map(function (item) {
        return { label: tickerOf(item), value: 1 };
      });

      total = data.reduce(function (sum, item) {
        return sum + item.value;
      }, 0);
    }

    if (!data.length) {
      data = [{ label: 'Cash', value: 1 }];
      total = 1;
    }

    const sum = data.reduce(function (s, x) {
      return s + x.value;
    }, 0) || 1;

    let deg = 0;
    const gradient = data.map(function (item, i) {
      const start = deg;
      const end = deg + (item.value / sum * 360);
      deg = end;
      return `${COLORS[i % COLORS.length]} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    }).join(', ');

    const legend = data.map(function (item, i) {
      const percent = Math.round(item.value / sum * 100);

      return `
        <div class="fintrust-compact-pie-item">
          <span class="fintrust-compact-pie-dot" style="--dot:${COLORS[i % COLORS.length]}"></span>
          <span class="fintrust-compact-pie-name" title="${esc(item.label)}">${esc(item.label)}</span>
          <span class="fintrust-compact-pie-percent">${percent}%</span>
        </div>
      `;
    }).join('');

    drawing = true;

    dom.innerHTML = `
      <div class="fintrust-compact-title">Alokasi beli</div>
      <div class="fintrust-compact-pie-layout">
        <div class="fintrust-compact-donut" style="background: conic-gradient(${gradient});">
          <div class="fintrust-compact-donut-center">BUY</div>
        </div>
        <div class="fintrust-compact-pie-legend">${legend}</div>
      </div>
      <p class="fintrust-chart-caption">Diagram alokasi pembelian. Jika tidak ada saham layak beli, dana tetap cash.</p>
    `;

    drawing = false;
  };

  function redrawFromState() {
    const state = window.__fintrustChartState || {};
    if (!Array.isArray(state.items)) return;

    if (document.getElementById('scoreChart') || document.getElementById('scoreChart__fintrust_compact')) {
      window.drawBarChart('scoreChart', state.items);
    }

    if (document.getElementById('pieChart') || document.getElementById('pieChart__fintrust_compact')) {
      window.drawPieChart('pieChart', state.items, state.allocs || []);
    }
  }

  function fixBeliText() {
    const nodes = document.querySelectorAll('td, div, span, b, strong, button');

    nodes.forEach(function (node) {
      if (!node || node.children.length > 3) return;

      const raw = (node.textContent || '').trim();
      const compact = raw.replace(/\s+/g, '').toUpperCase();

      if (compact === 'BELI') {
        node.classList.add('fintrust-nowrap-beli');

        if (node.parentElement) {
          node.parentElement.classList.add('fintrust-beli-parent');
        }
      }
    });
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      redrawFromState();
      fixBeliText();
    }, delay || 120);
  }

  window.addEventListener('load', function () {
    schedule(80);
    schedule(600);
    schedule(1300);
  });

  window.addEventListener('resize', function () {
    schedule(160);
  });

  window.addEventListener('orientationchange', function () {
    schedule(260);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(80);
    schedule(600);
  });

  document.addEventListener('fintrust:contentchange', function () {
    schedule(120);
  });

  document.addEventListener('fintrust:modechange', function () {
    schedule(120);
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(function () {
      if (drawing) return;
      schedule(220);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  fixBeliText();
  schedule(250);
  schedule(1000);

  window.__FINTRUST_COMPACT_CHARTS__ = VERSION;
})();
