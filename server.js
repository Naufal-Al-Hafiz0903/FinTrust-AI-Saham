import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";

/*
  FinTrust AI Saham server
  - Realtime/near-realtime market data from Yahoo Finance.
  - Python prediction scripts are executed with local .venv automatically when available.
  - Stock lookup is defensive: invalid/unavailable tickers return a clear JSON error instead of crashing.
*/

dotenv.config();

const app = express();
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function getGroqKey() {
  const key = String(process.env.GROQ_API_KEY || "").trim();
  const invalid = ["isi_api_key_groq", "your_groq_api_key", "ganti_dengan_api_key_groq"];
  if (!key || invalid.includes(key.toLowerCase()) || key.includes("isi_api_key")) return "";
  return key;
}

const groqApiKey = getGroqKey();
const client = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const CACHE_TTL_MS = 60_000;
const cache = new Map();

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanTicker(ticker = "") {
  return String(ticker).trim().toUpperCase().replace(/\s+/g, "");
}

function sanitizeTicker(ticker = "") {
  return cleanTicker(ticker).replace(/[^A-Z0-9.\-^=]/g, "");
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function resolveSymbol(ticker = "", market = "auto") {
  const raw = sanitizeTicker(ticker);
  if (!raw) throw new Error("Ticker kosong");

  if (market === "idx") return `${raw.replace(/\.JK$/i, "")}.JK`;
  if (market === "ipo") return raw.replace(/\.JK$/i, "");
  if (market === "crypto") return raw.includes("-") ? raw : `${raw}-USD`;
  if (market === "global") return raw.replace(/\.JK$/i, "");

  // Auto mode: keep the user symbol. Python prediction layer and Node quote lookup
  // will try sensible fallbacks such as .JK when the first symbol is unavailable.
  return raw;
}

function stockCandidates(ticker = "", market = "auto") {
  const raw = sanitizeTicker(ticker);
  if (!raw) throw new Error("Ticker kosong");
  const noJk = raw.replace(/\.JK$/i, "");

  if (market === "idx") return unique([`${noJk}.JK`, noJk]);
  if (market === "global") return unique([noJk, `${noJk}.JK`]);
  if (market === "crypto") return unique([raw.includes("-") ? raw : `${raw}-USD`, raw]);
  if (market === "ipo") return unique([noJk]);

  const hasMarketMarker = /[.\-^=]/.test(raw);
  return unique(hasMarketMarker ? [raw] : [raw, `${raw}.JK`]);
}

function inferMarketFromSymbol(symbol = "", requestedMarket = "auto") {
  if (requestedMarket === "global") return "global";
  if (requestedMarket === "ipo") return "ipo";
  if (requestedMarket === "crypto") return "crypto";
  if (symbol.includes("-USD") || symbol.includes("-")) return "crypto";
  return symbol.endsWith(".JK") ? "idx" : "global";
}

function formatMoney(value, currency = "IDR") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "N/A";
  const code = String(currency || "IDR").toUpperCase();
  const locale = code === "IDR" ? "id-ID" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "IDR" ? 0 : 2,
  }).format(n);
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { timestamp: Date.now(), data });
  return data;
}

async function readQuote(symbol) {
  let q;
  try {
    q = await yf.quote(symbol);
  } catch (err) {
    throw new Error(`Yahoo Finance gagal membaca ${symbol}: ${err?.message || err}`);
  }

  if (!q || typeof q !== "object") {
    throw new Error(`Yahoo Finance tidak mengembalikan data untuk ${symbol}`);
  }

  const price = safeNumber(
    q.regularMarketPrice ??
    q.postMarketPrice ??
    q.preMarketPrice ??
    q.regularMarketPreviousClose ??
    q.previousClose
  );

  if (!price || price <= 0) {
    throw new Error(`Harga ${symbol} tidak tersedia dari Yahoo Finance`);
  }

  return { q, price };
}

async function getUsdIdrRate() {
  return cached("fx:USDIDR", async () => {
    const symbols = ["IDR=X", "USDIDR=X"];
    const errors = [];

    for (const symbol of symbols) {
      try {
        const { q, price } = await readQuote(symbol);
        return {
          USDIDR: price,
          rate: price,
          pair: "USD/IDR",
          symbol,
          formatted: formatMoney(price, "IDR"),
          source: "Yahoo Finance",
          fetchedAt: new Date().toISOString(),
          rawPreviousClose: q.regularMarketPreviousClose ?? q.previousClose ?? null,
        };
      } catch (err) {
        errors.push(err.message);
      }
    }

    throw new Error(`Kurs USD/IDR realtime tidak tersedia. ${errors.join(" | ")}`);
  });
}

async function getStockData(ticker, market = "auto") {
  const candidates = stockCandidates(ticker, market);
  const key = `stock:${market}:${candidates.join(",")}`;

  return cached(key, async () => {
    const errors = [];

    for (const symbol of candidates) {
      try {
        const { q, price } = await readQuote(symbol);
        const currency = q.currency || (symbol.endsWith(".JK") ? "IDR" : "USD");
        const resolvedMarket = inferMarketFromSymbol(symbol, market);

        return {
          ticker: symbol.replace(".JK", ""),
          symbol,
          market: resolvedMarket,
          name: q.longName || q.shortName || q.displayName || symbol,
          price,
          formattedPrice: formatMoney(price, currency),
          previousClose: q.regularMarketPreviousClose ?? q.previousClose ?? null,
          open: q.regularMarketOpen ?? null,
          high: q.regularMarketDayHigh ?? null,
          low: q.regularMarketDayLow ?? null,
          volume: q.regularMarketVolume ?? null,
          marketCap: q.marketCap ?? null,
          change: q.regularMarketChange ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
          currency,
          exchange: q.fullExchangeName || q.exchange || (resolvedMarket === "idx" ? "IDX" : (resolvedMarket === "crypto" ? "Crypto Market" : "Global")),
          source: "Yahoo Finance",
          fetchedAt: new Date().toISOString(),
          realtimeNote: "Harga diambil saat request dari Yahoo Finance; bisa delay mengikuti aturan bursa.",
        };
      } catch (err) {
        errors.push(`${symbol}: ${err.message}`);
      }
    }

    throw new Error(`Data harga untuk ${ticker} tidak tersedia. Dicoba: ${candidates.join(", ")}. Detail: ${errors.join(" | ")}`);
  });
}

function safeGroqError(err) {
  const msg = String(err?.message || "Groq API gagal");
  if (err?.status === 401 || msg.toLowerCase().includes("invalid api key")) {
    return { status: 401, message: "GROQ_API_KEY tidak valid. Perbarui file .env lalu restart npm start." };
  }
  return { status: 500, message: msg };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "stockmind_ui.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    provider: "Groq",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    groqReady: Boolean(client),
    keyStatus: client ? "valid format" : "belum diisi",
    marketData: "Yahoo Finance",
    python: pythonCommand(),
  });
});

app.get("/api/diagnostics", (req, res) => {
  const py = pythonCommand();
  const code = "import sys, json; mods=['numpy','pandas','yfinance','onnxruntime']; out={'python':sys.executable,'ok':True,'missing':[]};\nfor m in mods:\n    try: __import__(m)\n    except Exception as e: out['missing'].append(m); out['ok']=False\nprint(json.dumps(out))";
  execFile(py, ["-c", code], { cwd: __dirname, timeout: 30_000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ ok: false, python: py, error: stderr || error.message, install: "Jalankan setup_windows.bat atau py -3 -m pip install -r requirements.txt" });
    }
    try {
      res.json(JSON.parse(String(stdout || "{}")));
    } catch (e) {
      res.status(500).json({ ok: false, python: py, error: "Output diagnostics tidak valid", stdout, stderr });
    }
  });
});

app.get("/api/fx/usdidr", async (req, res) => {
  try {
    const fx = await getUsdIdrRate();
    res.json(fx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stock/:ticker", async (req, res) => {
  try {
    const market = req.query.market || "auto";
    const stock = await getStockData(req.params.ticker, market);
    const fx = await getUsdIdrRate().catch(() => null);
    res.json({ stock, fx });
  } catch (err) {
    console.error("Market data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/stocks", async (req, res) => {
  try {
    const market = req.body.market || "auto";
    const tickers = Array.isArray(req.body.tickers) ? req.body.tickers : [];
    const clean = [...new Set(tickers.map(cleanTicker).filter(Boolean))].slice(0, 120);
    if (!clean.length) throw new Error("Ticker pembanding belum diisi");

    const results = await Promise.allSettled(clean.map(t => getStockData(t, market)));
    const stocks = [];
    const errors = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") stocks.push(r.value);
      else errors.push({ ticker: clean[i], error: r.reason?.message || "Data tidak tersedia" });
    });

    const fx = await getUsdIdrRate().catch(() => null);
    res.json({ stocks, errors, fx });
  } catch (err) {
    console.error("Batch market data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    if (!client) {
      res.status(503).json({ error: "GROQ_API_KEY belum diisi atau masih placeholder. Isi .env lalu restart npm start." });
      return;
    }

    const { system, prompt, ticker, mode, market, nominal, nominalCurrency } = req.body;
    if (!system || !prompt) throw new Error("Payload wajib berisi system dan prompt");

    let stock = null;
    let fx = null;
    const activeMarket = market || mode || "auto";

    if (ticker && activeMarket !== "ipo") {
      try {
        stock = await getStockData(ticker, activeMarket);
        fx = await getUsdIdrRate().catch(() => null);
      } catch (e) {
        console.warn("Yahoo Finance gagal:", e.message);
      }
    }

    const enrichedPrompt = `
DATA SAHAM REAL:
${stock ? JSON.stringify(stock, null, 2) : "Tidak tersedia"}

DATA INVESTASI USER:
Nominal: ${nominal || "Tidak diisi"}
Mata uang nominal: ${nominalCurrency || "IDR"}
Kurs USD/IDR realtime: ${fx?.rate || fx?.USDIDR || "Tidak tersedia"}

ATURAN:
- Jangan menebak harga saham.
- Gunakan DATA SAHAM REAL jika tersedia.
- Jika harga tidak tersedia, tulis N/A.
- Untuk saham luar negeri, gunakan mata uang asli saham.
- Output wajib JSON valid saja, tanpa markdown.

PROMPT:
${prompt}
`;

    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: enrichedPrompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq tidak mengembalikan content");
    res.json({ content, stock, fx });
  } catch (err) {
    const safe = safeGroqError(err);
    console.error("Groq analyze error:", safe.message);
    res.status(safe.status).json({ error: safe.message });
  }
});

function pythonCommand() {
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) return process.env.PYTHON;

  const venvPython = process.platform === "win32"
    ? path.join(__dirname, ".venv", "Scripts", "python.exe")
    : path.join(__dirname, ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;

  return process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function dependencyHint(stderr = "") {
  const text = String(stderr || "");
  if (text.includes("ModuleNotFoundError") || text.includes("No module named")) {
    return " Dependency Python belum terinstall. Stop server dengan Ctrl+C, jalankan setup_windows.bat, lalu start_windows.bat.";
  }
  return "";
}

function runPythonPrediction(script, args = [], label = "PYTHON", res) {
  const scriptPath = path.join(__dirname, script);
  execFile(
    pythonCommand(),
    [scriptPath, ...args.map(String)],
    { cwd: __dirname, timeout: 120_000, maxBuffer: 1024 * 1024 * 8 },
    (error, stdout, stderr) => {
      if (error) {
        const msg = String(stderr || error.message || "").trim();
        console.error(`[${label}] Error:`, msg);
        return res.status(500).json({
          error: `Gagal menjalankan prediksi ${label}.${dependencyHint(msg)} ${msg}`.trim(),
          python: pythonCommand(),
        });
      }
      try {
        const text = String(stdout || "").trim();
        const jsonStart = text.indexOf("{");
        const cleanText = jsonStart >= 0 ? text.slice(jsonStart) : text;
        const result = JSON.parse(cleanText);
        const status = result?.error ? 500 : 200;
        res.status(status).json(result);
      } catch (e) {
        console.error(`[${label}] Parse Error:`, e, stdout, stderr);
        res.status(500).json({ error: `Gagal memproses hasil prediksi ${label}.`, stdout, stderr });
      }
    }
  );
}

// PROPHET / PRICE FORECAST 1-5 HARI TRADING
app.get("/api/predict/:ticker", (req, res) => {
  try {
    const market = req.query.market || "auto";
    const ticker = resolveSymbol(req.params.ticker, market);
    const days = Math.min(Math.max(Number(req.query.days || 5), 1), 10);
    runPythonPrediction("predict.py", [ticker, days], "PROPHET", res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// MULTI-MODEL PREDICTIONS (XGBoost, Random Forest, Hybrid Ensemble)
app.get("/api/predict/:model/:ticker", (req, res) => {
  try {
    const { model, ticker: rawTicker } = req.params;
    const market = req.query.market || "auto";
    const ticker = resolveSymbol(rawTicker, market);

    const scripts = {
      "xgboost": "predict_xgb.py",
      "randomforest": "predict_rf.py",
      "rf": "predict_rf.py",
      "ensemble": "predict_ensemble.py",
      "hybrid": "predict_ensemble.py"
    };

    const targetScript = scripts[String(model).toLowerCase()];
    if (!targetScript) {
      return res.status(400).json({ error: `Model '${model}' belum didukung.` });
    }

    runPythonPrediction(targetScript, [ticker], model.toUpperCase(), res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`);
  console.log(`AI provider: Groq`);
  console.log(`Model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"}`);
  console.log(`Groq key: ${client ? "loaded" : "not configured"}`);
  console.log(`Python: ${pythonCommand()}`);
});
