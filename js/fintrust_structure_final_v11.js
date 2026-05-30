(function () {
  const VERSION = '20260529-structure-final-v11';
  let timer = null;

  function txt(node) {
    return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function hasText(node, pattern) {
    return pattern.test(txt(node));
  }

  function hideNode(node, className) {
    if (!node) return;
    node.classList.add(className);
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('height', '0', 'important');
    node.style.setProperty('max-height', '0', 'important');
    node.style.setProperty('overflow', 'hidden', 'important');
    node.style.setProperty('margin', '0', 'important');
    node.style.setProperty('padding', '0', 'important');
    node.style.setProperty('border', '0', 'important');
  }

  function removeIpoWatchlistButton() {
    document.querySelectorAll('button, a, .tab, .nav-tab, .quick-tab, .pill, .market-tab, [role="button"]').forEach(function (node) {
      const t = txt(node).toLowerCase();

      if (
        t.includes('ipo') &&
        (t.includes('watchlist') || t.includes('watch list'))
      ) {
        hideNode(node, 'fintrust-hide-ipo-watchlist');
      }
    });
  }

  function removePieChart() {
    const pieNodes = [
      document.getElementById('pieChart'),
      document.getElementById('pieChart__fintrust_dom'),
      document.getElementById('pieChart__fintrust_compact')
    ].filter(Boolean);

    pieNodes.forEach(function (node) {
      const box = node.closest('.chart-box') || node.closest('.card') || node.parentElement;
      hideNode(box || node, 'fintrust-hide-pie');
    });

    document.querySelectorAll('.chart-box, .chart-card, .card, .panel').forEach(function (node) {
      const t = txt(node).toLowerCase();

      if (
        t.includes('alokasi beli') ||
        t.includes('diagram alokasi pembelian') ||
        t.includes('tidak ada alokasi beli')
      ) {
        hideNode(node, 'fintrust-hide-pie');
      }
    });
  }

  function removeBuyRecommendationSection() {
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, section, .section-title').forEach(function (node) {
      const t = txt(node).toLowerCase();

      if (t === 'rekomendasi pembelian' || t.includes('rekomendasi pembelian')) {
        let section =
          node.closest('section') ||
          node.closest('.panel') ||
          node.closest('.card') ||
          node.parentElement;

        if (!section) section = node;

        hideNode(section, 'fintrust-hide-buy-section');

        /* Sembunyikan beberapa sibling card rekomendasi setelah judul */
        let next = section.nextElementSibling;
        let guard = 0;

        while (next && guard < 8) {
          const nt = txt(next).toLowerCase();

          if (
            nt.includes('direkomendasikan beli bertahap') ||
            nt.includes('rekomendasi') ||
            nt.includes('saham)')
          ) {
            const toHide = next;
            next = next.nextElementSibling;
            hideNode(toHide, 'fintrust-hide-buy-section');
          } else {
            break;
          }

          guard++;
        }
      }
    });

    document.querySelectorAll('.recommendation-card, .recommendation-item, .buy-recommendation, .purchase-recommendation').forEach(function (node) {
      const t = txt(node).toLowerCase();

      if (
        t.includes('direkomendasikan beli bertahap') ||
        t.includes('rekomendasi pembelian') ||
        /[A-Z]{3,5}\s*•\s*BELI/i.test(txt(node))
      ) {
        hideNode(node, 'fintrust-hide-buy-section');
      }
    });
  }

  function findScoreBox() {
    const score =
      document.getElementById('scoreChart__fintrust_compact') ||
      document.getElementById('scoreChart__fintrust_dom') ||
      document.getElementById('scoreChart');

    if (!score) return null;

    return (
      score.closest('.chart-card') ||
      score.closest('.chart-box') ||
      score.parentElement
    );
  }

  function findPanelFromScore(scoreBox) {
    if (!scoreBox) return null;

    return (
      scoreBox.closest('.comparison-panel') ||
      scoreBox.closest('.compare-grid') ||
      scoreBox.closest('.result-area') ||
      scoreBox.closest('.results') ||
      scoreBox.closest('.panel') ||
      scoreBox.parentElement
    );
  }

  function findStockList(panel, scoreBox) {
    if (!panel) return null;

    const candidates = Array.from(panel.querySelectorAll('table, .table-wrap, .stock-mobile-list, .stock-list, .result-table, .recommendation-table, .analysis-table, .card, .panel, div'));

    let best = null;
    let bestScore = -1;

    candidates.forEach(function (node) {
      if (!node || node === scoreBox || node.contains(scoreBox)) return;
      if (node.closest('.fintrust-hide-pie') || node.closest('.fintrust-hide-buy-section')) return;

      const t = txt(node).toLowerCase();
      let score = 0;

      if (t.includes('kode')) score += 2;
      if (t.includes('nama')) score += 2;
      if (t.includes('harga')) score += 2;
      if (t.includes('skor')) score += 2;
      if (t.includes('mampu dibeli')) score += 4;
      if (t.includes('tidak direkomendasikan beli')) score += 3;
      if (t.includes('direkomendasikan beli')) score += 2;
      if (t.includes('saham)')) score += 2;

      const stockCodeMatches = (t.match(/\b[a-z]{3,5}\b/g) || []).length;
      if (stockCodeMatches >= 3) score += 2;

      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    });

    return bestScore >= 5 ? best : null;
  }

  function structureResult() {
    const scoreBox = findScoreBox();
    if (!scoreBox) return;

    const panel = findPanelFromScore(scoreBox);
    if (!panel) return;

    const stockList = findStockList(panel, scoreBox);

    panel.classList.add('fintrust-result-final');

    scoreBox.classList.add('fintrust-score-first');
    scoreBox.style.setProperty('order', '1', 'important');
    scoreBox.style.setProperty('width', '100%', 'important');
    scoreBox.style.setProperty('max-width', '100%', 'important');

    if (stockList) {
      stockList.classList.add('fintrust-stock-list-second');
      stockList.style.setProperty('order', '2', 'important');
      stockList.style.setProperty('width', '100%', 'important');
      stockList.style.setProperty('max-width', '100%', 'important');

      /* Jika score dan list punya parent sama, reorder dengan DOM */
      if (scoreBox.parentElement === stockList.parentElement) {
        stockList.parentElement.insertBefore(scoreBox, stockList);
      }
    }

    /* Jika parent grid masih dua kolom, paksa jadi satu kolom */
    panel.style.setProperty('display', 'grid', 'important');
    panel.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
    panel.style.setProperty('gap', '14px', 'important');
    panel.style.setProperty('width', '100%', 'important');
    panel.style.setProperty('max-width', '100%', 'important');
    panel.style.setProperty('min-width', '0', 'important');
  }

  function fixBeliText() {
    document.querySelectorAll('td, div, span, b, strong, button').forEach(function (node) {
      if (!node || node.children.length > 3) return;

      const raw = txt(node);
      const compact = raw.replace(/\s+/g, '').toUpperCase();

      if (compact === 'BELI') {
        node.classList.add('fintrust-nowrap-beli');
        node.style.setProperty('white-space', 'nowrap', 'important');
        node.style.setProperty('word-break', 'keep-all', 'important');
        node.style.setProperty('overflow-wrap', 'normal', 'important');
      }
    });
  }

  function apply() {
    removeIpoWatchlistButton();
    removePieChart();
    removeBuyRecommendationSection();
    structureResult();
    fixBeliText();
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay || 120);
  }

  window.addEventListener('load', function () {
    schedule(80);
    schedule(600);
    schedule(1500);
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
      schedule(220);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  schedule(150);
  schedule(900);
  schedule(2000);

  window.__FINTRUST_STRUCTURE_FINAL__ = VERSION;
})();
