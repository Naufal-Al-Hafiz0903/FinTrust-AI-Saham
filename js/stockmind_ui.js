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
  ['idx','global','ipo','crypto'].forEach(x => {const btn = el(`mode-${x}`); if(btn) btn.classList.toggle('on', x === m);});
  el('currencyIn').value = (m === 'global' || m === 'crypto') ? 'USD' : 'IDR';
  if (m === 'crypto') {
    el('tickerIn').placeholder = 'BTC-USD, ETH-USD atau SOL-USD';
  } else if (m === 'global') {
    el('tickerIn').placeholder = 'AAPL, NVDA atau AAPL, MSFT, GOOGL';
  } else {
    el('tickerIn').placeholder = 'BBCA, ADRO atau BBCA, BBRI, BMRI';
  }
  renderSector(); renderQuick(); hideErr();
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
    el('fxTag').textContent = `Groq AI · Yahoo Finance · USD/IDR ${fmtNum(fxRate(), 2)}`;
    return lastFx;
  } catch(e) {
    el('fxTag').textContent = 'Groq AI · Yahoo Finance · Kurs belum tersedia';
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
// PROPHET, XGBOOST, RANDOM FOREST, REALTIME HYBRID
let predictionData = { prophet: null, xgboost: null, randomforest: null, ensemble: null };

window.renderPredictionView = function(model, ticker) {
  const card = document.getElementById('predictionCard');
  if (!card) return;

  const data = predictionData[model];

  if (!data) {
    card.innerHTML = TemplateUI.predictionLoading(model);
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
      const slicedForecast = forecast.slice(0, 5);
      card.innerHTML = TemplateUI.prophetView(slicedForecast, ticker, esc, fmtNum, data);
    }
  } else if (model === 'ensemble') {
    card.innerHTML = TemplateUI.ensembleView(data, ticker, esc, fmtNum);
  }

  ['btn-prophet', 'btn-xgboost', 'btn-randomforest', 'btn-ensemble'].forEach(id => {
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

    //Data cache
    predictionData = { prophet: null, xgboost: null, randomforest: null, ensemble: null };

    const stamp = Date.now();
    const [pRes, xRes, rfRes, eRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/predict/${encodeURIComponent(ticker)}?market=${market}&days=5&_=${stamp}`).then(r => r.json()),
      fetch(`${API_BASE}/api/predict/xgboost/${encodeURIComponent(ticker)}?market=${market}&_=${stamp}`).then(r => r.json()),
      fetch(`${API_BASE}/api/predict/randomforest/${encodeURIComponent(ticker)}?market=${market}&_=${stamp}`).then(r => r.json()),
      fetch(`${API_BASE}/api/predict/ensemble/${encodeURIComponent(ticker)}?market=${market}&_=${stamp}`).then(r => r.json())
    ]);

    predictionData.prophet = pRes.status === 'fulfilled' ? pRes.value : { error: "Gagal mengambil data dari Prophet." };
    predictionData.xgboost = xRes.status === 'fulfilled' ? xRes.value : { error: "Gagal mengambil data dari XGBoost." };
    predictionData.randomforest = rfRes.status === 'fulfilled' ? rfRes.value : { error: "Gagal mengambil data dari Random Forest." };
    predictionData.ensemble = eRes.status === 'fulfilled' ? eRes.value : { error: "Gagal mengambil data dari Realtime Hybrid." };

    window.renderPredictionView('ensemble', ticker);

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
refreshFx();