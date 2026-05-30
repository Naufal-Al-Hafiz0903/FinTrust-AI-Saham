import os
import sys
import warnings

import onnxruntime as rt

from stock_realtime import (
    build_model_response,
    download_history,
    extract_probability,
    get_quote_snapshot,
    latest_feature_matrix,
    print_error,
    print_json,
)

warnings.filterwarnings("ignore")


def predict_xgboost(ticker):
    try:
        used_symbol, df = download_history(ticker, period="3y", min_rows=90)
        quote = get_quote_snapshot(used_symbol, df)
        x_predict, feature_snapshot = latest_feature_matrix(df)

        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "model", "xgb_v1_super_optimizedv2.onnx")
        if not os.path.exists(model_path):
            raise RuntimeError(f"File model tidak ditemukan: {model_path}")

        sess = rt.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        input_name = sess.get_inputs()[0].name
        output_names = [o.name for o in sess.get_outputs()]
        pred_onx = sess.run(output_names, {input_name: x_predict})

        predicted_class = int(pred_onx[0][0])
        confidence, probabilities = extract_probability(pred_onx[1], predicted_class)

        payload = build_model_response(
            ticker=ticker,
            used_symbol=used_symbol,
            model_name="XGBoost (ONNX Realtime)",
            model_key="xgboost",
            predicted_class=predicted_class,
            confidence=confidence,
            probabilities=probabilities,
            quote=quote,
            df=df,
            feature_snapshot=feature_snapshot,
        )
        print_json(payload)
    except Exception as e:
        print_error(f"Internal Script Error: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        predict_xgboost(sys.argv[1])
    else:
        print_error("Ticker tidak diberikan")
