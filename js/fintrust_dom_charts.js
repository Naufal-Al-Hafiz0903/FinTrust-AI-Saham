(function () {
  const VERSION = '20260529-dom-charts-v1';
  const COLORS = ['#63d28a', '#76aeff', '#e2c45d', '#ee7777', '#a8b8ae', '#b995ff', '#5fd0c5', '#f0a55f'];

  let redrawTimer = null;
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

  function ensureDomChart(canvas, type) {
    if (!canvas) return null;

    canvas.dataset.fintrustDomHidden = '1';
    canvas.style.display = 'none';

    let dom = document.getElementById(canvas.id + '__fintrust_dom');
    if (!dom) {
      dom = document.createElement('div');
      dom.id = canvas.id + '__fintrust_dom';
      canvas.insertAdjacentElement('afterend', dom);
    }

    dom.className = 'fintrust-dom-chart fintrust-' + type + '-chart';
    return dom;
  }

  function updateState(kind, items, allocs) {
    window.__fintrustChartState = window.__fintrustChartState || {};
    if (Array.isArray(items)) window.__fintrustChartState.items = items;
    if (Array.isArray(allocs)) window.__fintrustChartState.allocs = allocs;
    window.__fintrustChartState.kind = kind;
  }

  window.drawBarChart = function drawBarChart(id, items) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    updateState('bar', items, null);

    const dom = ensureDomChart(canvas, 'bar');
    if (!dom) return;

    const list = (Array.isArray(items) ? items : []).slice(0, 10);

    drawing = true;

    if (!list.length) {
      dom.innerHTML = `
        <div class="fintrust-chart-title">Composite Score</div>
        <div class="fintrust-chart-empty">Data grafik belum tersedia.</div>
      `;
      drawing = false;
      return;
    }

    const rows = list.map(function (item) {
      const score = Math.round(scoreOf(item));
      const cls = scoreClass(score);
      return `
        <div class="fintrust-bar-row">
          <div class="fintrust-bar-label" title="${esc(tickerOf(item))}">${esc(tickerOf(item))}</div>
          <div class="fintrust-bar-track">
            <div class="fintrust-bar-fill ${cls}" style="--value:${score}%"></div>
          </div>
          <div class="fintrust-bar-value">${score}</div>
        </div>
      `;
    }).join('');

    dom.innerHTML = `
      <div class="fintrust-chart-title">Composite Score</div>
      <div class="fintrust-bar-list">${rows}</div>
    `;

    drawing = false;
  };

  window.drawPieChart = function drawPieChart(id, items, allocs) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    updateState('pie', items, allocs);

    const dom = ensureDomChart(canvas, 'pie');
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
    }).slice(0, 6);

    const total = data.reduce(function (sum, item) {
      return sum + item.value;
    }, 0);

    if (!data.length || total <= 0) {
      data = [{ label: 'Cash / Tidak beli', value: 1 }];
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
        <div class="fintrust-pie-item">
          <span class="fintrust-pie-dot" style="--dot:${COLORS[i % COLORS.length]}"></span>
          <span class="fintrust-pie-name" title="${esc(item.label)}">${esc(item.label)}</span>
          <span class="fintrust-pie-percent">${percent}%</span>
        </div>
      `;
    }).join('');

    drawing = true;

    dom.innerHTML = `
      <div class="fintrust-chart-title">${total > 0 ? 'Alokasi beli' : 'Alokasi dana'}</div>
      <div class="fintrust-pie-layout">
        <div class="fintrust-donut" style="background: conic-gradient(${gradient});">
          <div class="fintrust-donut-center">${total > 0 ? 'BUY' : 'CASH'}</div>
        </div>
        <div class="fintrust-pie-legend">${legend}</div>
      </div>
    `;

    drawing = false;
  };

  function redrawFromState() {
    const state = window.__fintrustChartState || {};
    if (!Array.isArray(state.items)) return;

    if (document.getElementById('scoreChart')) {
      window.drawBarChart('scoreChart', state.items);
    }

    if (document.getElementById('pieChart')) {
      window.drawPieChart('pieChart', state.items, state.allocs || []);
    }
  }

  function scheduleRedraw(delay) {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(redrawFromState, delay || 120);
  }

  function markViewport() {
    const w = Math.min(
      window.visualViewport?.width || 9999,
      document.documentElement.clientWidth || 9999,
      window.innerWidth || 9999
    );

    document.documentElement.dataset.fintrustLayout = w <= 768 ? 'mobile' : 'desktop';
    document.body?.classList.toggle('is-mobile-ui', w <= 768);
  }

  window.addEventListener('resize', function () {
    markViewport();
    scheduleRedraw(160);
  });

  window.addEventListener('orientationchange', function () {
    markViewport();
    scheduleRedraw(260);
  });

  window.addEventListener('load', function () {
    markViewport();
    scheduleRedraw(120);
    scheduleRedraw(700);
    scheduleRedraw(1500);
  });

  document.addEventListener('DOMContentLoaded', function () {
    markViewport();
    scheduleRedraw(120);
    scheduleRedraw(700);
  });

  document.addEventListener('fintrust:contentchange', function () {
    markViewport();
    scheduleRedraw(120);
  });

  document.addEventListener('fintrust:modechange', function () {
    markViewport();
    scheduleRedraw(120);
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(function () {
      if (drawing) return;
      markViewport();
      scheduleRedraw(220);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  markViewport();
  setTimeout(redrawFromState, 250);
  setTimeout(redrawFromState, 900);
  setTimeout(redrawFromState, 1800);

  window.__FINTRUST_DOM_CHARTS__ = VERSION;
})();
