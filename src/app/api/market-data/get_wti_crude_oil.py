import os
import sys
import json
import time
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def get_wti_data():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        url = 'https://www.investing.com/commodities/crude-oil-historical-data'
        driver.get(url)
        time.sleep(5)
        
        # Calculate dates for 120 days of data to make sure we have at least 60 trading days
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=120)).strftime('%Y-%m-%d')
        
        api_url = f"https://api.investing.com/api/financialdata/historical/8849?start-date={start_date}&end-date={end_date}&time-frame=Daily&add-missing-rows=false"
        
        script = f"""
        var callback = arguments[arguments.length - 1];
        fetch('{api_url}', {{
            headers: {{
                'domain-id': 'www',
                'Accept': 'application/json, text/plain, */*'
            }}
        }})
        .then(response => response.json())
        .then(data => callback(data))
        .catch(err => callback({{'error': err.toString()}}));
        """
        
        driver.set_script_timeout(30)
        result = driver.execute_async_script(script)
        
        if not result or 'data' not in result:
            raise Exception(f"Failed to fetch data: {result.get('error') if result else 'Empty response'}")
            
        rows = result['data']
        if len(rows) == 0:
            raise Exception("No data rows returned from Investing.com")
            
        # Parse newest row for current stats
        latest = rows[0]
        price = float(latest['last_close'])
        open_val = float(latest['last_open'])
        high_val = float(latest['last_max'])
        low_val = float(latest['last_min'])
        close_val = float(latest['last_close'])
        
        # Calculate change amount and change percent
        # We try to calculate changeAmt from the difference between row[0] and row[1]
        if len(rows) > 1:
            prev_close = float(rows[1]['last_close'])
            change_amt = round(price - prev_close, 2)
            change_percent = round((change_amt / prev_close) * 100, 2)
        else:
            change_amt = 0.0
            change_percent = float(latest.get('change_precent', 0.0))
            
        # Compile history for Spark Line (exactly 60 trading days, chronological order: oldest first)
        # rows[:60] gets the newest 60 trading days, [::-1] reverses it to oldest first
        history_rows = rows[:60][::-1]
        history = []
        for r in history_rows:
            try:
                # Standardize date format to match '2026-05-29T00:00:00.000Z'
                raw_date = r['rowDateTimestamp']
                dt = datetime.strptime(raw_date, '%Y-%m-%dT%H:%M:%SZ')
                formatted_date = dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
            except Exception:
                formatted_date = r.get('rowDateTimestamp', '')
                
            history.append({
                "date": formatted_date,
                "value": float(r['last_close'])
            })
            
        return {
            "price": price,
            "open": open_val,
            "high": high_val,
            "low": low_val,
            "close": close_val,
            "changeAmt": change_amt,
            "changePercent": change_percent,
            "history": history
        }
        
    finally:
        driver.quit()

def main():
    try:
        data = get_wti_data()
        
        # Determine paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        cache_path = os.path.join(script_dir, 'wti_cache.json')
        
        # Save to cache
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(json.dumps({"success": True, "message": f"WTI Crude Oil cache updated. Path: {cache_path}", "data": {
            "price": data["price"],
            "changeAmt": data["changeAmt"],
            "changePercent": data["changePercent"],
            "history_length": len(data["history"])
        }}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
