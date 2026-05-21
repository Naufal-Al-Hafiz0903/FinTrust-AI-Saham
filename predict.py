import sys
import json
import warnings
import yfinance as yf
import pandas as pd
from prophet import Prophet

# Sembunyikan warning dari Prophet
warnings.filterwarnings('ignore')

def predict_stock(ticker, days=30):
    try:
        # Ambil data historis 2 tahun terakhir
        df = yf.download(ticker, period='2y', progress=False)
        
        if df.empty:
            print(json.dumps({"error": f"Data historis untuk {ticker} tidak ditemukan"}))
            return
            
        df = df.reset_index()
        
        # Ambil kolom Date dan Close, lalu ubah formatnya untuk Prophet (ds dan y)
        prophet_df = df[['Date', 'Close']].copy()
        
        # Handle jika yfinance mengembalikan MultiIndex columns (versi terbaru)
        if isinstance(prophet_df.columns, pd.MultiIndex):
            prophet_df.columns = prophet_df.columns.get_level_values(0)
            
        prophet_df = prophet_df.rename(columns={'Date': 'ds', 'Close': 'y'})
        prophet_df['ds'] = prophet_df['ds'].dt.tz_localize(None) # Hapus timezone
        
        # Inisialisasi dan latih model Prophet
        m = Prophet(daily_seasonality=True, yearly_seasonality=True)
        m.fit(prophet_df)
        
        # Buat dataframe untuk prediksi ke depan
        future = m.make_future_dataframe(periods=days)
        forecast = m.predict(future)
        
        # Ambil hanya bagian masa depan (forecast)
        forecast_result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(days)
        
        results = []
        for _, row in forecast_result.iterrows():
            # Hindari tanggal weekend jika mau (Prophet memprediksi setiap hari)
            if row['ds'].weekday() < 5: 
                results.append({
                    "date": row['ds'].strftime('%Y-%m-%d'),
                    "price": round(float(row['yhat']), 2),
                    "lower": round(float(row['yhat_lower']), 2),
                    "upper": round(float(row['yhat_upper']), 2)
                })
                
        print(json.dumps({"ticker": ticker, "forecast": results}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ticker = sys.argv[1]
        predict_stock(ticker)
    else:
        print(json.dumps({"error": "Ticker tidak diberikan"}))