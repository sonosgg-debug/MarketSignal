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

def format_iso_date(date_str):
    # Convert 'YYYY-MM-DD' or datetime to 'YYYY-MM-DDT00:00:00.000Z'
    if isinstance(date_str, str):
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    else:
        dt = date_str
    return dt.strftime("%Y-%m-%dT00:00:00.000Z")

def main():
    try:
        today = datetime.now()
        # Fetch 120 days of data to easily secure at least 60 trading days of history
        start_date = (today - timedelta(days=120)).strftime("%Y%m%d")
        end_date = today.strftime("%Y%m%d")
        
        result = {}

        # ==========================================
        # 1. Fetch KOSPI Fundamentals (PER, PBR)
        # ==========================================
        df_fund = stock.get_index_fundamental(start_date, end_date, "1001")
        if df_fund is not None and not df_fund.empty:
            df_fund_filtered = df_fund[(df_fund['PER'] != 0) & (df_fund['PBR'] != 0)].copy()
            if len(df_fund_filtered) >= 2:
                df_fund_60 = df_fund_filtered.tail(60)
                
                # PER
                per_history = [{"date": format_iso_date(dt), "value": round(float(row['PER']), 2)} for dt, row in df_fund_60.iterrows()]
                latest_per = round(float(df_fund_filtered['PER'].iloc[-1]), 2)
                prev_per = round(float(df_fund_filtered['PER'].iloc[-2]), 2)
                per_change = round(latest_per - prev_per, 2)
                per_pct = round((per_change / prev_per) * 100, 2) if prev_per != 0 else 0.0
                
                result["per"] = {
                    "price": latest_per,
                    "changeAmt": per_change,
                    "changePercent": per_pct,
                    "history": per_history
                }
                
                # PBR
                pbr_history = [{"date": format_iso_date(dt), "value": round(float(row['PBR']), 2)} for dt, row in df_fund_60.iterrows()]
                latest_pbr = round(float(df_fund_filtered['PBR'].iloc[-1]), 2)
                prev_pbr = round(float(df_fund_filtered['PBR'].iloc[-2]), 2)
                pbr_change = round(latest_pbr - prev_pbr, 2)
                pbr_pct = round((pbr_change / prev_pbr) * 100, 2) if prev_pbr != 0 else 0.0
                
                result["pbr"] = {
                    "price": latest_pbr,
                    "changeAmt": pbr_change,
                    "changePercent": pbr_pct,
                    "history": pbr_history
                }

        # ==========================================
        # 2. Fetch KOSPI Trading Value
        # ==========================================
        df_ohlcv = stock.get_index_ohlcv_by_date(start_date, end_date, "1001")
        if df_ohlcv is not None and not df_ohlcv.empty:
            # Find 거래대금 column
            col_name = None
            for col in df_ohlcv.columns:
                if "거래대금" in col:
                    col_name = col
                    break
            if col_name:
                # Divide by 100,000,000 to convert to '억원'
                val_series = df_ohlcv[col_name] / 100000000
                # Filter out zeros or nulls
                val_series = val_series[val_series > 0].copy()
                if len(val_series) >= 2:
                    val_60 = val_series.tail(60)
                    history_val = [{"date": format_iso_date(dt), "value": round(float(val), 2)} for dt, val in val_60.items()]
                    latest_val = round(float(val_series.iloc[-1]), 2)
                    prev_val = round(float(val_series.iloc[-2]), 2)
                    val_change = round(latest_val - prev_val, 2)
                    val_pct = round((val_change / prev_val) * 100, 2) if prev_val != 0 else 0.0
                    
                    result["kospi_trade_value"] = {
                        "price": latest_val,
                        "changeAmt": val_change,
                        "changePercent": val_pct,
                        "history": history_val
                    }

        # ==========================================
        # 3. Read Customer Deposits & Credit Balance
        # ==========================================
        dep_path = r"D:\AI Investing\Daily_Check_K\deposits_history.json"
        if os.path.exists(dep_path):
            with open(dep_path, "r", encoding="utf-8") as f:
                dep_data = json.load(f)
            if dep_data and len(dep_data) >= 2:
                dep_60 = dep_data[-60:]
                
                # Customer Deposits
                dep_history = [{"date": format_iso_date(item['date']), "value": round(float(item['deposit']), 2)} for item in dep_60]
                latest_dep = round(float(dep_data[-1]['deposit']), 2)
                prev_dep = round(float(dep_data[-2]['deposit']), 2)
                dep_change = round(latest_dep - prev_dep, 2)
                dep_pct = round((dep_change / prev_dep) * 100, 2) if prev_dep != 0 else 0.0
                
                result["customer_deposits"] = {
                    "price": latest_dep,
                    "changeAmt": dep_change,
                    "changePercent": dep_pct,
                    "history": dep_history
                }
                
                # Credit Balance
                cred_history = [{"date": format_iso_date(item['date']), "value": round(float(item['credit']), 2)} for item in dep_60]
                latest_cred = round(float(dep_data[-1]['credit']), 2)
                prev_cred = round(float(dep_data[-2]['credit']), 2)
                cred_change = round(latest_cred - prev_cred, 2)
                cred_pct = round((cred_change / prev_cred) * 100, 2) if prev_cred != 0 else 0.0
                
                result["credit_balance"] = {
                    "price": latest_cred,
                    "changeAmt": cred_change,
                    "changePercent": cred_pct,
                    "history": cred_history
                }

        # ==========================================
        # 4. Read Margin Call / Liquidation Amount
        # ==========================================
        liq_path = r"D:\AI Investing\Daily_Check_K\liquidation_history.json"
        if os.path.exists(liq_path):
            with open(liq_path, "r", encoding="utf-8") as f:
                liq_data = json.load(f)
            if liq_data and len(liq_data) >= 2:
                liq_60 = liq_data[-60:]
                liq_history = [{"date": format_iso_date(item['date']), "value": round(float(item['liquidation']), 2)} for item in liq_60]
                latest_liq = round(float(liq_data[-1]['liquidation']), 2)
                prev_liq = round(float(liq_data[-2]['liquidation']), 2)
                liq_change = round(latest_liq - prev_liq, 2)
                liq_pct = round((liq_change / prev_liq) * 100, 2) if prev_liq != 0 else 0.0
                
                result["margin_call"] = {
                    "price": latest_liq,
                    "changeAmt": liq_change,
                    "changePercent": liq_pct,
                    "history": liq_history
                }

        # ==========================================
        # 5. Write results to krx_cache.json
        # ==========================================
        script_dir = os.path.dirname(os.path.abspath(__file__))
        cache_path = os.path.join(script_dir, 'krx_cache.json')
        
        # Merge with existing cache if keys are missing (to prevent accidental overwrite of existing keys)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    old_cache = json.load(f)
                if isinstance(old_cache, dict):
                    # Keep old keys unless updated
                    for k, v in old_cache.items():
                        if k not in result:
                            result[k] = v
            except Exception:
                pass
                
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": f"Exception occurred: {str(e)}"}))

if __name__ == "__main__":
    main()
