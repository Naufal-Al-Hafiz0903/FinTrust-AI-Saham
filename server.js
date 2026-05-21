import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

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

function resolveSymbol(ticker = "", market = "idx") {
  const raw = cleanTicker(ticker).replace(/[^A-Z0-9.\-^=]/g, "");
  if (!raw) throw new Error("Ticker kosong");
  if (market === "idx") return `${raw.replace(".JK", "")}.JK`;
  if (market === "ipo") return raw.replace(".JK", "");
  if (market === "crypto") {
    return raw.includes("-") ? raw : `${raw}-USD`;
  }
  return raw.replace(".JK", "");
}

function inferMarketFromSymbol(symbol = "", requestedMarket = "idx") {
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

async function getUsdIdrRate() {
  return cached("fx:USDIDR", async () => {
    const symbols = ["IDR=X", "USDIDR=X"];
    let lastError = null;

    for (const symbol of symbols) {
      try {
        const q = await yf.quote(symbol);
        const rate = safeNumber(q.regularMarketPrice ?? q.regularMarketPreviousClose);
        if (rate && rate > 0) {
          return {
            USDIDR: rate,
            rate,
            pair: "USD/IDR",
            symbol,
            formatted: formatMoney(rate, "IDR"),
            source: "Yahoo Finance",
            fetchedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(lastError?.message || "Kurs USD/IDR realtime tidak tersedia");
  });
}

async function getStockData(ticker, market = "idx") {
  const symbol = resolveSymbol(ticker, market);
  const key = `stock:${market}:${symbol}`;

  return cached(key, async () => {
    const q = await yf.quote(symbol);
    const price = safeNumber(q.regularMarketPrice ?? q.regularMarketPreviousClose);
    if (!price || price <= 0) throw new Error(`Harga ${symbol} tidak tersedia`);

    const currency = q.currency || (symbol.endsWith(".JK") ? "IDR" : "USD");
    const resolvedMarket = inferMarketFromSymbol(symbol, market);

    return {
      ticker: symbol.replace(".JK", ""),
      symbol,
      market: resolvedMarket,
      name: q.longName || q.shortName || symbol,
      price,
      formattedPrice: formatMoney(price, currency),
      previousClose: q.regularMarketPreviousClose ?? null,
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
      source: "Yahoo Finance"
    };
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
    const market = req.query.market || "idx";
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
    const market = req.body.market || "idx";
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
    const activeMarket = market || mode || "idx";

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

//PROPHET
app.get("/api/predict/:ticker", (req, res) => {
  const market = req.query.market || "idx";
  const ticker = resolveSymbol(req.params.ticker, market);
  
  exec(`python predict.py ${ticker}`, (error, stdout, stderr) => {
    if (error) {
      console.error("Prophet Error:", stderr);
      return res.status(500).json({ error: "Gagal menjalankan prediksi AI." });
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      console.error("Prophet Parse Error:", e, stdout);
      res.status(500).json({ error: "Gagal memproses hasil prediksi Prophet." });
    }
  });
});
// MULTI-MODEL PREDICTIONS (XGBoost, Random Forest, dll)
app.get("/api/predict/:model/:ticker", (req, res) => {
  const { model, ticker: rawTicker } = req.params;
  const market = req.query.market || "idx";
  const ticker = resolveSymbol(rawTicker, market);
  
  const scripts = {
    "xgboost": "predict_xgb.py",
    "randomforest": "predict_rf.py"
  };

  const targetScript = scripts[model.toLowerCase()];

  if (!targetScript) {
    return res.status(400).json({ error: `Model '${model}' belum didukung.` });
  }

  exec(`python ${targetScript} ${ticker}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${model.toUpperCase()}] Error:`, stderr);
      return res.status(500).json({ error: `Gagal menjalankan prediksi model ${model}.` });
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      console.error(`[${model.toUpperCase()}] Parse Error:`, e, stdout);
      res.status(500).json({ error: `Gagal memproses hasil prediksi dari model ${model}.` });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`);
  console.log(`AI provider: Groq`);
  console.log(`Model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"}`);
  console.log(`Groq key: ${client ? "loaded" : "not configured"}`);
});
