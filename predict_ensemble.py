import os
import sys
import warnings

import numpy as np

from predict import _fallback_forecast, _prophet_forecast
from stock_realtime import (
    MODEL_PROFILES,
    classifier_projection,
    download_history,
    extract_probability,
    get_quote_snapshot,
    latest_feature_matrix,
    print_error,
    print_json,
)

warnings.filterwarnings("ignore")


def _run_onnx(model_path, x_predict):
    import onnxruntime as rt

    sess = rt.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name
    output_names = [o.name for o in sess.get_outputs()]
    pred = sess.run(output_names, {input_name: x_predict})
    predicted_class = int(pred[0][0])
    confidence, probabilities = extract_probability(pred[1], predicted_class)
    return predicted_class, confidence, probabilities


def predict_ensemble(ticker):
    try:
        used_symbol, df = download_history(ticker, period="3y", min_rows=90)
        quote = get_quote_snapshot(used_symbol, df)
        current_price = float(quote["price"])

        try:
            prophet_rows = _prophet_forecast(df, quote, 5)
            prophet_method = "Prophet anchored to realtime quote"
        except Exception as exc:
            prophet_rows = _fallback_forecast(df, quote, 5)
            prophet_method = f"Fallback trend ({exc})"

        x_predict, feature_snapshot = latest_feature_matrix(df)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        models = {
            "xgboost": os.path.join(base_dir, "model", "xgb_v1_super_optimizedv2.onnx"),
            "randomforest": os.path.join(base_dir, "model", "rf_model_optimized.onnx"),
        }

        model_results = []
        for key, path in models.items():
            try:
                pred_class, conf, probs = _run_onnx(path, x_predict)
                projection = classifier_projection(df, quote, pred_class, conf, 5)
                profile = MODEL_PROFILES.get(key, {})
                model_results.append({
                    "key": key,
                    "class": pred_class,
                    "trend": "BULLISH (Naik)" if pred_class == 1 else "BEARISH (Turun)",
                    "confidence": round(conf, 6),
                    "confidence_percent": round(conf * 100, 2),
                    "probabilities": probs,
                    "precision": profile.get("precision"),
                    "projection": projection,
                    "expected_return_5d_pct": projection[-1]["expected_return_pct"],
                })
            except Exception as exc:
                model_results.append({"key": key, "error": str(exc)})

        prophet_return = float(prophet_rows[-1]["expected_return_pct"]) if prophet_rows else 0.0
        weighted_returns = [(prophet_return, 0.40, "prophet")]

        for item in model_results:
            if item.get("error"):
                continue
            precision = float(item.get("precision") or 50) / 100
            conf = float(item.get("confidence") or 0.5)
            weight = 0.30 if item["key"] == "randomforest" else 0.20
            # Penalize weak historical precision and weak live confidence.
            adjusted_weight = weight * max(0.25, precision) * max(0.40, conf)
            weighted_returns.append((float(item["expected_return_5d_pct"]), adjusted_weight, item["key"]))

        total_weight = sum(w for _, w, _ in weighted_returns) or 1.0
        ensemble_return = sum(r * w for r, w, _ in weighted_returns) / total_weight
        bullish_votes = sum(1 for item in model_results if not item.get("error") and item.get("class") == 1)
        bearish_votes = sum(1 for item in model_results if not item.get("error") and item.get("class") == 0)
        confidence = min(90.0, max(35.0, 50.0 + abs(ensemble_return) * 3.2 + abs(bullish_votes - bearish_votes) * 7.5))

        if ensemble_return >= 2.0 and bullish_votes >= bearish_votes:
            verdict = "BELI BERTAHAP"
            risk_level = "MEDIUM"
            trend = "BULLISH (Naik)"
            note = "Prophet dan model klasifikasi cukup mendukung kenaikan. Entry tetap bertahap, bukan all-in."
        elif ensemble_return <= -1.0 or bearish_votes > bullish_votes:
            verdict = "HINDARI BELI"
            risk_level = "HIGH"
            trend = "BEARISH (Turun)"
            note = "Kombinasi model membaca risiko turun atau sinyal belum aman. Tunggu konfirmasi lebih kuat."
        else:
            verdict = "TUNGGU / WATCHLIST"
            risk_level = "MEDIUM-HIGH"
            trend = "NETRAL"
            note = "Prediksi campuran atau return terlalu kecil. Lebih aman wait and see."

        # Build ensemble price path by blending Prophet path with the final return.
        forecast = []
        for i, row in enumerate(prophet_rows, start=1):
            progress = i / max(1, len(prophet_rows))
            blended_price = current_price * (1 + (ensemble_return / 100) * progress)
            prophet_price = float(row["price"])
            price = (blended_price * 0.65) + (prophet_price * 0.35)
            lower = min(float(row.get("lower", price)), price * 0.985)
            upper = max(float(row.get("upper", price)), price * 1.015)
            forecast.append({
                "date": row["date"],
                "day": i,
                "price": round(price, 4),
                "lower": round(max(0.0, lower), 4),
                "upper": round(max(0.0, upper), 4),
                "expected_return_pct": round((price / current_price - 1) * 100, 2),
            })

        payload = {
            "ticker": ticker,
            "symbol": used_symbol,
            "model": "Realtime Hybrid Ensemble",
            "trend": trend,
            "confidence": round(confidence / 100, 6),
            "confidence_percent": round(confidence, 2),
            "current_price": round(current_price, 4),
            "currency": quote.get("currency"),
            "quote": quote,
            "forecast": forecast,
            "target_5d": forecast[-1]["price"] if forecast else None,
            "expected_return_5d_pct": forecast[-1]["expected_return_pct"] if forecast else round(ensemble_return, 2),
            "horizon": "1-5 hari trading ke depan",
            "action": {"verdict": verdict, "risk_level": risk_level, "note": note},
            "components": {
                "prophet": {"method": prophet_method, "expected_return_5d_pct": round(prophet_return, 2), "forecast": prophet_rows},
                "classifiers": model_results,
                "weighted_sources": [{"source": s, "return_pct": round(r, 2), "weight": round(w, 4)} for r, w, s in weighted_returns],
            },
            "latest_features": feature_snapshot,
            "data_source": "Yahoo Finance + Prophet/fallback + ONNX ensemble",
            "fetched_at": quote.get("fetched_at"),
            "realtime_note": quote.get("note"),
        }
        print_json(payload)
    except Exception as e:
        print_error(f"Internal Script Error: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        predict_ensemble(sys.argv[1])
    else:
        print_error("Ticker tidak diberikan")
