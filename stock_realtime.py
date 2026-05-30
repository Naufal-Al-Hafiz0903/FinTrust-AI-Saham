"""Reusable realtime market-data and prediction helpers for FinTrust AI Saham.

The ONNX files in this project are fixed trained models. This helper improves the
live prediction layer by always fetching fresh Yahoo Finance data, using robust
feature engineering, anchoring forecast prices to the latest available market
price, and returning transparent metadata for the UI.
"""

from __future__ import annotations

import math
import re
import sys
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

FEATURES: List[str] = [
    "Ret_Close",
    "Ret_Open",
    "Ret_High",
    "Volatility_5",
    "Momentum_5",
    "Vol_Change",
    "RSI_14",
    "MACD_12_26_9",
    "SMA20_Dist",
    "EMA50_Dist",
    "Ret_Close_Lag1",
    "RSI_Lag1",
]

BASE_FEATURES_SHIFTED: List[str] = [
    "Ret_Close",
    "Ret_Open",
    "Ret_High",
    "Volatility_5",
    "Momentum_5",
    "Vol_Change",
    "RSI_14",
    "MACD_12_26_9",
    "SMA20_Dist",
    "EMA50_Dist",
]

MODEL_PROFILES: Dict[str, Dict[str, Any]] = {
    "xgboost": {
        "accuracy": 65.65,
        "precision": 36.84,
        "sim_profit": -1.38,
        "f1_score": 0.1505,
        "profile_note": "Metrik berasal dari backtest model bawaan project. Sinyal bullish XGBoost harus dianggap agresif karena precision rendah.",
    },
    "randomforest": {
        "accuracy": 68.70,
        "precision": 66.67,
        "sim_profit": 2.16,
        "f1_score": 0.0526,
        "profile_note": "Metrik berasal dari backtest model bawaan project. Random Forest lebih konservatif dan cenderung lebih aman untuk filter risiko.",
    },
}


def clean_symbol(symbol: str) -> str:
    """Normalize a ticker without forcing a market suffix."""
    raw = str(symbol or "").strip().upper().replace(" ", "")
    raw = re.sub(r"[^A-Z0-9.\-^=]", "", raw)
    if not raw:
        raise ValueError("Ticker kosong")
    return raw


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = df.columns.get_level_values(0)
    return df


def symbol_candidates(symbol: str) -> List[str]:
    """Try the requested symbol first, then safe fallbacks.

    This helps the app work with arbitrary codes, not only the sample tickers.
    For Indonesian bare tickers such as BBCA it tries BBCA.JK as fallback. For
    global/crypto symbols that already use ., -, ^, or = it does not force .JK.
    """
    raw = clean_symbol(symbol)
    candidates = [raw]
    has_market_marker = any(ch in raw for ch in [".", "-", "^", "="])
    if not has_market_marker and not raw.endswith(".JK"):
        candidates.append(f"{raw}.JK")
    return list(dict.fromkeys(candidates))


def download_history(symbol: str, period: str = "3y", min_rows: int = 90) -> Tuple[str, pd.DataFrame]:
    try:
        import yfinance as yf
    except Exception as exc:
        raise RuntimeError("Library yfinance belum terinstall. Jalankan: pip install -r requirements.txt") from exc

    last_error: Exception | None = None
    for candidate in symbol_candidates(symbol):
        try:
            df = yf.download(candidate, period=period, progress=False, auto_adjust=False, threads=False)
            df = _flatten_columns(df)
            if not df.empty and len(df.dropna(how="all")) >= min_rows:
                return candidate, df.dropna(how="all").copy()
        except Exception as exc:  # pragma: no cover - network dependent
            last_error = exc

    # Retry with shorter period for newly listed stocks.
    for candidate in symbol_candidates(symbol):
        try:
            df = yf.download(candidate, period="1y", progress=False, auto_adjust=False, threads=False)
            df = _flatten_columns(df)
            if not df.empty and len(df.dropna(how="all")) >= 45:
                return candidate, df.dropna(how="all").copy()
        except Exception as exc:  # pragma: no cover - network dependent
            last_error = exc

    if last_error:
        raise RuntimeError(f"Data historis untuk {symbol} tidak tersedia: {last_error}")
    raise RuntimeError(f"Data historis untuk {symbol} tidak tersedia")


def _safe_float(value: Any, default: float | None = None) -> float | None:
    try:
        n = float(value)
        if math.isfinite(n):
            return n
    except Exception:
        pass
    return default


def infer_currency(symbol: str) -> str:
    if symbol.endswith(".JK"):
        return "IDR"
    if symbol.endswith("-USD") or "-USD" in symbol:
        return "USD"
    return "USD"


def get_quote_snapshot(symbol: str, history: pd.DataFrame | None = None) -> Dict[str, Any]:
    try:
        import yfinance as yf
    except Exception as exc:
        raise RuntimeError("Library yfinance belum terinstall. Jalankan: pip install -r requirements.txt") from exc

    """Get current/near-real-time price metadata from Yahoo Finance.

    Yahoo data can be delayed depending on exchange rules, but this function is
    fetched on every prediction request and does not use the Node cache.
    """
    price = None
    previous_close = None
    open_price = None
    day_high = None
    day_low = None
    volume = None
    currency = infer_currency(symbol)
    exchange = "IDX" if symbol.endswith(".JK") else ("Crypto" if "-" in symbol else "Global")
    long_name = symbol

    try:
        ticker = yf.Ticker(symbol)
        fast = getattr(ticker, "fast_info", None)
        if fast:
            def fget(key, default=None):
                try:
                    if hasattr(fast, "get"):
                        return fast.get(key, default)
                except Exception:
                    pass
                try:
                    return getattr(fast, key, default)
                except Exception:
                    return default

            price = _safe_float(fget("last_price"))
            previous_close = _safe_float(fget("previous_close"))
            open_price = _safe_float(fget("open"))
            day_high = _safe_float(fget("day_high"))
            day_low = _safe_float(fget("day_low"))
            volume = _safe_float(fget("last_volume"))
            currency = str(fget("currency", currency) or currency)
            exchange = str(fget("exchange", exchange) or exchange)
        try:
            info = ticker.get_info()
            long_name = info.get("longName") or info.get("shortName") or long_name
            currency = info.get("currency") or currency
            exchange = info.get("fullExchangeName") or info.get("exchange") or exchange
        except Exception:
            pass
    except Exception:
        pass

    if history is not None and not history.empty:
        last_row = history.iloc[-1]
        price = price or _safe_float(last_row.get("Close"))
        previous_close = previous_close or _safe_float(history["Close"].iloc[-2] if len(history) > 1 else last_row.get("Close"))
        open_price = open_price or _safe_float(last_row.get("Open"))
        day_high = day_high or _safe_float(last_row.get("High"))
        day_low = day_low or _safe_float(last_row.get("Low"))
        volume = volume or _safe_float(last_row.get("Volume"))

    if not price or price <= 0:
        raise RuntimeError(f"Harga realtime/terbaru untuk {symbol} tidak tersedia")

    change = None if previous_close in (None, 0) else price - previous_close
    change_percent = None if previous_close in (None, 0) else (change / previous_close) * 100
    return {
        "symbol": symbol,
        "name": long_name,
        "price": price,
        "previous_close": previous_close,
        "open": open_price,
        "high": day_high,
        "low": day_low,
        "volume": volume,
        "change": change,
        "change_percent": change_percent,
        "currency": currency,
        "exchange": exchange,
        "source": "Yahoo Finance",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "note": "Harga diambil saat request dari Yahoo Finance; dapat delay mengikuti aturan bursa.",
    }


def add_technical_features(df: pd.DataFrame) -> pd.DataFrame:
    df = _flatten_columns(df).copy()
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise RuntimeError(f"Kolom OHLCV tidak lengkap: {', '.join(missing)}")

    for c in required:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["Ret_Close"] = df["Close"].pct_change()
    df["Ret_Open"] = df["Open"].pct_change()
    df["Ret_High"] = df["High"].pct_change()
    df["Volatility_5"] = df["Ret_Close"].rolling(5).std()
    df["Momentum_5"] = df["Close"] / df["Close"].shift(5) - 1
    df["Vol_Change"] = df["Volume"].replace(0, np.nan).pct_change()

    delta = df["Close"].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["RSI_14"] = 100 - (100 / (1 + rs))

    ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["MACD_12_26_9"] = ema_12 - ema_26

    sma_20 = df["Close"].rolling(20).mean()
    ema_50 = df["Close"].ewm(span=50, adjust=False).mean()
    df["SMA20_Dist"] = (df["Close"] - sma_20) / sma_20.replace(0, np.nan)
    df["EMA50_Dist"] = (df["Close"] - ema_50) / ema_50.replace(0, np.nan)

    df["Ret_Close_Lag1"] = df["Ret_Close"].shift(1)
    df["RSI_Lag1"] = df["RSI_14"].shift(1)

    # The existing ONNX models were trained with these shifted base features.
    # Keep the contract to avoid feature mismatch while still using fresh data.
    for col in BASE_FEATURES_SHIFTED:
        df[col] = df[col].shift(1)

    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=FEATURES)
    if df.empty:
        raise RuntimeError("Data tidak cukup setelah kalkulasi indikator teknikal")
    return df


def latest_feature_matrix(df: pd.DataFrame) -> Tuple[np.ndarray, Dict[str, float]]:
    feature_df = add_technical_features(df)
    latest = feature_df.iloc[-1:][FEATURES].astype(np.float32)
    snapshot = {k: _safe_float(latest.iloc[0][k], 0.0) for k in FEATURES}
    return latest.values, snapshot


def extract_probability(probability_output: Any, predicted_class: int) -> Tuple[float, Dict[str, float]]:
    """Normalize ONNX probability outputs from dict/list/array variants."""
    probabilities: Dict[str, float] = {}
    raw = probability_output

    if isinstance(raw, (list, tuple)) and len(raw) == 1:
        raw = raw[0]

    if isinstance(raw, dict):
        for k, v in raw.items():
            probabilities[str(int(float(k)))] = float(v)
    elif isinstance(raw, np.ndarray):
        arr = raw.tolist()
        if arr and isinstance(arr[0], (list, tuple)):
            arr = arr[0]
        for i, v in enumerate(arr):
            probabilities[str(i)] = float(v)
    elif isinstance(raw, (list, tuple)):
        if raw and isinstance(raw[0], dict):
            return extract_probability(raw[0], predicted_class)
        if raw and isinstance(raw[0], (list, tuple, np.ndarray)):
            return extract_probability(raw[0], predicted_class)
        for i, v in enumerate(raw):
            probabilities[str(i)] = float(v)

    confidence = probabilities.get(str(predicted_class))
    if confidence is None:
        confidence = max(probabilities.values()) if probabilities else 0.0
    confidence = max(0.0, min(1.0, float(confidence)))
    return confidence, probabilities


def realized_volatility(df: pd.DataFrame, window: int = 20) -> float:
    close = pd.to_numeric(df["Close"], errors="coerce").dropna()
    ret = close.pct_change().dropna()
    vol = _safe_float(ret.tail(window).std(), 0.015) or 0.015
    return max(0.004, min(0.08, vol))


def future_business_dates(last_date: Any, days: int = 5) -> List[pd.Timestamp]:
    start = pd.Timestamp(last_date).tz_localize(None)
    dates: List[pd.Timestamp] = []
    d = start
    while len(dates) < days:
        d = d + pd.tseries.offsets.BDay(1)
        dates.append(pd.Timestamp(d))
    return dates


def signal_text(predicted_class: int) -> str:
    return "BULLISH (Naik)" if int(predicted_class) == 1 else "BEARISH (Turun)"


def action_from_signal(predicted_class: int, confidence: float, precision: float | None = None) -> Dict[str, Any]:
    precision_factor = (precision or 50.0) / 100.0
    safe_confidence = confidence * 100

    if predicted_class == 1 and safe_confidence >= 65 and precision_factor >= 0.55:
        return {
            "verdict": "BELI BERTAHAP",
            "risk_level": "MEDIUM",
            "note": "Sinyal bullish valid, tetapi tetap gunakan stop-loss dan pembelian bertahap.",
        }
    if predicted_class == 1:
        return {
            "verdict": "TUNGGU / WATCHLIST",
            "risk_level": "MEDIUM-HIGH",
            "note": "Arah naik terdeteksi, tetapi confidence atau precision belum cukup aman untuk entry agresif.",
        }
    return {
        "verdict": "HINDARI BELI",
        "risk_level": "HIGH",
        "note": "Model membaca risiko turun. Lebih aman menunggu konfirmasi harga dan volume.",
    }


def classifier_projection(
    df: pd.DataFrame,
    quote: Dict[str, Any],
    predicted_class: int,
    confidence: float,
    days: int = 5,
) -> List[Dict[str, Any]]:
    price = float(quote["price"])
    vol_daily = realized_volatility(df)
    five_day_vol = vol_daily * math.sqrt(days)
    strength = max(0.15, abs(confidence - 0.5) * 2.0)
    direction = 1 if int(predicted_class) == 1 else -1
    total_move = direction * max(0.003, min(0.12, five_day_vol * (0.55 + strength)))
    dates = future_business_dates(df.index[-1], days)

    rows: List[Dict[str, Any]] = []
    for i, d in enumerate(dates, start=1):
        progress = i / days
        expected_return = total_move * progress
        target = price * (1 + expected_return)
        band = price * vol_daily * math.sqrt(i) * 0.85
        rows.append({
            "date": d.strftime("%Y-%m-%d"),
            "day": i,
            "price": round(target, 4),
            "lower": round(max(0.0, target - band), 4),
            "upper": round(target + band, 4),
            "expected_return_pct": round(expected_return * 100, 2),
        })
    return rows


def build_model_response(
    ticker: str,
    used_symbol: str,
    model_name: str,
    model_key: str,
    predicted_class: int,
    confidence: float,
    probabilities: Dict[str, float],
    quote: Dict[str, Any],
    df: pd.DataFrame,
    feature_snapshot: Dict[str, float],
) -> Dict[str, Any]:
    metrics = MODEL_PROFILES.get(model_key, {})
    action = action_from_signal(predicted_class, confidence, metrics.get("precision"))
    projection = classifier_projection(df, quote, predicted_class, confidence, 5)

    return {
        "ticker": ticker,
        "symbol": used_symbol,
        "model": model_name,
        "trend": signal_text(predicted_class),
        "class": int(predicted_class),
        "confidence": round(float(confidence), 6),
        "confidence_percent": round(float(confidence) * 100, 2),
        "probabilities": probabilities,
        "current_price": round(float(quote["price"]), 4),
        "currency": quote.get("currency"),
        "quote": quote,
        "forecast": projection,
        "target_5d": projection[-1]["price"] if projection else None,
        "expected_return_5d_pct": projection[-1]["expected_return_pct"] if projection else None,
        "horizon": "1-5 hari trading ke depan",
        "action": action,
        "metrics": metrics,
        "features_used": FEATURES,
        "latest_features": feature_snapshot,
        "data_source": "Yahoo Finance + ONNX local model",
        "fetched_at": quote.get("fetched_at"),
        "realtime_note": quote.get("note"),
    }


def print_json(payload: Dict[str, Any]) -> None:
    import json

    print(json.dumps(payload, ensure_ascii=False, default=str))


def print_error(message: str) -> None:
    print_json({"error": message, "fetched_at": datetime.now(timezone.utc).isoformat()})
