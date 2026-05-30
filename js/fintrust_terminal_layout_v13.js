(function () {
  const VERSION = '20260529-terminal-layout-v13';
  let timer = null;
  let applying = false;

  const state = {
    items: [],
    allocs: []
  };

  function textOf(node) {
    return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[m];
    });
  }

  function cleanTicker(value) {
    return String(value || '-').replace('.JK', '').trim();
  }

  function numberValue(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function scoreOf(item) {
    return Math.max(0, Math.min(100, numberValue(
      item?.scoreData?.score ?? item?.score ?? item?.compositeScore ?? item?.finalScore,
      0
    )));
  }

  function nameOf(item) {
    return item?.name || item?.longName || item?.shortName || item?.companyName || item?.displayName || '-';
  }

  function priceOf(item) {
    const value =
      item?.price ??
      item?.currentPrice ??
      item?.lastPrice ??
      item?.regularMarketPrice ??
      item?.close ??
      item?.marketPrice;

    if (value === undefined || value === null || value === '') return '-';

    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  }

  function changeOf(item) {
    const value =
      item?.changePercent ??
      item?.percentChange ??
      item?.changesPercentage ??
      item?.change ??
      item?.regularMarketChangePercent;

    if (value === undefined || value === null || value === '') return '-';

    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    return n.toFixed(2).replace('.', ',') + '%';
  }

  function allocationOf(index) {
    const alloc = state.allocs?.[index] || {};
    const lot = alloc.lots ?? alloc.lot ?? alloc.buyLots ?? alloc.qtyLot;
    const shares = alloc.shares ?? alloc.qty ?? alloc.quantity;
    const used = alloc.used ?? alloc.amount ?? alloc.value ?? alloc.total;

    const lotText = lot ? `${lot} lot` : '';
    const sharesText = shares ? `(${shares} saham)` : '';
    const usedText = used ? 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(used))) : '';

    if (usedText || lotText || sharesText) {
      return [usedText, lotText, sharesText].filter(Boolean).join(' ');
    }

    return '-';
  }

  function statusOf(item, index) {
    const alloc = state.allocs?.[index] || {};
    const hasAlloc = Number(alloc?.lots || alloc?.lot || alloc?.used || alloc?.amount || 0) > 0;

    if (hasAlloc) return 'BELI';

    const raw =
      item?.recommendation ??
      item?.action ??
      item?.signal ??
      item?.status ??
      '';

    if (/beli|buy/i.test(String(raw))) return 'BELI';

    return scoreOf(item) >= 60 ? 'BELI' : 'PANTAU';
  }

  function noteOf(item) {
    return item?.reason || item?.note || item?.summary || item?.recommendationText || 'Hasil analisis pasar berdasarkan skor, likuiditas, kapitalisasi, dan momentum.';
  }

  function renderBarChartHtml(items) {
    const list = (Array.isArray(items) ? items : []).slice(0, 10);

    if (!list.length) {
      return '<div class="fintrust-v13-empty">Grafik batang belum tersedia.</div>';
    }

    const rows = list.map(function (item) {
      const ticker = cleanTicker(item?.ticker || item?.symbol || item?.code);
      const score = Math.round(scoreOf(item));
      const cls = score >= 62 ? '' : (score >= 42 ? 'mid' : 'low');

      return `
        <div class="fintrust-v13-bar-row">
          <div class="fintrust-v13-bar-label" title="${esc(ticker)}">${esc(ticker)}</div>
          <div class="fintrust-v13-bar-track">
            <span class="fintrust-v13-bar-fill ${cls}" style="--score:${score}%"></span>
          </div>
          <div class="fintrust-v13-bar-value">${score}</div>
        </div>
      `;
    }).join('');

    return `
      <h3 class="fintrust-v13-chart-title">Grafik batang skor saham</h3>
      <div class="fintrust-v13-bar-list">${rows}</div>
      <p class="fintrust-v13-caption">Grafik skor per saham. Semakin tinggi skor, semakin kuat kandidat saham dalam hasil analisis.</p>
    `;
  }

  function renderTableHtml(items) {
    const list = (Array.isArray(items) ? items : []).slice(0, 30);

    if (!list.length) {
      return '<div class="fintrust-v13-empty">Tabel rekomendasi beli belum tersedia.</div>';
    }

    const body = list.map(function (item, index) {
      const ticker = cleanTicker(item?.ticker || item?.symbol || item?.code);
      const status = statusOf(item, index);
      const score = Math.round(scoreOf(item));

      return `
        <tr>
          <td>${esc(ticker)}</td>
          <td>${esc(nameOf(item))}</td>
          <td>${esc(priceOf(item))}</td>
          <td>${esc(changeOf(item))}</td>
          <td>${score}</td>
          <td><span class="fintrust-v13-badge">${esc(status)}</span></td>
          <td>${esc(allocationOf(index))}</td>
          <td>${esc(noteOf(item))}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="fintrust-v13-table-wrap">
        <table class="fintrust-v13-table">
          <thead>
            <tr>
              <th style="width:80px;">Kode</th>
              <th style="width:180px;">Nama</th>
              <th style="width:110px;">Harga</th>
              <th style="width:80px;">Change</th>
              <th style="width:70px;">Skor</th>
              <th style="width:90px;">Status</th>
              <th style="width:160px;">Estimasi beli</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function findResultTitle() {
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,.title,.section-title,div')).find(function (node) {
      if (node.closest('#fintrust-terminal-stack-v13')) return false;
      return /Rekomendasi Saham Indonesia/i.test(textOf(node));
    }) || null;
  }

  function findResultRoot(titleNode) {
    if (!titleNode) return null;

    let node = titleNode;

    while (node && node !== document.body) {
      const t = textOf(node);
      const hasResult = /Rekomendasi Saham Indonesia/i.test(t);
      const hasChartOrTable = /Composite Score|Kode|Nama|Harga|Mampu dibeli|Rekomendasi/i.test(t);

      if (hasResult && hasChartOrTable && node.querySelector) {
        return node;
      }

      node = node.parentElement;
    }

    return titleNode.closest('.panel,.card,section,main') || titleNode.parentElement;
  }

  function findResultText(root, titleNode) {
    const title = textOf(titleNode) || 'Rekomendasi Saham Indonesia';

    let desc = '';
    let meta = '';

    if (root) {
      Array.from(root.querySelectorAll('p,div,span')).forEach(function (node) {
        if (node.closest('#fintrust-terminal-stack-v13')) return;

        const t = textOf(node);
        if (!t) return;

        if (!desc && /Rekomendasi otomatis|nominal Rp|harga realtime|hanya saham/i.test(t)) {
          desc = t;
        }

        if (!meta && /Kurs realtime|Yahoo Finance|USD\/IDR|Kurs/i.test(t)) {
          meta = t;
        }
      });
    }

    return { title, desc, meta };
  }

  function hideOldUi(root) {
    if (root) {
      root.classList.add('fintrust-v13-hide');
    }

    document.querySelectorAll('#pieChart,#pieChart__fintrust_dom,#pieChart__fintrust_compact,[id*="pieChart"]').forEach(function (node) {
      const box = node.closest('.chart-box,.card,.panel') || node;
      box.classList.add('fintrust-v13-hide');
    });

    document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,section').forEach(function (node) {
      if (node.closest('#fintrust-terminal-stack-v13')) return;

      const t = textOf(node).toLowerCase();

      if (t === 'rekomendasi pembelian' || t.includes('rekomendasi pembelian')) {
        const wrap = node.closest('section,.panel,.card') || node.parentElement || node;
        wrap.classList.add('fintrust-v13-hide');
      }
    });

    document.querySelectorAll('.recommendation-card,.recommendation-item,.buy-recommendation,.purchase-recommendation,.recommendation-list').forEach(function (node) {
      if (!node.closest('#fintrust-terminal-stack-v13')) {
        node.classList.add('fintrust-v13-hide');
      }
    });
  }

  function hideIpoWatchlistButton() {
    document.querySelectorAll('button,a,.tab,.nav-tab,.pill,.market-tab,[role="button"]').forEach(function (node) {
      const t = textOf(node).toLowerCase();

      if (t.includes('ipo') && (t.includes('watchlist') || t.includes('watch list'))) {
        node.classList.add('fintrust-v13-hide-tab');
      }
    });
  }

  function buildLayout() {
    if (applying) return;
    applying = true;

    try {
      hideIpoWatchlistButton();

      const titleNode = findResultTitle();

      if (!titleNode || !state.items.length) {
        applying = false;
        return;
      }

      const root = findResultRoot(titleNode);
      const info = findResultText(root, titleNode);

      let shell = document.getElementById('fintrust-terminal-stack-v13');

      if (!shell) {
        shell = document.createElement('section');
        shell.id = 'fintrust-terminal-stack-v13';

        if (root && root.parentElement) {
          root.parentElement.insertBefore(shell, root);
        } else {
          document.querySelector('main,.main,.content,body').appendChild(shell);
        }
      }

      shell.innerHTML = `
        <div class="fintrust-v13-card fintrust-v13-text-card">
          <h2 class="fintrust-v13-title">${esc(info.title)}</h2>
          ${info.desc ? `<p class="fintrust-v13-desc">${esc(info.desc)}</p>` : ''}
          ${info.meta ? `<p class="fintrust-v13-meta">${esc(info.meta)}</p>` : ''}
        </div>

        <div class="fintrust-v13-card fintrust-v13-chart-card">
          ${renderBarChartHtml(state.items)}
        </div>

        <div class="fintrust-v13-card fintrust-v13-table-card">
          <h3 class="fintrust-v13-table-title">Tabel rekomendasi beli</h3>
          ${renderTableHtml(state.items)}
        </div>
      `;

      hideOldUi(root);
      hideIpoWatchlistButton();
    } finally {
      applying = false;
    }
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(buildLayout, delay || 120);
  }

  const oldBar = window.drawBarChart;
  window.drawBarChart = function (id, items) {
    if (Array.isArray(items)) {
      state.items = items;
      window.__fintrustV13Items = items;
    }

    schedule(80);
    schedule(400);

    const canvas = document.getElementById(id);
    if (canvas) {
      const box = canvas.closest('.chart-box,.card,.panel');
      if (box) box.classList.add('fintrust-v13-hide');
    }

    return null;
  };

  const oldPie = window.drawPieChart;
  window.drawPieChart = function (id, items, allocs) {
    if (Array.isArray(items)) {
      state.items = items;
      window.__fintrustV13Items = items;
    }

    if (Array.isArray(allocs)) {
      state.allocs = allocs;
      window.__fintrustV13Allocs = allocs;
    }

    const canvas = document.getElementById(id);
    if (canvas) {
      const box = canvas.closest('.chart-box,.card,.panel');
      if (box) box.classList.add('fintrust-v13-hide');
    }

    schedule(80);
    schedule(400);

    return null;
  };

  window.addEventListener('load', function () {
    schedule(200);
    schedule(1000);
  });

  window.addEventListener('resize', function () {
    schedule(160);
  });

  window.addEventListener('orientationchange', function () {
    schedule(260);
  });

  document.addEventListener('DOMContentLoaded', function () {
    schedule(200);
    schedule(1000);
  });

  document.addEventListener('fintrust:contentchange', function () {
    schedule(150);
  });

  document.addEventListener('fintrust:modechange', function () {
    schedule(150);
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(function () {
      if (!applying) schedule(250);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  hideIpoWatchlistButton();
  window.__FINTRUST_TERMINAL_LAYOUT_V13__ = VERSION;
})();
