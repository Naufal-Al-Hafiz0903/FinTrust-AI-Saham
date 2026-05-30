(function () {
  var VERSION = '20260529-mobile-strict-v4';
  var oldBar = window.drawBarChart;
  var oldPie = window.drawPieChart;
  var redrawTimer = null;

  function el(id) {
    return document.getElementById(id);
  }

  function viewportWidth() {
    var vv = window.visualViewport;
    var a = vv && vv.width ? vv.width : 9999;
    var b = document.documentElement && document.documentElement.clientWidth ? document.documentElement.clientWidth : 9999;
    var c = window.innerWidth || 9999;
    return Math.min(a, b, c);
  }

  function nodeWidth(node) {
    if (!node) return 0;
    var r = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    return Math.floor((r && r.width) || node.clientWidth || 0);
  }

  function isMobileChart(canvas) {
    var parent = canvas && (canvas.closest('.chart-box') || canvas.parentElement);
    var panel = canvas && canvas.closest('.comparison-panel, .panel, .card, .content');
    var w = Math.min(
      viewportWidth(),
      nodeWidth(parent) || 9999,
      nodeWidth(panel) || 9999
    );

    return w <= 768 ||
      document.body.classList.contains('is-mobile-ui') ||
      document.documentElement.dataset.uiMode === 'mobile' ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function setupCanvas(canvas, height) {
    var box = canvas.closest('.chart-box') || canvas.parentElement || canvas;
    var vw = viewportWidth();
    var boxW = nodeWidth(box) || vw || 320;
    var cssW = clamp(Math.min(boxW, vw - 16), 240, 720);
    var cssH = clamp(height, 180, 380);
    var ratio = Math.min(window.devicePixelRatio || 1, 2);

    box.style.minWidth = '0';
    box.style.maxWidth = '100%';
    box.style.width = '100%';
    box.style.overflow = 'hidden';
    box.style.boxSizing = 'border-box';

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.maxWidth = '100%';
    canvas.style.minWidth = '0';
    canvas.style.height = cssH + 'px';
    canvas.style.maxHeight = cssH + 'px';
    canvas.style.boxSizing = 'border-box';

    canvas.width = Math.floor(cssW * ratio);
    canvas.height = Math.floor(cssH * ratio);

    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    return { ctx: ctx, w: cssW, h: cssH };
  }

  function roundRect(ctx, x, y, w, h, r, color) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  window.drawBarChart = function (id, items) {
    var canvas = el(id);
    if (!canvas) return;

    if (!isMobileChart(canvas) && typeof oldBar === 'function') {
      return oldBar(id, items);
    }

    var list = Array.isArray(items) ? items.slice(0, 10) : [];
    var height = 58 + Math.max(list.length, 1) * 29;
    var c = setupCanvas(canvas, height);
    var ctx = c.ctx;
    var w = c.w;
    var h = c.h;

    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#eaf6ee';
    ctx.font = '700 13px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Composite Score', 16, 27);

    if (!list.length) {
      ctx.fillStyle = '#9ab0a2';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('Data grafik belum tersedia', 16, 56);
      return;
    }

    var left = 16;
    var top = 50;
    var right = 14;
    var labelW = Math.min(66, Math.max(48, w * 0.24));
    var scoreW = 28;
    var gap = 9;
    var barX = left + labelW + gap;
    var barW = Math.max(70, w - barX - scoreW - right - gap);
    var rowH = Math.max(25, Math.min(31, (h - top - 12) / list.length));

    list.forEach(function (item, i) {
      var score = clamp(item && item.scoreData ? item.scoreData.score : 0, 0, 100);
      var label = String((item && item.ticker) || '-').replace('.JK', '').slice(0, 8);
      var y = top + i * rowH;
      var barH = Math.max(9, Math.min(13, rowH * 0.44));
      var barY = y + Math.max(6, (rowH - barH) / 2);
      var color = score >= 62 ? '#63d28a' : score >= 42 ? '#e2c45d' : '#ee7777';

      ctx.fillStyle = '#eaf6ee';
      ctx.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, left, barY + barH - 1);

      roundRect(ctx, barX, barY, barW, barH, 999, 'rgba(255,255,255,.085)');
      roundRect(ctx, barX, barY, Math.max(4, barW * score / 100), barH, 999, color);

      ctx.fillStyle = '#9ab0a2';
      ctx.font = '700 10px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(score)), w - right, barY + barH - 1);
    });
  };

  window.drawPieChart = function (id, items, allocs) {
    var canvas = el(id);
    if (!canvas) return;

    if (!isMobileChart(canvas) && typeof oldPie === 'function') {
      return oldPie(id, items, allocs);
    }

    var buy = (Array.isArray(items) ? items : []).map(function (item, i) {
      return {
        label: String((item && item.ticker) || '-').replace('.JK', ''),
        value: Number(allocs && allocs[i] ? allocs[i].used : 0)
      };
    }).filter(function (x) {
      return x.value > 0;
    });

    var total = buy.reduce(function (s, x) { return s + x.value; }, 0);
    var data = total > 0 ? buy.slice(0, 6) : [{ label: 'Cash / tidak beli', value: 1 }];
    var height = 160 + data.length * 24;
    var c = setupCanvas(canvas, height);
    var ctx = c.ctx;
    var w = c.w;
    var h = c.h;
    var colors = ['#63d28a', '#76aeff', '#e2c45d', '#ee7777', '#a8b8ae', '#b995ff'];
    var sum = data.reduce(function (s, x) { return s + x.value; }, 0) || 1;

    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#eaf6ee';
    ctx.font = '700 13px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(total > 0 ? 'Alokasi beli' : 'Tidak ada alokasi beli', 16, 27);

    var cx = w / 2;
    var cy = 85;
    var r = Math.min(48, Math.max(34, w * 0.18));
    var start = -Math.PI / 2;

    data.forEach(function (d, i) {
      var end = start + d.value / sum * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start = end;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(18, r * 0.52), 0, Math.PI * 2);
    ctx.fillStyle = '#112018';
    ctx.fill();

    ctx.fillStyle = '#eaf6ee';
    ctx.font = '700 10px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total > 0 ? 'BUY' : 'CASH', cx, cy + 4);

    var legendTop = cy + r + 27;
    data.forEach(function (d, i) {
      var y = legendTop + i * 22;
      var percent = total > 0 ? Math.round(d.value / sum * 100) : 100;
      var label = String(d.label || '-');

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(21, y - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#dbe9df';
      ctx.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label.length > 18 ? label.slice(0, 16) + '…' : label, 34, y);

      ctx.fillStyle = '#9ab0a2';
      ctx.textAlign = 'right';
      ctx.fillText(percent + '%', w - 16, y);
    });
  };

  function repaint() {
    var state = window.__fintrustChartState || {};
    if (!state.items || !el('scoreChart')) return;
    window.drawBarChart('scoreChart', state.items);
    window.drawPieChart('pieChart', state.items, state.allocs || []);
  }

  function schedule(ms) {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(repaint, ms || 120);
  }

  window.addEventListener('resize', function () { schedule(160); });
  window.addEventListener('orientationchange', function () { schedule(260); });
  window.addEventListener('load', function () {
    schedule(100);
    schedule(700);
    schedule(1500);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(100);
    schedule(700);
  });

  document.addEventListener('fintrust:contentchange', function () { schedule(120); });
  document.addEventListener('fintrust:modechange', function () { schedule(120); });

  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { schedule(180); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  setTimeout(repaint, 250);
  setTimeout(repaint, 900);
  setTimeout(repaint, 1800);

  window.__FINTRUST_MOBILE_STRICT_LAYOUT__ = VERSION;
})();
