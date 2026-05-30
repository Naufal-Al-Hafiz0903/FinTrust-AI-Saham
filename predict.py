import sys
import warnings
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from stock_realtime import (
    download_history,
    future_business_dates,
    get_quote_snapshot,
    print_error,
    print_json,
)

warnings.filterwarnings("ignore")


def _fallback_forecast(df, quote, days=5):
    """Fast fallback when Prophet is not installed or fitting fails."""
    close = pd.to_numeric(df["Close"], errors="coerce").dropna()
    if len(close) < 20:
        raise RuntimeError("Data terlalu pendek untuk prediksi fallback")

    current = float(quote["price"])
    ret_5 = close.pct_change(5).dropna()
    ret_20 = close.pct_change(20).dropna()
    daily_vol = close.pct_change().dropna().tail(20).std()

    momentum = 0.65 * (ret_5.iloc[-1] if len(ret_5) else 0) + 0.35 * (ret_20.iloc[-1] / 4 if len(ret_20) else 0)
    momentum = float(np.clip(momentum, -0.08, 0.08))
    daily_vol = float(np.clip(daily_vol if np.isfinite(daily_vol) else 0.015, 0.004, 0.08))

    rows = []
    for i, d in enumerate(future_business_dates(df.index[-1], days), start=1):
        progress = i / days
        target = current * (1 + momentum * progress)
        band = current * daily_vol * np.sqrt(i) * 1.15
        rows.append({
            "date": d.strftime("%Y-%m-%d"),
            "price": round(float(target), 4),
            "lower": round(float(max(0, target - band)), 4),
            "upper": round(float(target + band), 4),
            "expected_return_pct": round(float((target / current - 1) * 100), 2),
        })
    return rows


def _prophet_forecast(df, quote, days=5):
    from prophet import Prophet

    work = df.reset_index()[["Date", "Close"]].copy()
    work = work.rename(columns={"Date": "ds", "Close": "y"})
    work["ds"] = pd.to_datetime(work["ds"]).dt.tz_localize(None)
    work["y"] = pd.to_numeric(work["y"], errors="coerce")
    work = work.dropna()

    if len(work) < 90:
        raise RuntimeError("Data historis terlalu pendek untuk Prophet")

    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        changepoint_prior_scale=0.08,
        interval_width=0.80,
    )
    model.fit(work)

    future = model.make_future_dataframe(periods=days * 2, freq="B", include_history=True)
    forecast = model.predict(future)
    future_forecast = forecast[forecast["ds"] > work["ds"].max()].head(days).copy()

    # Anchor forecast to the latest market price so the prediction follows the
    # newest realtime/near-realtime quote instead of yesterday's close only.
    latest_train_close = float(work["y"].iloc[-1])
    offset = float(quote["price"]) - latest_train_close
    rows = []
    for _, row in future_forecast.iterrows():
        price = float(row["yhat"] + offset)
        lower = float(row["yhat_lower"] + offset)
        upper = float(row["yhat_upper"] + offset)
        rows.append({
            "date": pd.Timestamp(row["ds"]).strftime("%Y-%m-%d"),
            "price": round(price, 4),
            "lower": round(max(0.0, lower), 4),
            "upper": round(max(0.0, upper), 4),
            "expected_return_pct": round(((price / float(quote["price"])) - 1) * 100, 2),
        })
    return rows


def predict_stock(ticker, days=5):
    try:
        days = max(1, min(int(days), 10))
        used_symbol, df = download_history(ticker, period="3y", min_rows=90)
        quote = get_quote_snapshot(used_symbol, df)

        method = "Prophet"
        try:
            forecast = _prophet_forecast(df, quote, days)
        except Exception as prophet_error:
            method = f"Fallback Trend ({prophet_error})"
            forecast = _fallback_forecast(df, quote, days)

        payload = {
            "ticker": ticker,
            "symbol": used_symbol,
            "model": method,
            "current_price": round(float(quote["price"]), 4),
            "currency": quote.get("currency"),
            "quote": quote,
            "forecast": forecast,
            "target_5d": forecast[-1]["price"] if forecast else None,
            "expected_return_5d_pct": forecast[-1]["expected_return_pct"] if forecast else None,
            "horizon": f"1-{days} hari trading ke depan",
            "data_source": "Yahoo Finance",
            "latest_history_date": str(pd.Timestamp(df.index[-1]).date()),
            "fetched_at": quote.get("fetched_at") or datetime.now(timezone.utc).isoformat(),
            "realtime_note": quote.get("note"),
        }
        print_json(payload)
    except Exception as e:
        print_error(str(e))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        ticker_arg = sys.argv[1]
        days_arg = sys.argv[2] if len(sys.argv) > 2 else 5
        predict_stock(ticker_arg, days_arg)
    else:
        print_error("Ticker tidak diberikan")
