import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load KRX environment variables
krx_env_path = r"D:\AI Investing\KRXdata\.env"
load_dotenv(krx_env_path)

try:
    from pykrx import stock
except ImportError:
    print(json.dumps({"error": "pykrx is not installed"}))
    sys.exit(1)

def main():
    try:
        today = datetime.now()
        # Fetch 120 days of data to easily secure at least 60 trading days of history
        start_date = (today - timedelta(days=120)).strftime("%Y%m%d")
        end_date = today.strftime("%Y%m%d")
        
        # 1001 is the code for KOSPI index
        df = stock.get_index_fundamental(start_date, end_date, "1001")
        
        if df is None or df.empty:
            print(json.dumps({"error": "Failed to fetch index fundamentals from KRX (empty dataframe)"}))
            return

        # Filter out rows where PER or PBR is 0.0 or 0, which happens during trading hours before close/settlement
        df_filtered = df[(df['PER'] != 0) & (df['PBR'] != 0)].copy()

        if len(df_filtered) < 2:
            print(json.dumps({"error": "Not enough valid fundamental data points after filtering"}))
            return

        # Take the last 60 rows for history
        df_60 = df_filtered.tail(60)

        # Process PER
        per_history = []
        for dt, row in df_60.iterrows():
            per_history.append({
                "date": dt.strftime("%Y-%m-%dT00:00:00.000Z"),
                "value": round(float(row['PER']), 2)
            })

        latest_per = round(float(df_filtered['PER'].iloc[-1]), 2)
        prev_per = round(float(df_filtered['PER'].iloc[-2]), 2)
        per_change = round(latest_per - prev_per, 2)
        per_pct = round((per_change / prev_per) * 100, 2) if prev_per != 0 else 0.0

        # Process PBR
        pbr_history = []
        for dt, row in df_60.iterrows():
            pbr_history.append({
                "date": dt.strftime("%Y-%m-%dT00:00:00.000Z"),
                "value": round(float(row['PBR']), 2)
            })

        latest_pbr = round(float(df_filtered['PBR'].iloc[-1]), 2)
        prev_pbr = round(float(df_filtered['PBR'].iloc[-2]), 2)
        pbr_change = round(latest_pbr - prev_pbr, 2)
        pbr_pct = round((pbr_change / prev_pbr) * 100, 2) if prev_pbr != 0 else 0.0

        result = {
            "per": {
                "price": latest_per,
                "changeAmt": per_change,
                "changePercent": per_pct,
                "history": per_history
            },
            "pbr": {
                "price": latest_pbr,
                "changeAmt": pbr_change,
                "changePercent": pbr_pct,
                "history": pbr_history
            }
        }
        
        # Determine paths and save to cache directly from Python
        script_dir = os.path.dirname(os.path.abspath(__file__))
        cache_path = os.path.join(script_dir, 'krx_cache.json')
        
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": f"Exception occurred: {str(e)}"}))

if __name__ == "__main__":
    main()
