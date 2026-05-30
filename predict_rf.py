import sys
import json
import warnings
import os
import pandas as pd
import numpy as np
import ta
import onnxruntime as rt

warnings.filterwarnings('ignore')

def predict_randomforest(ticker, df):
    try:
        if df.empty:
            print(json.dumps({"error": f"Data historis untuk {ticker} tidak ditemukan"}))
            return

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df['Ret_Close'] = df['Close'].pct_change()
        df['Ret_Open']  = df['Open'].pct_change()
        df['Ret_High']  = df['High'].pct_change()

        df['Volatility_5'] = df['Ret_Close'].rolling(5).std()
        df['Momentum_5']   = df['Close'] / df['Close'].shift(5) - 1
        df['Vol_Change']   = df['Volume'].pct_change()

        df['RSI_14'] = ta.momentum.RSIIndicator(close=df['Close'], window=14).rsi()
        macd = ta.trend.MACD(close=df['Close'], window_slow=26, window_fast=12, window_sign=9)
        df['MACD_12_26_9'] = macd.macd()

        sma_20 = ta.trend.sma_indicator(close=df['Close'], window=20)
        ema_50 = ta.trend.ema_indicator(close=df['Close'], window=50)

        df['SMA20_Dist'] = (df['Close'] - sma_20) / sma_20
        df['EMA50_Dist'] = (df['Close'] - ema_50) / ema_50

        df['Ret_Close_Lag1'] = df['Ret_Close'].shift(1)
        df['RSI_Lag1']       = df['RSI_14'].shift(1)

        base_features_opt = [
            "Ret_Close", "Ret_Open", "Ret_High", "Volatility_5", "Momentum_5",
            "Vol_Change", "RSI_14", "MACD_12_26_9", "SMA20_Dist", "EMA50_Dist"
        ]
        for col in base_features_opt:
            df[col] = df[col].shift(1)

        df = df.dropna()
        if df.empty:
            print(json.dumps({"error": "Data tidak cukup setelah kalkulasi indikator."}))
            return

        latest_data = df.iloc[-1:]
        features = [
            "Ret_Close", "Ret_Open", "Ret_High", "Volatility_5", "Momentum_5",
            "Vol_Change", "RSI_14", "MACD_12_26_9", "SMA20_Dist", "EMA50_Dist",
            "Ret_Close_Lag1", "RSI_Lag1"
        ]

        X_predict = latest_data[features].astype(np.float32).values

        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "model", "rf_model_optimized.onnx")

        sess = rt.InferenceSession(model_path)
        input_name = sess.get_inputs()[0].name
        label_name = sess.get_outputs()[0].name
        prob_name  = sess.get_outputs()[1].name

        pred_onx = sess.run([label_name, prob_name], {input_name: X_predict})

        predicted_class    = int(pred_onx[0][0])
        probabilities_dict = pred_onx[1][0]

        if isinstance(probabilities_dict, dict):
            confidence = float(probabilities_dict.get(predicted_class,
                               probabilities_dict.get(float(predicted_class), 0.0)))
        else:
            confidence = float(probabilities_dict[predicted_class]) \
                         if predicted_class < len(probabilities_dict) else 0.0

        trend_label = "BULLISH (Naik)" if predicted_class == 1 else "BEARISH (Turun)"

        print(json.dumps({
            "ticker": ticker,
            "model": "Random Forest (ONNX)",
            "trend": trend_label,
            "class": predicted_class,
            "confidence": confidence
        }))

    except Exception as e:
        print(json.dumps({"error": f"Internal Script Error: {str(e)}"}))

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        ticker = payload.get("ticker", "UNKNOWN")
        records = payload.get("data", [])
        df = pd.DataFrame(records)
        df['Close']  = pd.to_numeric(df['Close'],  errors='coerce')
        df['Open']   = pd.to_numeric(df['Open'],   errors='coerce')
        df['High']   = pd.to_numeric(df['High'],   errors='coerce')
        df['Low']    = pd.to_numeric(df['Low'],    errors='coerce')
        df['Volume'] = pd.to_numeric(df['Volume'], errors='coerce')
        predict_randomforest(ticker, df)
    except Exception as e:
        print(json.dumps({"error": f"Input error: {str(e)}"}))
