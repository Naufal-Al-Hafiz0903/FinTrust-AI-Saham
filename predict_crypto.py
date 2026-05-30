import sys
import json
import warnings
import os
import pandas as pd
import numpy as np
import ta
import onnxruntime as rt

warnings.filterwarnings('ignore')

# Thresholds sesuai dengan main.py
MODEL_THRESHOLDS = {
    "xgb_crypto_v3": 0.75,
    "rf_crypto_v3": 0.65
}

def predict_crypto(ticker, df, model_type="xgb"):
    try:
        if df.empty:
            print(json.dumps({"error": f"Data historis untuk {ticker} tidak ditemukan"}))
            return

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # Pastikan kolom Date tersedia untuk ekstraksi Hour dan DayOfWeek
        if 'Date' not in df.columns and 'Datetime' not in df.columns:
             # Jika indexnya adalah datetime
             if pd.api.types.is_datetime64_any_dtype(df.index):
                 df['Date'] = df.index
             else:
                 print(json.dumps({"error": "Kolom Date/Datetime tidak ditemukan untuk ekstraksi waktu."}))
                 return
                 
        # Parsing tanggal
        time_col = 'Date' if 'Date' in df.columns else 'Datetime'
        df[time_col] = pd.to_datetime(df[time_col])
        df['Hour'] = df[time_col].dt.hour
        df['DayOfWeek'] = df[time_col].dt.dayofweek

        # Kalkulasi Fitur Utama
        df['Ret_Close'] = df['Close'].pct_change()
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

        # Lag features
        df['Ret_Close_Lag1'] = df['Ret_Close'].shift(1)
        df['RSI_Lag1']       = df['RSI_14'].shift(1)

        # Shift base features sesuai dengan main.py
        base_features_opt = [
            "Ret_Close", "Ret_High", "Volatility_5", "Momentum_5",
            "Vol_Change", "RSI_14", "MACD_12_26_9", "SMA20_Dist", "EMA50_Dist"
        ]
        for col in base_features_opt:
            df[col] = df[col].shift(1)

        df = df.dropna()
        if df.empty:
            print(json.dumps({"error": "Data tidak cukup setelah kalkulasi indikator."}))
            return

        latest_data = df.iloc[-1:]
        
        # Fitur khusus crypto v3
        features = [
            "Ret_Close", "Ret_High", "Volatility_5", "Momentum_5",
            "Vol_Change", "RSI_14", "MACD_12_26_9", "SMA20_Dist", "EMA50_Dist",
            "Ret_Close_Lag1", "RSI_Lag1", "Hour", "DayOfWeek"
        ]

        X_predict = latest_data[features].astype(np.float32).values

        # Pemilihan Model
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if model_type == "rf":
            model_name = "rf_crypto_v3"
            model_filename = f"{model_name}.onnx"
        else:
            model_name = "xgb_crypto_v3"
            model_filename = f"{model_name}.onnx"
            
        model_path = os.path.join(base_dir, "model", model_filename)

        if not os.path.exists(model_path):
             print(json.dumps({"error": f"Model file {model_filename} tidak ditemukan di folder model!"}))
             return

        # Inference ONNX
        sess = rt.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        input_name = sess.get_inputs()[0].name
        
        # Ekstraksi probabilitas untuk kelas 1 (Bullish)
        pred_onx = sess.run(None, {input_name: X_predict})
        
        probs = pred_onx[1]
        if isinstance(probs, list) and isinstance(probs[0], dict):
            prob_bullish = float(probs[0].get(1, probs[0].get(1.0, 0.0)))
        else:
            prob_bullish = float(probs[0][1]) if len(probs[0]) > 1 else float(probs[0])
            
        # Gunakan dynamic threshold dari main.py
        threshold = MODEL_THRESHOLDS.get(model_name, 0.65)
        
        if prob_bullish >= threshold:
            predicted_class = 1
            trend_label = "BULLISH (Naik/Beli)"
        else:
            predicted_class = 0
            trend_label = "BEARISH (Turun/Hold)"

        print(json.dumps({
            "ticker": ticker,
            "model": model_name,
            "trend": trend_label,
            "class": predicted_class,
            "confidence": prob_bullish,
            "threshold_used": threshold
        }))

    except Exception as e:
        print(json.dumps({"error": f"Internal Script Error: {str(e)}"}))

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        ticker = payload.get("ticker", "UNKNOWN")
        records = payload.get("data", [])
        model_pref = payload.get("model", "xgb") # Menerima preferensi "xgb" atau "rf"
        
        df = pd.DataFrame(records)
        df['Close']  = pd.to_numeric(df['Close'],  errors='coerce')
        df['Open']   = pd.to_numeric(df['Open'],   errors='coerce')
        df['High']   = pd.to_numeric(df['High'],   errors='coerce')
        df['Low']    = pd.to_numeric(df['Low'],    errors='coerce')
        df['Volume'] = pd.to_numeric(df['Volume'], errors='coerce')
        
        predict_crypto(ticker, df, model_type=model_pref)
    except Exception as e:
        print(json.dumps({"error": f"Input error: {str(e)}"}))