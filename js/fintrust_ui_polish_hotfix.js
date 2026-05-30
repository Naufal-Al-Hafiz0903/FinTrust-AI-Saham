(function () {
  const VERSION = '20260529-root-ui-polish-v3';

  function q(id) { return document.getElementById(id); }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function viewportWidth() {
    return Math.min(
      window.visualViewport?.width || 9999,
      document.documentElement?.clientWidth || 9999,
      window.innerWidth || 9999
    );
  }

  function boxWidth(node) {
    if (!node) return 0;
    const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    return Math.floor(rect?.width || node.clientWidth || 0);
  }

  function compactFor(cv) {
    const box = cv?.closest?.('.chart-box') || cv?.parentElement;
    const panel = cv?.closest?.('.comparison-panel, .panel, .card');
    const values = [boxWidth(box), boxWidth(panel), viewportWidth()].filter(v => Number.isFinite(v) && v > 0);
    const w = values.length ? Math.min(...values) : 360;
    return document.body.classList.contains('is-mobile-ui') || window.matchMedia('(max-width: 768px)').matches || w <= 620;
  }

  function prepCanvas(cv, targetHeight, compact) {
    const box = cv.closest('.chart-box') || cv.parentElement || cv;
    const vw = viewportWidth();
    const bw = boxWidth(box) || vw || 320;
    const cssWidth = compact ? clamp(Math.min(bw, vw - 20), 220, 720) : clamp(bw, 320, 920);
    const cssHeight = compact ? clamp(targetHeight, 230, 390) : clamp(targetHeight, 280, 380);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    box.style.minWidth = '0';
    box.style.maxWidth = '100%';
    box.style.overflow = 'hidden';

    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.maxWidth = '100%';
    cv.style.height = cssHeight + 'px';
    cv.style.minHeight = '0';
    cv.style.maxHeight = cssHeight + 'px';

    cv.width = Math.floor(cssWidth * ratio);
    cv.height = Math.floor(cssHeight * ratio);

    const ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'alphabetic';

    return { ctx, cw: cssWidth, ch: cssHeight, compact };
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  window.drawBarChart = function drawBarChart(id, items) {
    const cv = q(id);
    if (!cv) return;

    const compact = compactFor(cv);
    const list = (Array.isArray(items) ? items : []).slice(0, compact ? 10 : 12);
    const height = compact ? 72 + Math.max(list.length, 1) * 31 : (list.length > 10 ? 350 : 300);
    const { ctx, cw, ch } = prepCanvas(cv, height, compact);

    const text = '#eaf6ee';
    const muted = '#9ab0a2';
    const track = 'rgba(255,255,255,.075)';
    const green = '#63d28a';
    const yellow = '#e2c45d';
    const red = '#ee7777';

    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = text;
    ctx.font = compact ? '700 13px system-ui, -apple-system, Segoe UI, sans-serif' : '700 14px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Composite Score', 16, compact ? 25 : 27);

    if (!list.length) {
      ctx.fillStyle = muted;
      ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('Data grafik belum tersedia', 16, 56);
      return;
    }

    if (compact) {
      const left = 16;
      const right = 16;
      const top = 52;
      const rowH = Math.max(27, Math.min(34, (ch - top - 14) / list.length));
      const labelW = Math.min(70, Math.max(48, cw * .24));
      const valueW = 34;
      const gap = 10;
      const barX = left + labelW + gap;
      const barW = Math.max(76, cw - barX - valueW - right - gap);

      list.forEach((it, i) => {
        const score = clamp(it?.scoreData?.score || 0, 0, 100);
        const y = top + i * rowH;
        const barH = Math.max(9, Math.min(13, rowH * .42));
        const barY = y + Math.max(7, (rowH - barH) / 2);
        const color = score >= 62 ? green : score >= 42 ? yellow : red;
        const label = String(it?.ticker || '-').replace('.JK', '').slice(0, 8);

        ctx.fillStyle = text;
        ctx.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, left, barY + barH - 1);

        roundRect(ctx, barX, barY, barW, barH, barH / 2, track);
        roundRect(ctx, barX, barY, Math.max(4, barW * score / 100), barH, barH / 2, color);

        ctx.fillStyle = muted;
        ctx.font = '700 10.5px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(Math.round(score)), cw - right, barY + barH - 1);
      });

      return;
    }

    const p = 42;
    const span = Math.max(1, list.length);
    const step = (cw - p * 2) / span;
    const barW = Math.max(14, Math.min(42, step * .54));
    const bottom = ch - 44;
    const top = 52;
    const chartH = Math.max(100, bottom - top);

    ctx.strokeStyle = 'rgba(154,176,162,.15)';
    for (let i = 0; i <= 4; i++) {
      const y = bottom - chartH * i / 4;
      ctx.beginPath();
      ctx.moveTo(p, y);
      ctx.lineTo(cw - p, y);
      ctx.stroke();
    }

    list.forEach((it, i) => {
      const score = clamp(it?.scoreData?.score || 0, 0, 100);
      const x = p + i * step + (step - barW) / 2;
      const y = bottom - score / 100 * chartH;
      const color = score >= 62 ? green : score >= 42 ? yellow : red;

      roundRect(ctx, x, y, barW, bottom - y, Math.min(8, barW / 2), color);

      ctx.fillStyle = text;
      ctx.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(score)), x + barW / 2, Math.max(42, y - 7));

      ctx.fillStyle = muted;
      ctx.fillText(String(it?.ticker || '-').replace('.JK', '').slice(0, 8), x + barW / 2, ch - 16);
    });
  };

  window.drawPieChart = function drawPieChart(id, items, allocs) {
    const cv = q(id);
    if (!cv) return;

    const buy = (Array.isArray(items) ? items : [])
      .map((it, i) => ({
        label: String(it?.ticker || '-').replace('.JK', ''),
        value: Number(allocs?.[i]?.used || 0)
      }))
      .filter(x => x.value > 0);

    const total = buy.reduce((s, x) => s + x.value, 0);
    const data = total > 0 ? buy.slice(0, 6) : [{ label: 'Cash / tidak beli', value: 1 }];
    const compact = compactFor(cv);
    const height = compact ? 182 + data.length * 25 : 300;
    const { ctx, cw, ch } = prepCanvas(cv, height, compact);

    const colors = ['#63d28a', '#76aeff', '#e2c45d', '#ee7777', '#a8b8ae', '#b995ff'];
    const sum = data.reduce((s, x) => s + x.value, 0) || 1;

    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = '#eaf6ee';
    ctx.font = compact ? '700 13px system-ui, -apple-system, Segoe UI, sans-serif' : '700 14px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(total > 0 ? 'Alokasi beli' : 'Tidak ada alokasi beli', 16, compact ? 25 : 27);

    const cx = cw / 2;
    const cy = compact ? 94 : ch / 2 - 4;
    const r = compact ? Math.min(54, Math.max(38, cw * .17), Math.max(34, (ch - 165) / 2)) : Math.min(cw, ch) * .25;

    let start = -Math.PI / 2;
    data.forEach((d, i) => {
      const end = start + d.value / sum * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start = end;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(17, r * .52), 0, Math.PI * 2);
    ctx.fillStyle = '#112018';
    ctx.fill();

    if (total > 0) {
      ctx.fillStyle = '#eaf6ee';
      ctx.font = '700 10.5px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUY', cx, cy + 4);
    }

    if (compact) {
      const legendTop = Math.max(153, cy + r + 24);
      const left = 16;
      const right = 16;

      data.forEach((d, i) => {
        const y = legendTop + i * 23;
        if (y > ch - 12) return;

        const percent = total > 0 ? Math.round(d.value / sum * 100) : 100;

        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(left + 5, y - 5, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dbe9df';
        ctx.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'left';

        const label = String(d.label || '-');
        ctx.fillText(label.length > 18 ? label.slice(0, 16) + '…' : label, left + 18, y);

        ctx.fillStyle = '#9ab0a2';
        ctx.textAlign = 'right';
        ctx.fillText(percent + '%', cw - right, y);
      });

      return;
    }

    data.forEach((d, i) => {
      const y = 48 + i * 22;
      const percent = total > 0 ? Math.round(d.value / sum * 100) : 100;

      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(22, y, 10, 10);

      ctx.fillStyle = '#9ab0a2';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${String(d.label || '-')} • ${percent}%`, 40, y + 10);
    });
  };

  let timer;
  function redraw() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (window.__fintrustChartState?.items) {
        window.drawBarChart('scoreChart', window.__fintrustChartState.items);
        window.drawPieChart('pieChart', window.__fintrustChartState.items, window.__fintrustChartState.allocs || []);
      }
    }, 140);
  }

  window.addEventListener('resize', redraw);
  window.addEventListener('orientationchange', redraw);
  document.addEventListener('fintrust:modechange', redraw);
  document.addEventListener('fintrust:contentchange', redraw);

  window.__FINTRUST_UI_POLISH_HOTFIX__ = VERSION;
})();
