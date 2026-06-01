import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import pandas as pd

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

def get_naver_futures():
    data_list = []
    headers = {"User-Agent": "Mozilla/5.0"}
    
    # 1. Scrape history (11 pages)
    for page in range(1, 12):
        url = f"https://finance.naver.com/sise/sise_index_day.naver?code=FUT&page={page}"
        try:
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code != 200:
                continue
            soup = BeautifulSoup(res.content.decode("euc-kr", "replace"), "html.parser")
            table = soup.find("table", class_="type_1")
            if not table:
                continue
            rows = table.find_all("tr")
            for r in rows:
                cols = r.find_all("td")
                if len(cols) >= 6:
                    date_str = cols[0].text.strip()
                    if not date_str or "." not in date_str:
                        continue
                    close_str = cols[1].text.strip().replace(",", "")
                    try:
                        date_obj = datetime.strptime(date_str, "%Y.%m.%d")
                        close_val = float(close_str)
                        data_list.append({"Date": date_obj, "Close": close_val})
                    except Exception:
                        pass
        except Exception:
            pass
            
    if not data_list:
        return None
        
    df = pd.DataFrame(data_list)
    df = df.drop_duplicates(subset=["Date"])
    df = df.set_index("Date")
    df = df.sort_index()
    
    # 2. Scrape current quote details
    open_val = None
    high_val = None
    low_val = None
    price_val = None
    change_val = None
    pct_val = None
    
    try:
        url_curr = "https://finance.naver.com/sise/sise_index.naver?code=FUT"
        res_curr = requests.get(url_curr, headers=headers, timeout=5)
        if res_curr.status_code == 200:
            soup_curr = BeautifulSoup(res_curr.content, "html.parser", from_encoding="euc-kr")
            for tr in soup_curr.find_all("tr"):
                cells = tr.find_all(["th", "td"])
                texts = [c.get_text(strip=True) for c in cells]
                for idx, text in enumerate(texts):
                    if "선물(" in text:
                        price_val = float(texts[idx+1].replace(",", ""))
                    elif "시가" in text:
                        open_val = float(texts[idx+1].replace(",", ""))
                    elif "전일대비" in text:
                        val_str = "".join(c for c in texts[idx+1] if c.isdigit() or c == ".")
                        if val_str:
                            change_val = float(val_str)
                            if "-" in texts[idx+1] or "하락" in texts[idx+1]:
                                change_val = -change_val
                    elif "고가" in text:
                        high_val = float(texts[idx+1].replace(",", ""))
                    elif "저가" in text:
                        low_val = float(texts[idx+1].replace(",", ""))
                    elif "등락률" in text:
                        pct_str = texts[idx+1].replace("%", "").strip()
                        pct_val = float(pct_str)
    except Exception:
        pass
        
    # fallback to latest historical if current quote fails
    latest_hist_date = df.index[-1]
    latest_hist_close = float(df["Close"].iloc[-1])
    
    if price_val is None:
        price_val = latest_hist_close
    if open_val is None:
        open_val = price_val
    if high_val is None:
        high_val = price_val
    if low_val is None:
        low_val = price_val
        
    if change_val is None or pct_val is None:
        if len(df) >= 2:
            prev_close = float(df["Close"].iloc[-2])
            change_val = price_val - prev_close
            pct_val = (change_val / prev_close) * 100 if prev_close != 0 else 0.0
            
    # merge current into history if it's newer than latest historical date
    today_str = datetime.now().strftime("%Y-%m-%d")
    latest_hist_str = latest_hist_date.strftime("%Y-%m-%d")
    
    df_60 = df.tail(60)
    history_list = [{"date": dt.strftime("%Y-%m-%dT00:00:00.000Z"), "value": round(float(row["Close"]), 2)} for dt, row in df_60.iterrows()]
    
    # if today is newer, we can append it or update the last element
    if today_str > latest_hist_str:
        history_list.append({
            "date": datetime.now().strftime("%Y-%m-%dT00:00:00.000Z"),
            "value": price_val
        })
        if len(history_list) > 60:
            history_list = history_list[-60:]
            
    return {
        "price": price_val,
        "changeAmt": change_val,
        "changePercent": pct_val,
        "open": open_val,
        "high": high_val,
        "low": low_val,
        "close": price_val,
        "history": history_list
    }

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
        # 2. Fetch KOSPI Trading Value & Calculate KOSPI RSI(14)
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
            
            # KOSPI RSI(14)
            close_series = df_ohlcv.iloc[:, 3].copy()
            if len(close_series) >= 15:
                delta = close_series.diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                rs = gain / loss
                rsi_series = 100 - (100 / (1 + rs))
                rsi_series = rsi_series.dropna()
                
                if len(rsi_series) >= 2:
                    rsi_60 = rsi_series.tail(60)
                    history_rsi = [{"date": format_iso_date(dt), "value": round(float(val), 2)} for dt, val in rsi_60.items()]
                    latest_rsi = round(float(rsi_series.iloc[-1]), 2)
                    prev_rsi = round(float(rsi_series.iloc[-2]), 2)
                    rsi_change = round(latest_rsi - prev_rsi, 2)
                    rsi_pct = round((rsi_change / prev_rsi) * 100, 2) if prev_rsi != 0 else 0.0
                    
                    result["kospi_rsi"] = {
                        "price": latest_rsi,
                        "changeAmt": rsi_change,
                        "changePercent": rsi_pct,
                        "history": history_rsi
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
        # 4-5. Fetch KOSPI200 Futures (Pre-fetch for Night Futures reference price)
        # ==========================================
        futures_price_ref = None
        try:
            futures_data = get_naver_futures()
            if futures_data:
                result["kospi200_futures"] = futures_data
                futures_price_ref = futures_data.get("price")
        except Exception:
            pass

        # ==========================================
        # 5. Read KOSPI200 Night Futures
        # ==========================================
        night_path = r"D:\AI Investing\Daily_Check\DailyData\kospif_ngt_history.json"
        if os.path.exists(night_path):
            with open(night_path, "r", encoding="utf-8") as f:
                night_data = json.load(f)
            if night_data and len(night_data) >= 2:
                # Fetch KOSPI200 Night Futures live cache to get Open, High, Low, Close for daily candle
                latest_night_from_file = round(float(night_data[-1]['price']), 2)
                
                open_p = latest_night_from_file
                high_p = latest_night_from_file
                low_p = latest_night_from_file
                close_p = latest_night_from_file
                has_live = False
                
                try:
                    cache_url = "https://esignal.co.kr/data/cache/kospif_ngt.js"
                    cache_headers = {
                        'User-Agent': 'Mozilla/5.0',
                        'Referer': 'https://esignal.co.kr/kospi200-futures-night/'
                    }
                    r_cache = requests.get(cache_url, headers=cache_headers, timeout=5)
                    if r_cache.status_code == 200:
                        cache_json = r_cache.json()
                        open_p = float(cache_json.get('open', latest_night_from_file))
                        pts = cache_json.get('data', [])
                        if len(pts) > 0:
                            prices = [float(pt[1]) for pt in pts]
                            high_p = max(prices)
                            low_p = min(prices)
                            close_p = prices[-1]
                            has_live = True
                except Exception:
                    pass

                # Get today's local date
                today_str = datetime.now().strftime("%Y-%m-%d")
                last_hist_date = night_data[-1]['date']
                
                night_60 = night_data[-60:]
                night_history = [{"date": format_iso_date(item['date']), "value": round(float(item['price']), 2)} for item in night_60]
                
                # Determine reference price for change calculation (compares to daytime futures closing price)
                # If not fetched in this run, try to load from the existing cache
                if futures_price_ref is None:
                    try:
                        script_dir = os.path.dirname(os.path.abspath(__file__))
                        cache_path = os.path.join(script_dir, 'krx_cache.json')
                        if os.path.exists(cache_path):
                            with open(cache_path, 'r', encoding='utf-8') as f_old:
                                old_cache = json.load(f_old)
                                if isinstance(old_cache, dict):
                                    futures_price_ref = old_cache.get("kospi200_futures", {}).get("price")
                    except Exception:
                        pass

                if has_live:
                    current_price = close_p
                    if today_str > last_hist_date:
                        # Case 1: Live session has ended/is active but not yet written to history file
                        prev_price = latest_night_from_file
                        night_history.append({"date": format_iso_date(today_str), "value": round(current_price, 2)})
                        if len(night_history) > 60:
                            night_history = night_history[-60:]
                    else:
                        # Case 2: Today's session is already written to history file
                        prev_price = round(float(night_data[-2]['price']), 2)
                        night_history[-1]['value'] = round(current_price, 2)
                else:
                    current_price = latest_night_from_file
                    prev_price = round(float(night_data[-2]['price']), 2)
                
                # Reference price for change and changePercent calculations is the daytime futures price
                change_base_price = futures_price_ref if futures_price_ref is not None else prev_price
                night_change = round(current_price - change_base_price, 2)
                night_pct = round((night_change / change_base_price) * 100, 2) if change_base_price != 0 else 0.0
                
                result["kospi200_night"] = {
                    "price": round(current_price, 2),
                    "changeAmt": night_change,
                    "changePercent": night_pct,
                    "history": night_history,
                    "open": round(open_p, 2),
                    "high": round(high_p, 2),
                    "low": round(low_p, 2),
                    "close": round(close_p, 2)
                }

        # ==========================================
        # 6. Read & Compute KOSPI ADR(20, %)
        # ==========================================
        adr_path = r"D:\AI Investing\Daily_Check_K\adv_dec_history.json"
        if os.path.exists(adr_path):
            with open(adr_path, "r", encoding="utf-8") as f:
                adr_data = json.load(f)
            if adr_data and len(adr_data) >= 20:
                adr_computed = []
                for i in range(len(adr_data)):
                    if i < 19:
                        continue
                    recent_20 = adr_data[i-19 : i+1]
                    sum_adv = sum(item['adv'] for item in recent_20)
                    sum_dec = sum(item['dec'] for item in recent_20)
                    val = (sum_adv / sum_dec) * 100 if sum_dec != 0 else 0.0
                    adr_computed.append({
                        "date": adr_data[i]['date'],
                        "value": round(val, 2)
                    })
                if len(adr_computed) >= 2:
                    adr_60 = adr_computed[-60:]
                    adr_history = [{"date": format_iso_date(item['date']), "value": item['value']} for item in adr_60]
                    latest_adr = adr_computed[-1]['value']
                    prev_adr = adr_computed[-2]['value']
                    adr_change = round(latest_adr - prev_adr, 2)
                    adr_pct = round((adr_change / prev_adr) * 100, 2) if prev_adr != 0 else 0.0
                    
                    result["kospi_adr"] = {
                        "price": latest_adr,
                        "changeAmt": adr_change,
                        "changePercent": adr_pct,
                        "history": adr_history
                    }

        # ==========================================
        # 8. Write results to krx_cache.json
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
