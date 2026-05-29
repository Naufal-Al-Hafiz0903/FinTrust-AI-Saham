const API_BASE = window.location.origin;
const API_ANALYZE_URL = `${API_BASE}/api/analyze`;
const API_STOCK_URL = `${API_BASE}/api/stock`;
const API_STOCKS_URL = `${API_BASE}/api/stocks`;
const API_FX_URL = `${API_BASE}/api/fx/usdidr`;
const WEIGHTS = {fundamental: .35, technical: .25, sentiment: .20, risk: .20};
const GLOBAL_HINTS = new Set(['AAPL','MSFT','NVDA','TSLA','GOOGL','GOOG','AMZN','META','BRK-B','NFLX','AMD','INTC','AVGO','ORCL','TSM','JPM','BAC','V','MA','UNH','JNJ','PFE','KO','PEP','WMT','COST','XOM','CVX','SHEL','NKE','DIS','ADBE','CRM','SHOP','BABA','MELI','RIVN','NIO']);
const UNIVERSE = {
  idx: {
    'Perbankan':['BBCA','BBRI','BMRI','BBNI','BRIS','BTPS','ARTO','BNGA','BDMN','NISP'],
    'Batu Bara':['ADRO','PTBA','ITMG','BYAN','UNTR','DSSA','HRUM','INDY','BUMI','TOBA','MBAP','AADI'],
    'Energi & Migas':['MEDC','PGAS','AKRA','ELSA','RAJA','ENRG','WIKA','PTRO','SRTG'],
    'Teknologi':['GOTO','BUKA','EMTK','MTEL','DCII','WIFI','EDGE','DMMX'],
    'Telekomunikasi':['TLKM','EXCL','ISAT','MTEL','TOWR','TBIG'],
    'Consumer':['ICBP','INDF','UNVR','MYOR','GOOD','ULTJ','SIDO','CMRY','ROTI','CLEO'],
    'Kesehatan':['KLBF','MIKA','HEAL','SILO','TSPC','SIDO'],
    'Properti':['BSDE','CTRA','PWON','SMRA','LPKR','DMAS'],
    'Retail':['AMRT','MAPI','ERAA','ACES','MAPA','RALS'],
    'Semen & Konstruksi':['SMGR','INTP','WIKA','WSKT','PTPP','ADHI'],
    'Metal & Mineral':['ANTM','INCO','MDKA','TINS','AMMN','BRMS','NCKL'],
    'CPO & Perkebunan':['AALI','LSIP','SIMP','DSNG','SSMS','TBLA']
  },
  global: {
    'Teknologi Mega Cap':['AAPL','MSFT','GOOGL','GOOG','META','ORCL','ADBE','CRM'],
    'Semikonduktor':['NVDA','AMD','AVGO','INTC','TSM','QCOM','MU','ASML','ARM'],
    'EV & Otomotif':['TSLA','RIVN','NIO','GM','F','TM','BYDDY'],
    'E-commerce':['AMZN','BABA','SHOP','MELI','SE','EBAY'],
    'Keuangan':['JPM','BAC','V','MA','GS','MS','AXP','PYPL'],
    'Healthcare':['UNH','JNJ','PFE','LLY','MRK','ABBV','TMO'],
    'Consumer Global':['KO','PEP','WMT','COST','NKE','MCD','SBUX','PG'],
    'Energi Global':['XOM','CVX','SHEL','BP','COP','SLB'],
    'Media & Internet':['NFLX','DIS','SPOT','UBER','ABNB','BKNG']
  },
  ipo: {'Watchlist':['IPO-BANK','IPO-TECH','IPO-CONSUMER','IPO-ENERGY']
  },
  crypto: {
    'Top Crypto': ['BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD'],
    'DeFi & Token': ['LINK-USD', 'UNI-USD', 'AAVE-USD', 'AVAX-USD', 'MATIC-USD']
  }
};
const QUICK = {
  idx: ['BBCA','BBRI','BMRI','TLKM','ADRO','PTBA','ITMG','ANTM'],
  global: ['AAPL','MSFT','NVDA','AMD','TSLA','GOOGL','AMZN','JPM'],
  ipo: ['IPO-BANK','IPO-TECH','IPO-CONSUMER'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD']
};

let market = 'idx';
let lastStockData = null;
let lastFx = null;
let aiFallbackUsed = false;

const el = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m]));
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function safeText(v, fb = 'Belum tersedia') { const s = String(v ?? '').trim(); return s && s !== '-' ? s : fb; }
function unique(arr) { return [...new Set(arr.map(x => String(x).toUpperCase().trim()).filter(Boolean))]; }

function setMarket(m) {
  market = m;

  ['idx','global','ipo','crypto'].forEach(x => {
    const btn = el(`mode-${x}`); 
    if(btn) btn.classList.toggle('on', x === m);
  });

  const cryptoPanel = document.getElementById('cryptoPanel');
  if (cryptoPanel) {
    cryptoPanel.style.display = (m === 'crypto') ? 'block' : 'none';
  }

  el('currencyIn').value = (m === 'global' || m === 'crypto') ? 'USD' : 'IDR';
  
  if (m === 'crypto') {
    el('tickerIn').placeholder = 'BTC-USD, ETH-USD atau SOL-USD';
  } else if (m === 'global') {
    el('tickerIn').placeholder = 'AAPL, NVDA atau AAPL, MSFT, GOOGL';
  } else {
    el('tickerIn').placeholder = 'BBCA, ADRO atau BBCA, BBRI, BMRI';
  }
  
  renderSector(); 
  renderQuick(); 
  hideErr();
}

function renderSector() {
  const groups = Object.keys(UNIVERSE[market] || {});
  const first = market === 'ipo' ? 'Watchlist' : '__all__';
  const opts = market === 'ipo' 
    ? groups.map(g => TemplateUI.sectorOption(g, g, esc)).join('')
    : [TemplateUI.sectorOption('__all__', 'Semua Sektor', esc), ...groups.map(g => TemplateUI.sectorOption(g, g, esc))].join('');
  el('sectorSelect').innerHTML = opts;
  if(market !== 'ipo') el('sectorSelect').value = first;
}

function renderQuick() {
  const items = QUICK[market] || QUICK.idx;
  el('quickRow').innerHTML = `<span>Contoh:</span>${items.map(t => TemplateUI.quickButton(t)).join('')}`;
}

function qt(t) {
  el('tickerIn').value = t;
  if(GLOBAL_HINTS.has(t)) setMarket('global');
  else if(market !== 'ipo') setMarket('idx');
}

function parseAmount(v) {
  let s = String(v || '').trim().replace(/[^0-9,.]/g, '');
  if(!s) return 0;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if(c > d) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmtMoney(n, c = 'IDR') {
  const x = Number(n);
  if(!Number.isFinite(x)) return 'N/A';
  return new Intl.NumberFormat(c === 'IDR' ? 'id-ID' : 'en-US', {
    style: 'currency', currency: c, maximumFractionDigits: c === 'IDR' ? 0 : 2
  }).format(x);
}

function fmtNum(n, d = 2) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString('id-ID', { maximumFractionDigits: d }) : 'N/A';
}

function fmtDateTime(v) {
  if(!v) return 'waktu tidak tersedia';
  try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } 
  catch(_) { return 'waktu tidak tersedia'; }
}

function fxRate() {
  const r = Number(lastFx?.rate ?? lastFx?.USDIDR);
  return Number.isFinite(r) && r > 0 ? r : null;
}

function fxText() {
  const r = fxRate();
  return r ? `Kurs realtime USD/IDR ${fmtNum(r, 2)} · ${lastFx?.source || 'Yahoo Finance'} · ${fmtDateTime(lastFx?.fetchedAt)}` : 'Kurs USD/IDR realtime belum tersedia';
}

async function refreshFx() {
  try {
    const r = await fetch(API_FX_URL);
    if(!r.ok) throw new Error((await r.json()).error || 'Kurs gagal diambil');
    lastFx = await r.json();
    el('fxTag').textContent = `USD/IDR ${fmtNum(fxRate(), 2)}`;
    return lastFx;
  } catch(e) {
    el('fxTag').textContent = 'Kurs belum tersedia';
    return null;
  }
}

function convertBudget(nominal, fromCurrency, toCurrency) {
  const from = String(fromCurrency || 'IDR').toUpperCase(), to = String(toCurrency || 'IDR').toUpperCase();
  if(!nominal) return { ok: true, budget: 0, note: 'Nominal investasi belum diisi. Jumlah beli tidak dihitung.' };
  if(from === to) return { ok: true, budget: nominal, note: '' };
  
  const rate = fxRate();
  if(!rate) return { ok: false, budget: 0, note: 'Kurs USD/IDR realtime belum tersedia. Jumlah beli tidak dihitung agar tidak memakai angka perkiraan.' };
  
  if(from === 'IDR' && to === 'USD') return { ok: true, budget: nominal / rate, note: `Konversi memakai ${fxText()}.` };
  if(from === 'USD' && to === 'IDR') return { ok: true, budget: nominal * rate, note: `Konversi memakai ${fxText()}.` };
  
  return { ok: false, budget: 0, note: `Konversi ${from} ke ${to} belum didukung.` };
}

function scoreColor(s) {
  if(s >= 62) return 'var(--green)';
  if(s >= 42) return 'var(--yellow)';
  return 'var(--red)';
}

function safeScore(n, f = 50) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : f;
}

function clsVerdict(v) {
  const s = String(v || 'TUNGGU').toLowerCase();
  return ['beli', 'jual', 'tunggu'].includes(s) ? s : 'tunggu';
}

function verdictFromScore(s) {
  return s >= 62 ? 'BELI' : s >= 42 ? 'TUNGGU' : 'JUAL';
}

function splitTickers(v) {
  return String(v || '').toUpperCase().replace(/;/g, ',').split(/[\s,]+/).map(x => x.trim()).filter(Boolean).slice(0, 12);
}

function allTickers(m = market, group = el('sectorSelect')?.value || '__all__') {
  if(m === 'ipo') return UNIVERSE.ipo.Watchlist;
  const groups = UNIVERSE[m] || {};
  if(group && group !== '__all__' && groups[group]) return unique(groups[group]);
  return unique(Object.values(groups).flat());
}

function sectorByTicker(t) {
  const base = String(t).replace('.JK', '').toUpperCase();
  for(const [mk, groups] of Object.entries(UNIVERSE)) {
    for(const [g, list] of Object.entries(groups)) {
      if(list.includes(base)) return { market: mk, sector: g, tickers: list };
    }
  }
  return null;
}

function validateMarketChoice(tickers) {
  if(!tickers.length) return true;
  if(market === 'idx' && tickers.some(t => GLOBAL_HINTS.has(t.replace('.JK', '')))) {
    showErr('<b>Tipe saham tidak sesuai</b>Kode yang dimasukkan tampak seperti saham luar negeri. Pilih tombol Saham Luar Negeri agar harga yang diambil benar.');
    return false;
  }
  if(market === 'global' && tickers.some(t => t.endsWith('.JK'))) {
    showErr('<b>Tipe saham tidak sesuai</b>Kode .JK adalah saham Indonesia. Pilih tombol Saham Indonesia atau hapus akhiran .JK.');
    return false;
  }
  return true;
}

const SYS = {
  fundamental: `Kamu adalah Fundamental Analysis Agent. Output JSON valid saja. Format: {"signal":"BULLISH|NEUTRAL|BEARISH","score":0,"summary":"...","details":{"valuation":"..."},"key_metrics":["..."],"recommendation":"..."}`,
  technical: `Kamu adalah Technical Analysis Agent. Output JSON valid saja. Format: {"signal":"BULLISH|NEUTRAL|BEARISH","score":0,"summary":"...","details":{"trend":"..."},"key_levels":{"support1":"..."},"entry_zone":"...","recommendation":"..."}`,
  sentiment: `Kamu adalah Sentiment Analysis Agent. Output JSON valid saja. Format: {"signal":"BULLISH|NEUTRAL|BEARISH","score":0,"summary":"...","details":{"market_sentiment":"..."},"catalysts_positive":["..."],"catalysts_negative":["..."],"recommendation":"..."}`,
  risk: `Kamu adalah Risk Assessment Agent. Output JSON valid saja. Format: {"signal":"LOW|MEDIUM|HIGH","score":0,"summary":"...","details":{"market_risk":"..."},"top_risks":[{"risk":"...","severity":"HIGH","description":"..."}],"recommendation":"..."}`,
  decision: `Kamu adalah Decision Synthesis Agent. Output JSON valid saja. Format: {"company_name":"...","sector":"...","current_price":"...","verdict":"BELI|TUNGGU|JUAL","confidence":0,"composite_score":0,"target_price":"...","stop_loss":"...","upside_potential":"...","downside_risk":"...","time_horizon":"...","reasoning":{"dominant_factor":"...","signal_consensus":"...","key_consideration":"..."},"final_summary":"...","action_plan":{"if_buy":"...","watch_for":"..."},"why_buy":["..."],"why_not":["..."]}`
};

async function fetchStock(ticker) {
  if(market === 'ipo') return null;
  const r = await fetch(`${API_STOCK_URL}/${encodeURIComponent(ticker)}?market=${market}`);
  if(!r.ok) throw new Error((await r.json()).error || 'Market data gagal');
  const d = await r.json();
  lastStockData = d.stock || null;
  lastFx = d.fx || lastFx;
  return d.stock || null;
}

async function fetchStocks(tickers) {
  if(market === 'ipo') return { stocks: [], errors: [], fx: null };
  const body = { market, tickers: unique(tickers) };
  const r = await fetch(API_STOCKS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if(!r.ok) throw new Error((await r.json()).error || 'Market data gagal');
  const d = await r.json();
  lastFx = d.fx || lastFx;
  return d;
}

async function callAI(system, prompt, ticker) {
  const r = await fetch(API_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, ticker, market, nominal: parseAmount(el('amountIn').value), nominalCurrency: el('currencyIn').value })
  });
  if(!r.ok) {
    let m = 'Backend AI gagal';
    try { m = (await r.json()).error || m; } catch(_) { m = await r.text(); }
    throw new Error(m);
  }
  const d = await r.json();
  if(d.stock) lastStockData = d.stock;
  if(d.fx) lastFx = d.fx;
  if(!d.content) throw new Error('Response AI kosong');
  return d.content;
}

function parseJson(txt) {
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  if(!m) throw new Error('JSON tidak ditemukan');
  return JSON.parse(m[0]);
}

function localScore(stock) {
  const ch = Number(stock?.changePercent || 0), vol = Number(stock?.volume || 0), cap = Number(stock?.marketCap || 0);
  const momentum = clamp(55 + ch * 4, 20, 88);
  const liquidity = vol > 0 ? clamp(Math.log10(vol) * 10, 30, 90) : 48;
  const size = cap > 0 ? clamp((Math.log10(cap) - 8) * 12 + 45, 35, 92) : 50;
  const stability = clamp(78 - Math.abs(ch) * 6, 25, 88);
  const score = Math.round(momentum * .34 + liquidity * .22 + size * .24 + stability * .20);
  const verdict = verdictFromScore(score);
  const reason = verdict === 'BELI' ? 'Direkomendasikan beli bertahap karena skor, likuiditas, kapitalisasi, dan momentum relatif lebih baik.' : verdict === 'TUNGGU' ? 'Tidak direkomendasikan beli sekarang. Masih perlu konfirmasi momentum dan risiko.' : 'Tidak direkomendasikan beli karena skor risiko atau momentum belum mendukung.';
  return { score, verdict, reason, momentum: Math.round(momentum), liquidity: Math.round(liquidity), size: Math.round(size), stability: Math.round(stability) };
}

function agentFallback(agent, ticker, stock) {
  const base = stock ? `Harga real tersedia: ${stock.formattedPrice}.` : 'Harga real belum tersedia.';
  const map = {
    fundamental: { signal: 'NEUTRAL', score: 52, summary: `Fundamental ${ticker} dinilai netral konservatif. ${base}`, details: {} },
    technical: { signal: 'NEUTRAL', score: 50, summary: `Teknikal ${ticker} perlu konfirmasi tren, volume, support, dan resistance. ${base}`, details: {} },
    sentiment: { signal: 'NEUTRAL', score: 50, summary: `Sentimen ${ticker} belum dinilai penuh karena AI backend tidak aktif.`, details: {} },
    risk: { signal: 'MEDIUM', score: 45, summary: `Risiko ${ticker} dinilai sedang sampai data lengkap tersedia.`, details: {} }
  };
  return map[agent];
}

function finalFallback(ticker, ar, comp, stock) {
  const c = stock?.currency || 'IDR', p = Number(stock?.price || 0), verdict = verdictFromScore(comp);
  const notBuy = verdict !== 'BELI';
  return {
    company_name: stock?.name || ticker, sector: stock?.exchange || 'Belum tersedia',
    current_price: stock ? stock.formattedPrice : 'N/A', verdict, confidence: stock ? 50 : 35,
    composite_score: safeScore(comp, 45), target_price: p ? fmtMoney(p * 1.10, c) : 'N/A',
    stop_loss: p ? fmtMoney(p * .93, c) : 'N/A', upside_potential: p ? '+10%' : 'Belum tersedia',
    downside_risk: p ? '-7%' : 'Belum tersedia', time_horizon: 'Short to medium term',
    reasoning: {
      dominant_factor: 'Fallback lokal', signal_consensus: notBuy ? 'Tidak ada sinyal beli yang cukup kuat' : 'Sinyal cukup mendukung pembelian bertahap',
      key_consideration: notBuy ? 'Tidak direkomendasikan beli sampai data dan momentum lebih jelas.' : 'Tetap gunakan manajemen risiko dan stop loss.'
    },
    final_summary: notBuy ? `Saham ${ticker} tidak direkomendasikan beli saat ini. Harga real tetap digunakan sebagai referensi analisis.` : `Saham ${ticker} layak dipertimbangkan untuk pembelian bertahap dengan manajemen risiko.`,
    action_plan: {
      if_buy: notBuy ? 'Tidak melakukan pembelian. Pantau ulang ketika sinyal membaik.' : 'Beli bertahap sesuai porsi dan disiplin stop loss.',
      watch_for: 'Pantau volume, support, resistance, laporan keuangan, dan berita terbaru.'
    },
    why_buy: notBuy ? ['Belum ada alasan beli yang cukup kuat saat ini.'] : ['Harga real berhasil dipakai', 'Bisa dipantau untuk entry bertahap', 'Cocok untuk screening awal'],
    why_not: notBuy ? ['Tidak direkomendasikan beli saat ini', 'Analisis AI belum penuh atau sinyal belum kuat', 'Risiko pasar tetap perlu diperhatikan'] : ['Risiko pasar tetap ada', 'Validasi ulang dengan data terbaru', 'Gunakan batas risiko pribadi']
  };
}

function sanitizeFinal(final, stock, comp, ticker) {
  final = final || {};
  final.composite_score = Number.isFinite(Number(final.composite_score)) ? Number(final.composite_score) : Number(comp || 50);
  final.verdict = String(final.verdict || verdictFromScore(final.composite_score)).toUpperCase();
  if(!['BELI', 'TUNGGU', 'JUAL'].includes(final.verdict)) final.verdict = verdictFromScore(final.composite_score);
  final.company_name = safeText(final.company_name, stock?.name || ticker);
  final.sector = safeText(final.sector, stock?.exchange || 'Belum tersedia');
  final.current_price = safeText(final.current_price, stock?.formattedPrice || 'N/A');
  final.target_price = safeText(final.target_price, 'N/A');
  final.stop_loss = safeText(final.stop_loss, 'N/A');
  final.time_horizon = safeText(final.time_horizon, 'Short to medium term');
  final.confidence = safeScore(final.confidence, stock ? 50 : 35);
  final.reasoning = final.reasoning || {};
  const notBuy = final.verdict !== 'BELI';
  final.reasoning.dominant_factor = safeText(final.reasoning.dominant_factor, notBuy ? 'Sinyal beli belum kuat' : 'Skor dan momentum');
  final.reasoning.signal_consensus = safeText(final.reasoning.signal_consensus, notBuy ? 'Tidak direkomendasikan beli' : 'Layak dipertimbangkan beli');
  final.reasoning.key_consideration = safeText(final.reasoning.key_consideration, notBuy ? 'Tunggu konfirmasi data dan risiko.' : 'Beli bertahap dan gunakan stop loss.');
  final.final_summary = safeText(final.final_summary, notBuy ? `Saham ${ticker} tidak direkomendasikan beli saat ini.` : `Saham ${ticker} layak dipertimbangkan untuk beli bertahap.`);
  final.why_buy = Array.isArray(final.why_buy) && final.why_buy.length ? final.why_buy : [notBuy ? 'Belum ada alasan beli yang cukup kuat saat ini.' : 'Sinyal beli cukup mendukung.'];
  final.why_not = Array.isArray(final.why_not) && final.why_not.length ? final.why_not : [notBuy ? 'Tidak direkomendasikan beli saat ini.' : 'Tetap perhatikan risiko pasar.'];
  return final;
}

function enforcePrice(final, stock) {
  final = final || {};
  const p = Number(stock?.price || 0), c = stock?.currency || 'IDR';
  if(!p) { final.current_price = final.current_price || 'N/A'; return final; }
  final.company_name = final.company_name || stock.name;
  final.sector = final.sector || stock.exchange;
  final.current_price = stock.formattedPrice;
  final.target_price = fmtMoney(p * 1.10, c);
  final.stop_loss = fmtMoney(p * .93, c);
  final.upside_potential = final.upside_potential || '+10%';
  final.downside_risk = final.downside_risk || '-7%';
  return final;
}

function stockMinBuy(stock) {
  const price = Number(stock?.price || 0);
  if(!price) return { ok: false, minCost: 0, unit: 'harga tidak tersedia' };
  const isIdx = stock.market === 'idx' || stock.symbol?.endsWith('.JK');
  return { ok: true, minCost: isIdx ? price * 100 : price, unit: isIdx ? '1 lot (100 saham)' : '1 saham utuh', isIdx };
}

function affordability(stock, nominal = parseAmount(el('amountIn').value), currency = el('currencyIn').value) {
  const min = stockMinBuy(stock);
  if(!nominal) return { ok: false, canBuy: false, note: 'Nominal investasi belum diisi.', budget: 0, minCost: min.minCost, currency: stock?.currency || 'IDR', unit: min.unit };
  if(!min.ok) return { ok: false, canBuy: false, note: 'Harga realtime belum tersedia.', budget: 0, minCost: 0, currency: stock?.currency || 'IDR', unit: min.unit };
  const conv = convertBudget(nominal, currency, stock.currency || 'IDR');
  if(!conv.ok) return { ok: false, canBuy: false, note: conv.note, budget: 0, minCost: min.minCost, currency: stock.currency || 'IDR', unit: min.unit };
  const canBuy = conv.budget >= min.minCost;
  return { ok: true, canBuy, budget: conv.budget, minCost: min.minCost, currency: stock.currency || 'IDR', unit: min.unit, note: canBuy ? `Nominal cukup untuk minimal ${min.unit}.` : `Nominal belum cukup. Minimal ${fmtMoney(min.minCost, stock.currency || 'IDR')} untuk ${min.unit}.`, fxNote: conv.note };
}

function buildPlan(final, stock) {
  stock = stock || lastStockData;
  const nominal = parseAmount(el('amountIn').value), nominalCurrency = el('currencyIn').value;
  if(!nominal) return { ready: false, note: 'Nominal investasi belum diisi. Sistem hanya menampilkan analisis saham tanpa jumlah pembelian.' };
  if(!stock?.price) return { ready: false, note: 'Harga real belum tersedia, jadi jumlah pembelian belum bisa dihitung.' };
  const stockCurrency = stock.currency || 'IDR', aff = affordability(stock, nominal, nominalCurrency);
  if(!aff.ok) return { ready: false, note: aff.note };
  const verdict = String(final.verdict || 'TUNGGU').toUpperCase(), comp = safeScore(final.composite_score, 50);
  if(!aff.canBuy) return { ready: true, stockCurrency, budget: aff.budget, buyBudget: 0, alloc: 0, qty: 0, lots: 0, fractional: 0, used: 0, left: aff.budget, isIdx: aff.unit.includes('lot'), note: `Tidak direkomendasikan beli. ${aff.note}`, fxNote: aff.fxNote, verdict: 'JUAL' };
  
  const alloc = verdict === 'BELI' ? (comp >= 75 ? .9 : .65) : 0;
  const buyBudget = aff.budget * alloc, price = Number(stock.price), isIdx = stock.market === 'idx' || stock.symbol?.endsWith('.JK');
  let qty = 0, lots = 0, fractional = 0, used = 0;
  
  if(verdict === 'BELI') {
    if(isIdx) {
      lots = Math.floor(buyBudget / (price * 100));
      qty = lots * 100;
      used = qty * price;
    } else {
      qty = Math.floor(buyBudget / price);
      fractional = price > 0 ? buyBudget / price : 0;
      used = qty * price;
    }
  }
  const noUnit = verdict === 'BELI' && used <= 0;
  const note = noUnit ? `Tidak direkomendasikan beli dengan alokasi ini karena dana alokasi belum cukup untuk minimal ${aff.unit}.` : verdict === 'BELI' ? 'Direkomendasikan beli bertahap sesuai porsi alokasi.' : 'Tidak direkomendasikan beli saat ini. Dana tidak dialokasikan untuk pembelian saham ini.';
  return { ready: true, stockCurrency, budget: aff.budget, buyBudget: used, alloc: used > 0 ? used / aff.budget : 0, qty, lots, fractional, used, left: aff.budget - used, isIdx, note, fxNote: aff.fxNote, verdict: used > 0 ? verdict : 'JUAL' };
}

function renderPlan(plan) {
  return TemplateUI.renderPlan(plan, fmtMoney, fmtNum, esc);
}

function agentStatus(a, msg) { el(`st-${a}`).textContent = msg; }
function showNotice(m, type = 'error') { const b = el('errbox'); b.className = type === 'warn' ? 'err warn' : 'err'; b.innerHTML = m; b.style.display = 'block'; }
function showErr(m) { showNotice(m, 'error'); }
function showWarn(m) { showNotice(m, 'warn'); }
function hideErr() { el('errbox').style.display = 'none'; }

function stockContext(ticker, stock) {
  if(!stock) return `Ticker: ${ticker}\nMarket: ${market}\nHarga real belum tersedia. Jangan menebak harga.`;
  return `Ticker: ${ticker}\nNama: ${stock.name}\nMarket: ${stock.market}\nExchange: ${stock.exchange}\nHarga: ${stock.formattedPrice}\nCurrency: ${stock.currency}\nPerubahan harian: ${Number.isFinite(Number(stock.changePercent)) ? fmtNum(stock.changePercent, 2) + '%' : 'N/A'}\nVolume: ${stock.volume ? Number(stock.volume).toLocaleString('id-ID') : 'N/A'}\nSource: ${stock.source}`;
}

function render(ticker, ar, final, stock) {
  const plan = buildPlan(final, stock);
  const planHtml = renderPlan(plan);
  
  el('results').innerHTML = TemplateUI.mainResult(ticker, ar, final, stock, market, planHtml, scoreColor, clsVerdict, esc, safeText, safeScore);
  el('results').style.display = 'block';
  window.scrollTo({ top: el('results').offsetTop - 15, behavior: 'smooth' });
}

function prepareLoading(title, msg) {
  hideErr(); el('goBtn').disabled = true; el('loading').style.display = 'block'; el('results').style.display = 'none';
  el('loadTitle').textContent = title; el('pbMsg').textContent = msg; el('pb').style.width = '8%';
  ['fundamental', 'technical', 'sentiment', 'risk'].forEach(a => agentStatus(a, 'menunggu'));
}

function finishLoading() { el('loading').style.display = 'none'; el('goBtn').disabled = false; }

function rankedItems(stocks) {
  return stocks.map(stock => ({ stock, ticker: stock.ticker, scoreData: localScore(stock), aff: affordability(stock) })).sort((a, b) => b.scoreData.score - a.scoreData.score);
}

function purchaseWithBudget(stock, budget) {
  const price = Number(stock.price), isIdx = stock.market === 'idx' || stock.symbol?.endsWith('.JK');
  let qty = 0, lots = 0, used = 0, fractional = 0;
  if(isIdx) {
    lots = Math.floor(budget / (price * 100));
    qty = lots * 100;
    used = qty * price;
  } else {
    qty = Math.floor(budget / price);
    fractional = price > 0 ? budget / price : 0;
    used = qty * price;
  }
  return { qty, lots, used, fractional, isIdx };
}

function makeAllocations(items) {
  const nominal = parseAmount(el('amountIn').value), nominalCurrency = el('currencyIn').value;
  const out = items.map(it => ({ ticker: it.ticker, currency: it.stock.currency || 'IDR', budget: 0, used: 0, left: 0, qty: 0, lots: 0, fractional: 0, text: 'Tidak Direkomendasikan Beli', note: 'Tidak direkomendasikan beli saat ini.' }));
  
  if(!nominal) {
    out.forEach((x, i) => { x.note = 'Nominal investasi belum diisi. Jumlah beli tidak dihitung.'; x.left = 0; });
    return out;
  }
  
  const candidates = items.map((it, i) => ({ it, i, aff: affordability(it.stock, nominal, nominalCurrency) })).filter(x => x.it.scoreData.verdict === 'BELI' && x.aff.canBuy).slice(0, 5);
  if(!candidates.length) {
    items.forEach((it, i) => {
      const aff = affordability(it.stock, nominal, nominalCurrency);
      out[i].left = aff.budget || 0;
      out[i].note = aff.canBuy ? 'Tidak direkomendasikan beli oleh skor saat ini.' : aff.note;
    });
    return out;
  }
  
  const currency = candidates[0].it.stock.currency || 'IDR';
  const conv = convertBudget(nominal, nominalCurrency, currency);
  let remaining = conv.ok ? conv.budget : 0;
  const totalScore = candidates.reduce((s, x) => s + x.it.scoreData.score, 0) || 1;
  
  candidates.forEach((x, idx) => {
    if(remaining <= 0) return;
    const min = stockMinBuy(x.it.stock);
    let target = idx === candidates.length - 1 ? remaining : Math.min(remaining, conv.budget * (x.it.scoreData.score / totalScore));
    if(target < min.minCost && remaining >= min.minCost) target = min.minCost;
    const p = purchaseWithBudget(x.it.stock, Math.min(target, remaining));
    if(p.used <= 0) return;
    remaining -= p.used;
    out[x.i] = { ticker: x.it.ticker, currency, budget: p.used, used: p.used, left: remaining, qty: p.qty, lots: p.lots, fractional: p.fractional, text: p.isIdx ? `${p.lots} lot (${p.qty} saham)` : p.qty > 0 ? `${p.qty} saham utuh` : '0 saham utuh', note: 'Direkomendasikan beli berdasarkan skor dan harga realtime.' };
  });
  
  out.forEach((x, i) => {
    if(x.used === 0) {
      const aff = affordability(items[i].stock, nominal, nominalCurrency);
      x.left = remaining;
      x.note = items[i].scoreData.verdict === 'BELI' && !aff.canBuy ? aff.note : 'Tidak direkomendasikan beli atau tidak mendapat alokasi karena prioritas skor.';
    }
  });
  return out;
}

function drawBarChart(id, items) {
  const cv = el(id); if(!cv) return;
  const ctx = cv.getContext('2d'), ratio = devicePixelRatio || 1, w = cv.width = cv.clientWidth * ratio, h = cv.height = cv.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
  const cw = cv.clientWidth, ch = cv.clientHeight, p = 34, barW = (cw - p * 2) / Math.max(items.length, 1) * .58;
  ctx.fillStyle = '#95aa9b'; ctx.font = '12px Segoe UI'; ctx.fillText('Composite Score', p, 22);
  items.forEach((it, i) => {
    const x = p + i * ((cw - p * 2) / items.length) + barW * .35, y = ch - p - (it.scoreData.score / 100) * (ch - p * 2);
    ctx.fillStyle = it.scoreData.score >= 62 ? '#62c482' : it.scoreData.score >= 42 ? '#d7b95c' : '#e06a6a';
    ctx.fillRect(x, y, barW, ch - p - y);
    ctx.fillStyle = '#e6f0e8'; ctx.fillText(it.ticker, x, ch - 12); ctx.fillText(String(it.scoreData.score), x, y - 6);
  });
}

function drawPieChart(id, items, allocs) {
  const cv = el(id); if(!cv) return;
  const ctx = cv.getContext('2d'), ratio = devicePixelRatio || 1, w = cv.width = cv.clientWidth * ratio, h = cv.height = cv.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
  const cw = cv.clientWidth, ch = cv.clientHeight, cx = cw / 2, cy = ch / 2 - 5, r = Math.min(cw, ch) * .28;
  const buy = items.map((it, i) => ({ label: it.ticker, value: allocs[i]?.used || 0 })).filter(x => x.value > 0);
  const total = buy.reduce((s, x) => s + x.value, 0);
  let data = total > 0 ? buy : [{ label: 'Cash / tidak beli', value: 1 }];
  let start = -Math.PI / 2;
  data.forEach((d, i) => {
    const sum = data.reduce((s, x) => s + x.value, 0), end = start + (d.value / sum) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
    ctx.fillStyle = ['#62c482', '#6ea8ff', '#d7b95c', '#e06a6a', '#95aa9b', '#b48cff'][i % 6]; ctx.fill(); start = end;
  });
  ctx.fillStyle = '#e6f0e8'; ctx.font = '13px Segoe UI'; ctx.fillText(total > 0 ? 'Alokasi beli' : 'Tidak ada alokasi beli', 20, 24);
  ctx.font = '12px Segoe UI';
  data.forEach((d, i) => {
    ctx.fillStyle = ['#62c482', '#6ea8ff', '#d7b95c', '#e06a6a', '#95aa9b', '#b48cff'][i % 6]; ctx.fillRect(20, 44 + i * 20, 10, 10);
    ctx.fillStyle = '#95aa9b'; ctx.fillText(d.label, 36, 54 + i * 20);
  });
}

function renderComparison(title, subtitle, items, errors = []) {
  const allocs = makeAllocations(items);
  el('results').innerHTML = TemplateUI.comparison(title, subtitle, items, allocs, errors, fxText(), clsVerdict, esc, fmtNum, fmtMoney, affordability);
  el('results').style.display = 'block';
  setTimeout(() => { drawBarChart('scoreChart', items); drawPieChart('pieChart', items, allocs); }, 50);
  window.scrollTo({ top: el('results').offsetTop - 15, behavior: 'smooth' });
}

async function runRecommendation() {
  if(market === 'ipo') {
    el('results').innerHTML = TemplateUI.ipoNotice();
    el('results').style.display = 'block'; return;
  }
  const group = el('sectorSelect').value || '__all__', tickers = allTickers(market, group);
  el('pbMsg').textContent = `Mengambil harga realtime ${tickers.length} saham...`; el('pb').style.width = '35%';
  const d = await fetchStocks(tickers); el('pb').style.width = '72%';
  const ranked = rankedItems(d.stocks);
  if(!ranked.length) throw new Error('Data saham realtime tidak tersedia untuk cakupan ini.');
  const nominal = parseAmount(el('amountIn').value), label = market === 'global' ? 'Saham Luar Negeri' : 'Saham Indonesia', scope = group === '__all__' ? 'Semua Sektor' : group;
  const affordable = ranked.filter(it => it.aff.canBuy).slice(0, 12);
  const available = ranked.map(it => ({ ticker: it.ticker, minCost: it.aff.minCost, currency: it.aff.currency, unit: it.aff.unit })).filter(x => x.minCost > 0);
  if(!affordable.length) {
    showWarn(`<b>Nominal belum cukup</b>Tidak ada saham ${label} dalam cakupan ${scope} yang mampu dibeli dengan nominal ${fmtMoney(nominal, el('currencyIn').value)} berdasarkan harga realtime.`);
    el('results').innerHTML = TemplateUI.noAffordable(label, scope, available, esc, fmtMoney);
    el('results').style.display = 'block'; return;
  }
  const buyCount = affordable.filter(x => x.scoreData.verdict === 'BELI').length;
  if(!buyCount) showWarn(`<b>Belum ada rekomendasi BELI</b>Nominal cukup untuk beberapa saham, tetapi scoring belum menemukan saham yang layak dibeli saat ini.`);
  const subtitle = `Rekomendasi otomatis berdasarkan ${label}, cakupan ${scope}, nominal ${fmtMoney(nominal, el('currencyIn').value)}, dan harga realtime. Hanya saham yang mampu dibeli yang ditampilkan.`;
  renderComparison(`Rekomendasi ${label} · ${scope}`, subtitle, affordable, d.errors || []);
}

async function renderPeerComparison(ticker) {
  if(market === 'ipo') return;
  const info = sectorByTicker(ticker) || { sector: el('sectorSelect').value === '__all__' ? 'Semua Sektor' : el('sectorSelect').value, tickers: allTickers(market, el('sectorSelect').value) };
  let list = unique(info.tickers || []).slice(0, 10);
  const base = ticker.replace('.JK', '').toUpperCase();
  if(!list.includes(base)) list = [base, ...list].slice(0, 10);
  try {
    const d = await fetchStocks(list);
    const items = rankedItems(d.stocks);
    if(items.length < 2) return;
    const subtitle = parseAmount(el('amountIn').value) ? `Pembanding sektor ${info.sector}. Nominal dipakai hanya untuk saham yang mampu dibeli dan statusnya BELI.` : `Pembanding sektor ${info.sector}. Nominal belum diisi, jadi tidak ada alokasi beli.`;
    const allocs = makeAllocations(items);
    el('comparisonMount').innerHTML = TemplateUI.comparison(`Pembanding ${info.sector}`, subtitle, items, allocs, d.errors || [], fxText(), clsVerdict, esc, fmtNum, fmtMoney, affordability);
    setTimeout(() => { drawBarChart('scoreChart', items); drawPieChart('pieChart', items, allocs); }, 50);
  } catch(e) {
    el('comparisonMount').innerHTML = TemplateUI.peerError(e.message, esc);
  }
}

async function runComparison(tickers) {
  if(market === 'ipo') return runRecommendation();
  el('pbMsg').textContent = 'Mengambil data saham pembanding...'; el('pb').style.width = '35%';
  const d = await fetchStocks(tickers); el('pb').style.width = '78%';
  const items = rankedItems(d.stocks);
  if(items.length < 2) throw new Error('Minimal dua saham harus berhasil diambil untuk perbandingan.');
  const sectors = unique(items.map(x => sectorByTicker(x.ticker)?.sector || 'Tidak terklasifikasi'));
  if(sectors.length > 1) showWarn(`<b>Sektor berbeda</b>Perbandingan tetap ditampilkan, tetapi hasil terbaik adalah membandingkan saham dari sektor yang sama.`);
  const label = market === 'crypto' ? 'Cryptocurrency' : (market === 'global' ? 'Saham Luar Negeri' : 'Saham Indonesia');
  renderComparison(`Perbandingan ${label}`, `Membandingkan ${items.map(x => x.ticker).join(', ')} pada tipe saham yang sama.`, items, d.errors || []);
}
// PROPHET, XGBOOST, RANDOM FOREST
let predictionData = { prophet: null, xgboost: null, randomforest: null };

window.renderPredictionView = function(model, ticker) {
  const card = document.getElementById('predictionCard');
  if (!card) return;

  const data = predictionData[model];

  if (!data) {
    card.innerHTML = `<p class="compare-note" style="color:var(--text2);">⏳ Model <b>${model.toUpperCase()}</b> sedang diproses... harap tunggu.</p>`;
    return;
  }
  if (data.error) {
    card.innerHTML = TemplateUI.predictionModelError(model, data.error, esc);
    return;
  }

  // RENDER LOGIC
  if (model === 'randomforest') {
    const trend = data.trend || data.prediction || data.class || data.signal || 'N/A';
    const confidence = data.confidence || data.probability || data.score || 0;
    const confPercent = (confidence * 100).toFixed(1);

    const isBullish = trend.toString().toLowerCase().includes('bullish') || trend.toString().toLowerCase().includes('naik') || data.class === 1;
    const trendColor = isBullish ? 'var(--green)' : 'var(--red)';
    const arrowClass = isBullish ? 'bullish' : 'bearish';

    const threshold = 65.0; 
    const isValidSignal = confPercent >= threshold;
    const riskPercent = (100 - confPercent).toFixed(1);

    let profitProjectionHtml = '';
    if (isBullish && isValidSignal) {
        profitProjectionHtml = TemplateUI.xgboostProfit(riskPercent);
    } else if (isBullish && !isValidSignal) {
        profitProjectionHtml = TemplateUI.xgboostWarn(riskPercent);
    } else {
        profitProjectionHtml = TemplateUI.xgboostLoss(confPercent);
    }

    const signalNote = isValidSignal 
      ? `<p class="xgb-note" style="color:var(--green); margin-top: 10px; font-size: 12px;">✅ <b>Sinyal Valid:</b> Keyakinan berada di atas standar aman trading (${threshold}%).</p>`
      : `<p class="xgb-note" style="color:var(--yellow); margin-top: 10px; font-size: 12px;">⚠️ <b>Peringatan:</b> Keyakinan di bawah standar aman trading (${threshold}%).</p>`;

    card.innerHTML = TemplateUI.rfView(data, ticker, confPercent, trend, trendColor, arrowClass, signalNote, profitProjectionHtml, esc);
    
  } else if (model === 'xgboost') {
    const trend = data.trend || data.prediction || data.class || data.signal || 'N/A';
    const confidence = data.confidence || data.probability || data.score || 0;
    const confPercent = (confidence * 100).toFixed(1);

    const isBullish = trend.toLowerCase().includes('bullish') || trend.toLowerCase().includes('naik') || data.class === 1;
    const trendColor = isBullish ? 'var(--green)' : 'var(--red)';
    const trendIcon = isBullish ? '📈' : '📉';

    const threshold = 65.0;
    const isValidSignal = confPercent >= threshold;
    const riskPercent = (100 - confPercent).toFixed(1);

    let profitProjectionHtml = '';
    if (isBullish && isValidSignal) {
        profitProjectionHtml = TemplateUI.xgboostProfit(riskPercent);
    } else if (isBullish && !isValidSignal) {
        profitProjectionHtml = TemplateUI.xgboostWarn(riskPercent);
    } else {
        profitProjectionHtml = TemplateUI.xgboostLoss(confPercent);
    }

    const signalNote = isValidSignal 
      ? `<p class="xgb-note" style="color:var(--green);">✅ <b>Sinyal Valid:</b> Keyakinan berada di atas standar trading riil (${threshold}%).</p>`
      : `<p class="xgb-note" style="color:var(--yellow);">⚠️ <b>Peringatan:</b> Keyakinan di bawah standar trading riil (${threshold}%).</p>`;

    card.innerHTML = TemplateUI.xgboostView(data, ticker, confPercent, trend, trendColor, trendIcon, signalNote, profitProjectionHtml, esc);
    
  } else if (model === 'prophet') {
    const forecast = data.forecast || data.predictions || data.data || [];
    if (!Array.isArray(forecast) || forecast.length === 0) {
      card.innerHTML = TemplateUI.rawJsonView(data);
    } else {
      const slicedForecast = forecast.slice(0, 7);
      card.innerHTML = TemplateUI.prophetView(slicedForecast, ticker, esc, fmtNum);
    }
  }

  ['btn-prophet', 'btn-xgboost', 'btn-randomforest'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.remove('on');
  });
  const activeBtn = document.getElementById(`btn-${model}`);
  if(activeBtn) activeBtn.classList.add('on');
};

async function runPredictions(ticker) {
  try {
    const elMount = document.getElementById('comparisonMount'); 
    const oldContainer = document.getElementById('predictionContainerMount');
    if (oldContainer) oldContainer.remove();

    const predContainer = document.createElement('div');
    predContainer.id = 'predictionContainerMount';
    predContainer.innerHTML = TemplateUI.predictionContainer(ticker);
    elMount.parentNode.insertBefore(predContainer, elMount);

    // Reset cache & tampilkan loading di card aktif (xgboost default)
    predictionData = { prophet: null, xgboost: null, randomforest: null };
    const card = document.getElementById('predictionCard');
    if (card) card.innerHTML = `<p class="compare-note" style="color:var(--text2);">⏳ Menjalankan model AI... (Prophet ±30 detik, XGBoost & RF lebih cepat)</p>`;

    // Fetch ketiga model secara paralel, masing-masing independen
    const fetchModel = async (url, key) => {
      try {
        const r = await fetch(url);
        const data = await r.json();
        predictionData[key] = data;
      } catch (e) {
        predictionData[key] = { error: `Koneksi gagal: ${e.message}` };
      }
      // Render ulang jika model yang sedang aktif sudah selesai
      const activeBtn = document.querySelector('[id^="btn-"].on');
      const activeModel = activeBtn ? activeBtn.id.replace('btn-', '') : 'xgboost';
      if (activeModel === key) window.renderPredictionView(key, ticker);
    };

    // Jalankan paralel - XGBoost & RF cepat, Prophet lebih lambat
    await Promise.all([
      fetchModel(`${API_BASE}/api/predict/${encodeURIComponent(ticker)}?market=${market}`, 'prophet'),
      fetchModel(`${API_BASE}/api/predict/xgboost/${encodeURIComponent(ticker)}?market=${market}`, 'xgboost'),
      fetchModel(`${API_BASE}/api/predict/randomforest/${encodeURIComponent(ticker)}?market=${market}`, 'randomforest')
    ]);

    // Final render setelah semua selesai
    window.renderPredictionView('xgboost', ticker);

  } catch (e) {
    console.warn("Prediksi Multimodel gagal:", e);
    const card = document.getElementById('predictionCard');
    if (card) card.innerHTML = TemplateUI.predictionError(e.message, esc);
  }
}

async function runSingle(ticker) {
  aiFallbackUsed = false;
  let stock = null;
  try {
    el('pbMsg').textContent = 'Mengambil data Yahoo Finance...';
    stock = await fetchStock(ticker);
  } catch(e) {
    showWarn(`<b>Market data tidak tersedia</b>${esc(e.message)}. Analisis tetap dilanjutkan tanpa menebak harga.`);
  }
  const ctx = stockContext(ticker, stock), marketLabel = market === 'crypto' ? 'cryptocurrency' : (market === 'global' ? 'saham luar negeri' : market === 'idx' ? 'saham Indonesia' : 'IPO/watchlist');
  const prompts = {
    fundamental: `${ctx}\n\nAnalisa fundamental ${marketLabel} ini.`,
    technical: `${ctx}\n\nAnalisa teknikal ${marketLabel} ini.`,
    sentiment: `${ctx}\n\nAnalisa sentimen ${marketLabel} ini tanpa mengarang berita terbaru.`,
    risk: `${ctx}\n\nAnalisa risiko ${marketLabel} ini.`
  };
  const agents = ['fundamental', 'technical', 'sentiment', 'risk'], ar = {};
  let done = 0;
  
  await Promise.all(agents.map(async a => {
    try {
      agentStatus(a, 'menganalisa');
      ar[a] = parseJson(await callAI(SYS[a], prompts[a], ticker));
      agentStatus(a, `${safeText(ar[a].signal, 'NEUTRAL')} · ${safeScore(ar[a].score, 50)}`);
    } catch(e) {
      aiFallbackUsed = true;
      ar[a] = agentFallback(a, ticker, stock);
      agentStatus(a, `${ar[a].signal} · ${ar[a].score}`);
    }
    done++; el('pb').style.width = `${15 + done * 15}%`;
  }));
  
  const comp = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + (safeScore(ar[k]?.score, 50) * w), 0);
  const decisionPrompt = `${ctx}\n\nMarket: ${marketLabel}\nComposite Score: ${comp.toFixed(1)}\nFundamental: ${JSON.stringify(ar.fundamental)}\nTechnical: ${JSON.stringify(ar.technical)}\nSentiment: ${JSON.stringify(ar.sentiment)}\nRisk: ${JSON.stringify(ar.risk)}\nBuat keputusan final dan gunakan harga real bila tersedia.`;
  
  try {
    let final = parseJson(await callAI(SYS.decision, decisionPrompt, ticker));
    final.composite_score = Number(comp.toFixed(1));
    final = enforcePrice(final, stock);
    final = sanitizeFinal(final, stock, comp, ticker);
    el('pb').style.width = '100%';
    render(ticker, ar, final, stock);
    if(aiFallbackUsed) showWarn('<b>Sebagian agent memakai fallback lokal</b>Cek GROQ_API_KEY jika ingin analisis AI penuh.');
    await runPredictions(ticker);
  } catch(e) {
    aiFallbackUsed = true;
    let final = finalFallback(ticker, ar, comp, stock);
    final = enforcePrice(final, stock);
    final = sanitizeFinal(final, stock, comp, ticker);
    el('pb').style.width = '100%';
    render(ticker, ar, final, stock);
    showWarn('<b>Groq belum aktif atau API key tidak valid</b>Hasil tetap ditampilkan memakai fallback lokal dan data Yahoo Finance.');
    await runPredictions(ticker);
  }
  
  await renderPeerComparison(ticker.replace('.JK', ''));
}

async function run() {
  const tickers = splitTickers(el('tickerIn').value), nominal = parseAmount(el('amountIn').value);
  hideErr();
  if(!tickers.length && !nominal) {
    showErr('<b>Input belum lengkap</b>Masukkan kode saham untuk analisis, atau isi nominal investasi agar AI dapat mencari saham yang mampu dibeli.');
    el('results').innerHTML = TemplateUI.errorNotice();
    el('results').style.display = 'block'; return;
  }
  if(!validateMarketChoice(tickers)) return;
  prepareLoading('Menjalankan analisis', 'Menyiapkan data...');
  try {
    el('pbMsg').textContent = 'Memperbarui kurs USD/IDR realtime...';
    await refreshFx();
    if(!tickers.length) { await runRecommendation(); return; }
    if(tickers.length >= 2) { await runComparison(tickers); return; }
    await runSingle(tickers[0]);
  } catch(e) {
    showErr(`<b>Analisis gagal</b>${esc(e.message)}`);
    el('results').style.display = 'none';
  } finally {
    finishLoading();
  }
}

el('tickerIn').addEventListener('keydown', e => { if(e.key === 'Enter') run(); });
renderSector();
renderQuick();
refreshFx();/* ═══════════════════════════════════════════════════════════════
   STOCKMIND AI — FITUR TAMBAHAN
   Watchlist · Riwayat · Disimpan · Kalkulator Lot · Konversi Kurs · Berita Pasar
   Inject ke stockmind_ui.js (append di akhir file)
   ═══════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────
   STORAGE HELPERS (localStorage)
   ──────────────────────────────────────────── */
const SM_WATCHLIST = 'sm_watchlist_v1';
const SM_HISTORY   = 'sm_history_v1';
const SM_SAVED     = 'sm_saved_v1';

function storageGet(key, def = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ────────────────────────────────────────────
   PAGE SWITCHING
   ──────────────────────────────────────────── */
let _currentPage = 'analisa';

function showPage(pageId) {
  _currentPage = pageId;

  // Sembunyikan semua section utama
  const analyzeEls = ['market-pills-wrap','statRow','inputCard','errbox','loading','results','comparisonMount','page-footer-wrap'];
  // Toggle konten utama
  const mainContent = document.querySelector('.content');
  if (!mainContent) return;

  // Hapus page overlay lama
  const oldOverlay = document.getElementById('sm-page-overlay');
  if (oldOverlay) oldOverlay.remove();

  // Sembunyikan konten analisa
  const analyseChildren = mainContent.querySelectorAll(':scope > *');
  if (pageId !== 'analisa') {
    analyseChildren.forEach(c => { c.dataset.smHidden = '1'; c.style.display = 'none'; });
    const overlay = document.createElement('div');
    overlay.id = 'sm-page-overlay';
    overlay.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:18px;animation:fadeIn .2s ease';
    mainContent.appendChild(overlay);
    renderPageContent(pageId, overlay);
  } else {
    analyseChildren.forEach(c => { if(c.dataset.smHidden) { c.style.display = ''; delete c.dataset.smHidden; } });
  }

  // Update topbar title
  const titles = {
    analisa: 'Analisa Saham', watchlist: 'Watchlist', riwayat: 'Riwayat Analisis',
    disimpan: 'Disimpan', kalkulator: 'Kalkulator Lot', konversi: 'Konversi Kurs', berita: 'Berita Pasar'
  };
  const tb = document.querySelector('.topbar-title');
  if (tb) tb.textContent = titles[pageId] || pageId;
  const crumb = document.getElementById('activeMarketLabel');
  if (crumb) crumb.textContent = { analisa:'IDX / BEI', watchlist:'Saham Favorit', riwayat:'Riwayat', disimpan:'Tersimpan', kalkulator:'Tools', konversi:'Tools', berita:'Pasar' }[pageId] || '';
}

function renderPageContent(pageId, container) {
  const renders = {
    watchlist:  renderWatchlistPage,
    riwayat:    window.renderRiwayatPage || renderRiwayatPage,
    disimpan:   window.renderDisimpanPage || renderDisimpanPage,
    kalkulator: renderKalkulatorPage,
    konversi:   renderKonversiPage,
    berita:     renderBeritaPage,
  };
  if (renders[pageId]) renders[pageId](container);
}

/* ────────────────────────────────────────────
   WATCHLIST
   ──────────────────────────────────────────── */
function getWatchlist() { return storageGet(SM_WATCHLIST, []); }
function saveWatchlist(list) { storageSet(SM_WATCHLIST, list); updateWatchlistBadge(); }

function addToWatchlist(ticker, name = '', price = '', market = 'idx') {
  const list = getWatchlist();
  const t = String(ticker).toUpperCase();
  if (list.find(x => x.ticker === t)) { alert(`${t} sudah ada di watchlist.`); return; }
  list.unshift({ ticker: t, name, price, market, addedAt: new Date().toISOString() });
  saveWatchlist(list);
  if (_currentPage === 'watchlist') showPage('watchlist');
  showToast(`${t} ditambahkan ke Watchlist`);
}

function removeFromWatchlist(ticker) {
  const list = getWatchlist().filter(x => x.ticker !== ticker);
  saveWatchlist(list);
  if (_currentPage === 'watchlist') showPage('watchlist');
}

function updateWatchlistBadge() {
  const badge = document.querySelector('.nav-item .nav-badge');
  if (badge) badge.textContent = getWatchlist().length;
}

function renderWatchlistPage(container) {
  const list = getWatchlist();
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-star"></i> Watchlist Saham Saya</div>
        <button class="pill on" onclick="showAddWatchlistModal()"><i class="ti ti-plus" style="font-size:13px;"></i> Tambah</button>
      </div>
      ${list.length === 0 ? `
        <div style="text-align:center;padding:40px 0;color:var(--text3);">
          <i class="ti ti-star-off" style="font-size:40px;display:block;margin-bottom:12px;"></i>
          <div style="font-size:14px;margin-bottom:8px;">Watchlist masih kosong</div>
          <div style="font-size:12px;">Tambahkan saham favorit kamu untuk dipantau</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;" id="watchlistItems">
          ${list.map(item => `
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <div style="background:var(--accent-bg);border-radius:8px;padding:8px;color:var(--accent2);font-size:13px;font-family:var(--mono);font-weight:500;min-width:56px;text-align:center;">${esc(item.ticker)}</div>
                <div>
                  <div style="font-size:13px;font-weight:500;color:var(--text);">${esc(item.name || item.ticker)}</div>
                  <div style="font-size:11px;color:var(--text3);">Ditambah ${fmtDateTime(item.addedAt)} · ${esc(item.market?.toUpperCase() || 'IDX')}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="pill" onclick="analyzeFromWatchlist('${esc(item.ticker)}','${esc(item.market||'idx')}')">
                  <i class="ti ti-chart-bar" style="font-size:12px;"></i> Analisa
                </button>
                <button class="pill" style="color:var(--red);border-color:var(--red-bg);" onclick="removeFromWatchlist('${esc(item.ticker)}')">
                  <i class="ti ti-trash" style="font-size:12px;"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function showAddWatchlistModal() {
  const ticker = prompt('Masukkan kode saham (contoh: BBCA, AAPL, BTC-USD):');
  if (!ticker || !ticker.trim()) return;
  const t = ticker.trim().toUpperCase();
  const mkt = GLOBAL_HINTS.has(t) ? 'global' : t.includes('-USD') ? 'crypto' : 'idx';
  addToWatchlist(t, '', '', mkt);
}

function analyzeFromWatchlist(ticker, mkt) {
  setMarket(mkt);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item')[0]?.classList.add('active');
  showPage('analisa');
  el('tickerIn').value = ticker;
  setTimeout(() => run(), 100);
}

/* ────────────────────────────────────────────
   RIWAYAT ANALISIS
   ──────────────────────────────────────────── */
function getHistory() { return storageGet(SM_HISTORY, []); }
function addHistory(entry) {
  const list = getHistory();
  list.unshift({ ...entry, id: Date.now(), at: new Date().toISOString() });
  storageSet(SM_HISTORY, list.slice(0, 50)); // max 50
}

function renderRiwayatPage(container) {
  const list = getHistory();
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-history"></i> Riwayat Analisis</div>
        ${list.length > 0 ? `<button class="pill" style="color:var(--red);border-color:var(--red-bg);" onclick="clearHistory()"><i class="ti ti-trash" style="font-size:12px;"></i> Hapus Semua</button>` : ''}
      </div>
      ${list.length === 0 ? `
        <div style="text-align:center;padding:40px 0;color:var(--text3);">
          <i class="ti ti-history" style="font-size:40px;display:block;margin-bottom:12px;"></i>
          <div style="font-size:14px;margin-bottom:8px;">Belum ada riwayat analisis</div>
          <div style="font-size:12px;">Jalankan analisis saham untuk melihat riwayat di sini</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${list.map(item => `
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                <div style="background:${item.verdict==='BELI'?'var(--green-bg)':item.verdict==='JUAL'?'var(--red-bg)':'var(--amber-bg)'};border-radius:8px;padding:6px 10px;color:${item.verdict==='BELI'?'var(--green)':item.verdict==='JUAL'?'var(--red)':'var(--amber)'};font-size:11px;font-family:var(--mono);font-weight:600;min-width:48px;text-align:center;">${esc(item.verdict||'—')}</div>
                <div style="min-width:0;">
                  <div style="font-size:13px;font-weight:500;color:var(--text);">${esc(item.ticker)} <span style="font-size:11px;color:var(--text3);">${esc(item.name||'')}</span></div>
                  <div style="font-size:11px;color:var(--text3);">${fmtDateTime(item.at)} · Skor ${item.score||'—'} · ${esc(item.market?.toUpperCase()||'IDX')}</div>
                </div>
              </div>
              <button class="pill" onclick="replayAnalysis('${esc(item.ticker)}','${esc(item.market||'idx')}')">
                <i class="ti ti-refresh" style="font-size:12px;"></i> Ulang
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function clearHistory() {
  if (!confirm('Hapus semua riwayat analisis?')) return;
  storageSet(SM_HISTORY, []);
  showPage('riwayat');
}

function replayAnalysis(ticker, mkt) {
  setMarket(mkt);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item')[0]?.classList.add('active');
  showPage('analisa');
  el('tickerIn').value = ticker;
  setTimeout(() => run(), 100);
}

/* ────────────────────────────────────────────
   DISIMPAN (Simpan hasil analisis)
   ──────────────────────────────────────────── */
function getSaved() { return storageGet(SM_SAVED, []); }
function saveAnalysis(entry) {
  const list = getSaved();
  list.unshift({ ...entry, id: Date.now(), savedAt: new Date().toISOString() });
  storageSet(SM_SAVED, list.slice(0, 30));
  showToast('Analisis berhasil disimpan');
}
function deleteSaved(id) {
  storageSet(SM_SAVED, getSaved().filter(x => x.id !== id));
  if (_currentPage === 'disimpan') showPage('disimpan');
}

function renderDisimpanPage(container) {
  const list = getSaved();
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-bookmark"></i> Analisis Disimpan</div>
        ${list.length > 0 ? `<button class="pill" style="color:var(--red);border-color:var(--red-bg);" onclick="clearSaved()"><i class="ti ti-trash" style="font-size:12px;"></i> Hapus Semua</button>` : ''}
      </div>
      ${list.length === 0 ? `
        <div style="text-align:center;padding:40px 0;color:var(--text3);">
          <i class="ti ti-bookmark-off" style="font-size:40px;display:block;margin-bottom:12px;"></i>
          <div style="font-size:14px;margin-bottom:8px;">Belum ada analisis tersimpan</div>
          <div style="font-size:12px;">Setelah analisis selesai, klik tombol "Simpan" untuk menyimpan hasilnya</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${list.map(item => `
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:13px;font-weight:600;font-family:var(--mono);color:var(--accent2);">${esc(item.ticker)}</span>
                  <span style="font-size:11px;background:${item.verdict==='BELI'?'var(--green-bg)':item.verdict==='JUAL'?'var(--red-bg)':'var(--amber-bg)'};color:${item.verdict==='BELI'?'var(--green)':item.verdict==='JUAL'?'var(--red)':'var(--amber)'};padding:2px 8px;border-radius:99px;font-family:var(--mono);">${esc(item.verdict||'—')}</span>
                </div>
                <button class="pill" style="color:var(--red);border-color:var(--red-bg);font-size:11px;" onclick="deleteSaved(${item.id})"><i class="ti ti-trash" style="font-size:12px;"></i></button>
              </div>
              <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">${esc(item.summary||'Tidak ada ringkasan')}</div>
              <div style="font-size:11px;color:var(--text3);">Disimpan ${fmtDateTime(item.savedAt)} · Skor ${item.score||'—'} · Target ${esc(item.target||'N/A')} · Stop Loss ${esc(item.stopLoss||'N/A')}</div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function clearSaved() {
  if (!confirm('Hapus semua analisis tersimpan?')) return;
  storageSet(SM_SAVED, []);
  showPage('disimpan');
}

/* ────────────────────────────────────────────
   KALKULATOR LOT
   ──────────────────────────────────────────── */
function renderKalkulatorPage(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-calculator"></i> Kalkulator Lot Saham</div>
      </div>
      <div class="input-grid">
        <div class="field">
          <label>Harga saham saat ini (Rp)</label>
          <input id="kl-price" placeholder="7.000" inputmode="decimal" oninput="kalkulasiLot()">
        </div>
        <div class="field">
          <label>Modal investasi (Rp)</label>
          <input id="kl-modal" placeholder="5.000.000" inputmode="decimal" oninput="kalkulasiLot()">
        </div>
        <div class="field">
          <label>Target harga jual (Rp)</label>
          <input id="kl-target" placeholder="7.700" inputmode="decimal" oninput="kalkulasiLot()">
        </div>
        <div class="field">
          <label>Stop loss (Rp)</label>
          <input id="kl-sl" placeholder="6.500" inputmode="decimal" oninput="kalkulasiLot()">
        </div>
      </div>
      <div id="kl-result" style="margin-top:18px;"></div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-info-circle"></i> Tentang Lot IDX</div>
      </div>
      <div style="font-size:13px;color:var(--text2);line-height:1.8;">
        <div>• <b style="color:var(--text);">1 lot = 100 lembar saham</b> (standar Bursa Efek Indonesia)</div>
        <div>• Minimal pembelian adalah 1 lot (100 lembar)</div>
        <div>• Harga yang tertera di BEI adalah harga <b style="color:var(--text);">per lembar</b></div>
        <div>• Modal minimal = harga × 100 lembar</div>
        <div>• Perhatikan juga biaya broker (biasanya 0.1–0.3% per transaksi)</div>
      </div>
    </div>
  `;
}

function kalkulasiLot() {
  const price  = parseAmount(el('kl-price')?.value || '');
  const modal  = parseAmount(el('kl-modal')?.value || '');
  const target = parseAmount(el('kl-target')?.value || '');
  const sl     = parseAmount(el('kl-sl')?.value || '');
  const res    = el('kl-result');
  if (!res) return;

  if (!price || !modal) {
    res.innerHTML = `<div style="color:var(--text3);font-size:13px;">Masukkan harga saham dan modal untuk menghitung jumlah lot.</div>`;
    return;
  }

  const lotBisa   = Math.floor(modal / (price * 100));
  const modalUsed = lotBisa * price * 100;
  const sisa      = modal - modalUsed;
  const lembar    = lotBisa * 100;

  let profitHtml = '', slHtml = '';
  if (target > 0 && lembar > 0) {
    const profit = (target - price) * lembar;
    const pct    = ((target - price) / price * 100).toFixed(2);
    profitHtml = `<div style="background:var(--green-bg);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius);padding:10px 14px;margin-top:8px;">
      <div style="font-size:11px;color:var(--green);margin-bottom:4px;">ESTIMASI PROFIT (jika target tercapai)</div>
      <div style="font-size:18px;font-family:var(--mono);color:var(--green);font-weight:500;">${fmtMoney(profit, 'IDR')}</div>
      <div style="font-size:11px;color:var(--text3);">+${pct}% dari modal yang digunakan</div>
    </div>`;
  }
  if (sl > 0 && lembar > 0) {
    const loss = (price - sl) * lembar;
    const pct  = ((price - sl) / price * 100).toFixed(2);
    slHtml = `<div style="background:var(--red-bg);border:1px solid rgba(248,113,113,0.2);border-radius:var(--radius);padding:10px 14px;margin-top:8px;">
      <div style="font-size:11px;color:var(--red);margin-bottom:4px;">ESTIMASI LOSS (jika stop loss kena)</div>
      <div style="font-size:18px;font-family:var(--mono);color:var(--red);font-weight:500;">-${fmtMoney(loss, 'IDR')}</div>
      <div style="font-size:11px;color:var(--text3);">-${pct}% dari modal yang digunakan</div>
    </div>`;
  }

  res.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div class="stat"><div class="stat-label">Lot yang bisa dibeli</div><div class="stat-val">${lotBisa} lot</div><div class="stat-change">${lembar.toLocaleString('id-ID')} lembar saham</div></div>
      <div class="stat"><div class="stat-label">Modal yang dipakai</div><div class="stat-val" style="font-size:16px;">${fmtMoney(modalUsed,'IDR')}</div><div class="stat-change">Sisa ${fmtMoney(sisa,'IDR')}</div></div>
    </div>
    ${profitHtml}${slHtml}
    ${lotBisa === 0 ? `<div style="color:var(--red);font-size:13px;margin-top:8px;"><i class="ti ti-alert-circle"></i> Modal tidak cukup untuk membeli 1 lot. Minimal dibutuhkan ${fmtMoney(price*100,'IDR')}.</div>` : ''}
  `;
}

/* ────────────────────────────────────────────
   KONVERSI KURS
   ──────────────────────────────────────────── */
function renderKonversiPage(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-arrows-exchange"></i> Konversi Kurs Realtime</div>
        <button class="pill on" onclick="refreshKonversi()"><i class="ti ti-refresh" style="font-size:12px;"></i> Perbarui</button>
      </div>
      <div id="kurs-rate-info" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--text2);">
        <i class="ti ti-loader" style="animation:spin 1s linear infinite;"></i> Memuat kurs realtime...
      </div>
      <div class="input-grid">
        <div class="field">
          <label>Nominal</label>
          <input id="kv-amount" placeholder="1.000.000" inputmode="decimal" oninput="hitungKonversi()">
        </div>
        <div class="field">
          <label>Dari</label>
          <select id="kv-from" onchange="hitungKonversi()">
            <option value="IDR">IDR — Rupiah</option>
            <option value="USD">USD — Dollar Amerika</option>
            <option value="SGD">SGD — Dollar Singapura</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
            <option value="JPY">JPY — Yen Jepang</option>
            <option value="MYR">MYR — Ringgit Malaysia</option>
            <option value="AUD">AUD — Dollar Australia</option>
          </select>
        </div>
        <div class="field">
          <label>Ke</label>
          <select id="kv-to" onchange="hitungKonversi()">
            <option value="USD">USD — Dollar Amerika</option>
            <option value="IDR">IDR — Rupiah</option>
            <option value="SGD">SGD — Dollar Singapura</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
            <option value="JPY">JPY — Yen Jepang</option>
            <option value="MYR">MYR — Ringgit Malaysia</option>
            <option value="AUD">AUD — Dollar Australia</option>
          </select>
        </div>
        <div class="field" style="display:flex;align-items:flex-end;">
          <button class="btn" onclick="tukarKonversi()" style="margin:0;padding:9px;"><i class="ti ti-switch-horizontal"></i></button>
        </div>
      </div>
      <div id="kv-result" style="margin-top:16px;"></div>
    </div>
  `;
  refreshKonversi();
}

let _kursRates = {};

async function refreshKonversi() {
  const info = el('kurs-rate-info');
  if (info) info.innerHTML = `<i class="ti ti-loader" style="animation:spin 1s linear infinite;"></i> Memuat kurs realtime...`;
  try {
    const r = await fetch('/api/fx/usdidr');
    const d = await r.json();
    const usdIdr = d.rate || d.USDIDR || 16000;
    // Approx rates vs USD (update real jika API tersedia)
    _kursRates = { USD: 1, IDR: usdIdr, SGD: 0.74, EUR: 0.92, GBP: 0.79, JPY: 157, MYR: 4.68, AUD: 1.55 };
    if (info) info.innerHTML = `<i class="ti ti-circle-check" style="color:var(--green);"></i> Kurs USD/IDR: <b style="color:var(--text);">${fmtNum(usdIdr, 0)} IDR</b> — sumber Yahoo Finance · ${fmtDateTime(d.fetchedAt)}. Kurs lain bersifat estimasi.`;
    hitungKonversi();
  } catch {
    if (info) info.innerHTML = `<i class="ti ti-alert-circle" style="color:var(--red);"></i> Gagal memuat kurs realtime. Gunakan kurs estimasi.`;
    _kursRates = { USD: 1, IDR: 16000, SGD: 0.74, EUR: 0.92, GBP: 0.79, JPY: 157, MYR: 4.68, AUD: 1.55 };
    hitungKonversi();
  }
}

function tukarKonversi() {
  const from = el('kv-from'), to = el('kv-to');
  if (!from || !to) return;
  const tmp = from.value;
  from.value = to.value;
  to.value = tmp;
  hitungKonversi();
}

function hitungKonversi() {
  const amount = parseAmount(el('kv-amount')?.value || '');
  const from   = el('kv-from')?.value || 'IDR';
  const to     = el('kv-to')?.value || 'USD';
  const res    = el('kv-result');
  if (!res) return;
  if (!amount) { res.innerHTML = ''; return; }

  const rateFrom = _kursRates[from] || 1;
  const rateTo   = _kursRates[to] || 1;
  const result   = (amount / rateFrom) * rateTo;

  res.innerHTML = `
    <div style="background:var(--accent-bg);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-lg);padding:18px 20px;text-align:center;">
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">${new Intl.NumberFormat('id-ID').format(amount)} ${from}</div>
      <div style="font-size:28px;font-family:var(--mono);font-weight:500;color:var(--text);margin-bottom:6px;">
        = ${result >= 1 ? new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(result) : result.toFixed(6)} ${to}
      </div>
      <div style="font-size:11px;color:var(--text3);">1 ${from} = ${((1/rateFrom)*rateTo).toFixed(6)} ${to}</div>
    </div>
  `;
}

/* ────────────────────────────────────────────
   BERITA PASAR
   ──────────────────────────────────────────── */
const BERITA_SOURCES = [
  { name: 'Bisnis.com', url: 'https://market.bisnis.com/read/', cat: 'IDX' },
  { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/market/', cat: 'IDX' },
  { name: 'Kontan', url: 'https://investasi.kontan.co.id/', cat: 'IDX' },
  { name: 'Bloomberg', url: 'https://www.bloomberg.com/markets', cat: 'Global' },
  { name: 'Reuters', url: 'https://www.reuters.com/markets/', cat: 'Global' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/', cat: 'Global' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/', cat: 'Crypto' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/', cat: 'Crypto' },
];

const BERITA_DUMMY = [
  { title: 'IHSG Menguat Didukung Aliran Modal Asing', time: '10 menit lalu', cat: 'IDX', src: 'Bisnis.com', url: 'https://market.bisnis.com' },
  { title: 'Bank Sentral Pertahankan Suku Bunga, Saham Perbankan Merespons Positif', time: '35 menit lalu', cat: 'IDX', src: 'CNBC Indonesia', url: 'https://cnbcindonesia.com' },
  { title: 'Sektor Batu Bara Tertekan Penurunan Harga Komoditas Global', time: '1 jam lalu', cat: 'IDX', src: 'Kontan', url: 'https://kontan.co.id' },
  { title: 'Wall Street Ditutup Menguat, Nasdaq Naik 1.2%', time: '3 jam lalu', cat: 'Global', src: 'Bloomberg', url: 'https://bloomberg.com' },
  { title: 'NVIDIA Cetak Rekor Baru setelah Laporan Keuangan Melampaui Ekspektasi', time: '4 jam lalu', cat: 'Global', src: 'Reuters', url: 'https://reuters.com' },
  { title: 'Bitcoin Tembus $70.000 Didorong Sentimen ETF Spot', time: '2 jam lalu', cat: 'Crypto', src: 'CoinDesk', url: 'https://coindesk.com' },
  { title: 'Ethereum Upgrade Berhasil, Harga ETH Naik 8% dalam 24 Jam', time: '5 jam lalu', cat: 'Crypto', src: 'CoinTelegraph', url: 'https://cointelegraph.com' },
];

function renderBeritaPage(container) {
  const cats = ['Semua', 'IDX', 'Global', 'Crypto'];
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-news"></i> Berita Pasar</div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        ${cats.map((c,i) => `<button class="pill ${i===0?'on':''}" onclick="filterBerita('${c}',this)">${c}</button>`).join('')}
      </div>
      <div id="berita-list" style="display:flex;flex-direction:column;gap:8px;">
        ${renderBeritaItems('Semua')}
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ti ti-link"></i> Sumber Berita Terpercaya</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${BERITA_SOURCES.map(s => `
          <a href="${s.url}" target="_blank" rel="noopener" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;text-decoration:none;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text);">${esc(s.name)}</div>
              <div style="font-size:11px;color:var(--text3);">${esc(s.cat)}</div>
            </div>
            <i class="ti ti-external-link" style="color:var(--text3);font-size:15px;"></i>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBeritaItems(cat) {
  const items = cat === 'Semua' ? BERITA_DUMMY : BERITA_DUMMY.filter(x => x.cat === cat);
  if (!items.length) return `<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Tidak ada berita untuk kategori ini</div>`;
  return items.map(item => `
    <a href="${item.url}" target="_blank" rel="noopener" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:flex-start;gap:12px;text-decoration:none;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="font-size:10px;background:${item.cat==='IDX'?'var(--accent-bg)':item.cat==='Crypto'?'var(--amber-bg)':'var(--green-bg)'};color:${item.cat==='IDX'?'var(--accent2)':item.cat==='Crypto'?'var(--amber)':'var(--green)'};padding:2px 8px;border-radius:99px;font-family:var(--mono);font-weight:500;white-space:nowrap;margin-top:2px;">${esc(item.cat)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;color:var(--text);font-weight:500;line-height:1.5;margin-bottom:4px;">${esc(item.title)}</div>
        <div style="font-size:11px;color:var(--text3);">${esc(item.src)} · ${esc(item.time)}</div>
      </div>
      <i class="ti ti-external-link" style="color:var(--text3);font-size:14px;flex-shrink:0;margin-top:2px;"></i>
    </a>
  `).join('');
}

function filterBerita(cat, btn) {
  document.querySelectorAll('#sm-page-overlay .pill').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const list = el('berita-list');
  if (list) list.innerHTML = renderBeritaItems(cat);
}

/* ────────────────────────────────────────────
   TOAST NOTIFICATION
   ──────────────────────────────────────────── */
function showToast(msg, duration = 2500) {
  let toast = document.getElementById('sm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sm-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 18px;font-size:13px;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,.4);z-index:9999;transition:opacity .25s,transform .25s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; }, duration);
}

/* ────────────────────────────────────────────
   SIMPAN BUTTON di hasil analisis
   ──────────────────────────────────────────── */
window._patchResultsSaveBtn = function(ticker, verdict, score, summary, target, stopLoss, market) {
  saveAnalysis({ ticker, verdict, score, summary, target, stopLoss, market });
  addHistory({ ticker, verdict, score, market, name: '' });
};

/* ────────────────────────────────────────────
   PATCH: Intercept render() untuk simpan riwayat
   ──────────────────────────────────────────── */
const _origRender = window.render || function(){};
window.render = function(ticker, ar, final, stock) {
  _origRender(ticker, ar, final, stock);
  // Catat ke riwayat
  addHistory({
    ticker,
    verdict: final?.verdict || '—',
    score: final?.composite_score || 50,
    market: market,
    name: final?.company_name || stock?.name || ''
  });
  // Inject tombol Simpan & Watchlist ke hasil
  setTimeout(() => {
    const results = el('results');
    if (!results) return;
    // Cek sudah ada tombol belum
    if (results.querySelector('.sm-action-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'sm-action-bar';
    bar.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    bar.innerHTML = `
      <button class="pill on" onclick="window._patchResultsSaveBtn('${esc(ticker)}','${esc(final?.verdict||'')}',${final?.composite_score||50},'${esc((final?.final_summary||'').slice(0,120))}','${esc(final?.target_price||'')}','${esc(final?.stop_loss||'')}','${market}')">
        <i class="ti ti-bookmark" style="font-size:12px;"></i> Simpan Analisis
      </button>
      <button class="pill" onclick="addToWatchlist('${esc(ticker)}','${esc(final?.company_name||'')}','${esc(final?.current_price||'')}','${market}')">
        <i class="ti ti-star" style="font-size:12px;"></i> Tambah Watchlist
      </button>
    `;
    results.prepend(bar);
  }, 300);
};

/* ────────────────────────────────────────────
   PATCH SIDEBAR NAV ITEMS
   ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateWatchlistBadge();

  // Inject CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    .sm-action-bar .pill { transition: all .15s; }
  `;
  document.head.appendChild(style);

  // Map nav items to page IDs
  const navItems = document.querySelectorAll('.nav-item');
  const navMap = [
    { text: 'Analisa Saham',   page: 'analisa' },
    { text: 'Watchlist',       page: 'watchlist' },
    { text: 'Riwayat Analisis',page: 'riwayat' },
    { text: 'Disimpan',        page: 'disimpan' },
    { text: 'IDX / BEI',       page: null },
    { text: 'Global Market',   page: null },
    { text: 'Crypto',          page: null },
    { text: 'IPO Upcoming',    page: null },
    { text: 'Kalkulator Lot',  page: 'kalkulator' },
    { text: 'Konversi Kurs',   page: 'konversi' },
    { text: 'Berita Pasar',    page: 'berita' },
  ];

  navItems.forEach(item => {
    const text = item.textContent.trim();
    const map  = navMap.find(m => text.includes(m.text));
    if (!map || map.page === null) return;
    const pageId = map.page;

    // Clone dan replace untuk hapus onclick lama (hanya untuk item yang kita handle)
    const clone = item.cloneNode(true);
    clone.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      clone.classList.add('active');
      showPage(pageId);
    });
    item.parentNode.replaceChild(clone, item);
  });
});
/* ────────────────────────────────────────────
   DB API HELPERS — override localStorage
   ──────────────────────────────────────────── */
function getCurrentUserId() {
  try { return JSON.parse(localStorage.getItem('stockmind_user'))?.id || 0; } catch { return 0; }
}

async function dbGetHistory() {
  const uid = getCurrentUserId();
  if (!uid) return storageGet(SM_HISTORY);
  try {
    const r = await fetch(`auth/analysis.php?type=history&user_id=${uid}`);
    const d = await r.json();
    return d.success ? d.data : storageGet(SM_HISTORY);
  } catch { return storageGet(SM_HISTORY); }
}

async function dbAddHistory(entry) {
  const uid = getCurrentUserId();
  if (!uid) { const h=storageGet(SM_HISTORY); h.unshift({...entry,id:Date.now()}); storageSet(SM_HISTORY,h.slice(0,50)); return; }
  try {
    await fetch(`auth/analysis.php?type=history&user_id=${uid}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry)
    });
  } catch {}
}

async function dbClearHistory() {
  const uid = getCurrentUserId();
  if (!uid) { storageSet(SM_HISTORY,[]); return; }
  try { await fetch(`auth/analysis.php?type=history&user_id=${uid}`, {method:'DELETE'}); } catch {}
}

async function dbGetSaved() {
  const uid = getCurrentUserId();
  if (!uid) return storageGet(SM_SAVED);
  try {
    const r = await fetch(`auth/analysis.php?type=saved&user_id=${uid}`);
    const d = await r.json();
    return d.success ? d.data : storageGet(SM_SAVED);
  } catch { return storageGet(SM_SAVED); }
}

async function dbAddSaved(entry) {
  const uid = getCurrentUserId();
  if (!uid) { const s=storageGet(SM_SAVED); s.unshift({...entry,id:Date.now(),savedAt:new Date().toISOString()}); storageSet(SM_SAVED,s.slice(0,100)); return; }
  try {
    await fetch(`auth/analysis.php?type=saved&user_id=${uid}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry)
    });
  } catch {}
}

async function dbDeleteSaved(id) {
  const uid = getCurrentUserId();
  if (!uid) { storageSet(SM_SAVED, storageGet(SM_SAVED).filter(x=>x.id!=id)); return; }
  try { await fetch(`auth/analysis.php?type=saved&user_id=${uid}&id=${id}`, {method:'DELETE'}); } catch {}
}

/* ────────────────────────────────────────────
/* OVERRIDE: Gunakan DB API jika user login */
const _origAddHistory2 = window.addHistory;
window.addHistory = function(entry) { dbAddHistory(entry); };

window.clearHistory = async function() {
  if (!confirm('Hapus semua riwayat analisis?')) return;
  await dbClearHistory();
  showPage('riwayat');
};

window.renderRiwayatPage = async function(container) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Memuat riwayat...</div>';
  const list = await dbGetHistory();
  const rows = list.map(item => {
    const color = item.verdict==='BELI'?'var(--green)':item.verdict==='JUAL'?'var(--red)':'var(--amber)';
    const bg = item.verdict==='BELI'?'var(--green-bg)':item.verdict==='JUAL'?'var(--red-bg)':'var(--amber-bg)';
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;"><div style="background:'+bg+';border-radius:8px;padding:6px 10px;color:'+color+';font-size:11px;font-weight:600;min-width:48px;text-align:center;">'+esc(item.verdict||'')+'</div><div><div style="font-size:13px;font-weight:500;">'+esc(item.ticker)+' <span style="font-size:11px;color:var(--text3);">'+esc(item.name||'')+'</span></div><div style="font-size:11px;color:var(--text3);">'+fmtDateTime(item.at||item.created_at)+' - Skor '+( item.score||'-')+' - '+(item.market||'idx').toUpperCase()+'</div></div></div><button class="pill" onclick="replayAnalysis(\''+esc(item.ticker)+'\',\''+esc(item.market||'idx')+'\')"><i class="ti ti-refresh" style="font-size:12px;"></i> Ulang</button></div>';
  }).join('');
  const clearBtn = list.length > 0 ? '<button class="pill" style="color:var(--red);" onclick="clearHistory()"><i class="ti ti-trash" style="font-size:12px;"></i> Hapus Semua</button>' : '';
  const empty = '<div style="text-align:center;padding:40px;color:var(--text3);"><i class="ti ti-history" style="font-size:40px;display:block;margin-bottom:12px;"></i><div>Belum ada riwayat analisis</div></div>';
  container.innerHTML = '<div class="card"><div class="card-header"><div class="card-title"><i class="ti ti-history"></i> Riwayat Analisis</div>'+clearBtn+'</div>'+(list.length===0?empty:'<div style="display:flex;flex-direction:column;gap:8px;">'+rows+'</div>')+'</div>';
};

window.saveAnalysis = function(entry) { dbAddSaved(entry).then(()=>showToast('Analisis berhasil disimpan')); };
window.deleteSaved = function(id) { dbDeleteSaved(id).then(()=>{ if(_currentPage==='disimpan') showPage('disimpan'); }); };

window.renderDisimpanPage = async function(container) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Memuat data tersimpan...</div>';
  const list = await dbGetSaved();
  const rows = list.map(item => {
    const color = item.verdict==='BELI'?'var(--green)':item.verdict==='JUAL'?'var(--red)':'var(--amber)';
    const bg = item.verdict==='BELI'?'var(--green-bg)':item.verdict==='JUAL'?'var(--red-bg)':'var(--amber-bg)';
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;"><div style="background:'+bg+';border-radius:8px;padding:6px 10px;color:'+color+';font-size:11px;font-weight:600;min-width:48px;text-align:center;">'+esc(item.verdict||'')+'</div><div><div style="font-size:13px;font-weight:500;">'+esc(item.ticker)+' <span style="font-size:11px;color:var(--text3);">'+esc(item.name||'')+'</span></div><div style="font-size:11px;color:var(--text3);">Disimpan '+fmtDateTime(item.saved_at||item.savedAt)+' - Skor '+(item.score||'-')+' - Target '+esc(item.target||'N/A')+' - Stop Loss '+esc(item.stop_loss||item.stopLoss||'N/A')+'</div></div></div><button class="pill" style="color:var(--red);" onclick="deleteSaved('+item.id+')"><i class="ti ti-trash" style="font-size:12px;"></i></button></div>';
  }).join('');
  const empty = '<div style="text-align:center;padding:40px;color:var(--text3);"><i class="ti ti-bookmark" style="font-size:40px;display:block;margin-bottom:12px;"></i><div>Belum ada analisis tersimpan</div></div>';
  container.innerHTML = '<div class="card"><div class="card-header"><div class="card-title"><i class="ti ti-bookmark"></i> Analisis Disimpan</div></div>'+(list.length===0?empty:'<div style="display:flex;flex-direction:column;gap:8px;">'+rows+'</div>')+'</div>';
};

/* =================================================================
   LOGIKA EKSEKUSI PREDIKSI CRYPTO (KONTAINER TERPISAH)
   ================================================================= */
async function runCryptoContainerPrediction() {
    const tickerInput = document.getElementById('cryptoBoxTicker');
    const modelSelect = document.getElementById('cryptoBoxModel');
    const resultBox = document.getElementById('cryptoBoxResultDisplay');
    const btn = document.getElementById('btnExecuteCryptoBox');

    let ticker = tickerInput.value.trim().toUpperCase();
    const model = modelSelect.value;

    if (!ticker) {
        alert("Mohon masukkan simbol koin kripto terlebih dahulu.");
        return;
    }

    // Koreksi otomatis jika user lupa menuliskan -USD
    if (!ticker.includes('-')) {
        ticker = `${ticker}-USD`;
        tickerInput.value = ticker;
    }

    // Set UI Loading
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--green);">
            <i class="ti ti-loader" style="animation: spin 1s linear infinite; font-size: 24px; display: inline-block; margin-bottom: 8px;"></i>
            <div>Memproses data historis & kalkulasi indikator model ${model.toUpperCase()} v3...</div>
        </div>
    `;
    btn.disabled = true;
    btn.style.opacity = '0.6';

    try {
        const response = await fetch('/api/predict_crypto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: ticker, model: model })
        });

        const data = await response.json();

        if (data.error) {
            resultBox.innerHTML = `
                <div style="color: var(--red); padding: 5px;">
                    <i class="ti ti-alert-triangle"></i> <b>Gagal:</b> ${esc(data.error)}
                </div>
            `;
        } else {
            const isBullish = data.class === 1;
            const trendColor = isBullish ? 'var(--green)' : 'var(--red)';
            const bgLight = isBullish ? 'rgba(98, 196, 130, 0.1)' : 'rgba(224, 106, 106, 0.1)';
            const icon = isBullish ? 'ti-trending-up' : 'ti-trending-down';
            const confPercent = (data.confidence * 100).toFixed(2);

            resultBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: #fff; font-family: var(--mono);">${esc(data.ticker)}</div>
                        <div style="font-size: 11px; color: var(--muted);">Model: ${esc(data.model)}</div>
                    </div>
                    <div style="background: ${bgLight}; border: 1px solid ${trendColor}; color: ${trendColor}; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                        <i class="ti ${icon}"></i> ${esc(data.trend)}
                    </div>
                </div>
                
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                        <span style="color: var(--muted);">Tingkat Keyakinan (Confidence)</span>
                        <span style="color: #fff; font-weight: bold;">${confPercent}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden;">
                        <div style="width: ${confPercent}%; height: 100%; background: ${trendColor};"></div>
                    </div>
                    <div style="font-size: 11px; color: var(--dim); margin-top: 10px;">
                        * Batas validasi keputusan (Threshold): ${data.threshold_used * 100}%
                    </div>
                </div>
            `;
        }
    } catch (error) {
        resultBox.innerHTML = `<div style="color: var(--red);"><b>Gagal terhubung ke server:</b> ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}