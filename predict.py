import sys
import json
import warnings
import pandas as pd
from prophet import Prophet

warnings.filterwarnings('ignore')

def predict_stock(ticker, df, days=30):
    try:
        if df.empty:
            print(json.dumps({"error": f"Data historis untuk {ticker} tidak ditemukan"}))
            return

        prophet_df = df[['Date', 'Close']].copy()
        prophet_df = prophet_df.rename(columns={'Date': 'ds', 'Close': 'y'})
        prophet_df['ds'] = pd.to_datetime(prophet_df['ds'])
        prophet_df['ds'] = prophet_df['ds'].dt.tz_localize(None)

        m = Prophet(daily_seasonality=True, yearly_seasonality=True)
        m.fit(prophet_df)

        future = m.make_future_dataframe(periods=days)
        forecast = m.predict(future)

        forecast_result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(days)

        results = []
        for _, row in forecast_result.iterrows():
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
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        ticker = payload.get("ticker", "UNKNOWN")
        records = payload.get("data", [])
        df = pd.DataFrame(records)
        predict_stock(ticker, df)
    except Exception as e:
        print(json.dumps({"error": f"Input error: {str(e)}"}))
