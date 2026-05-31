import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
import { IndicatorData } from '@/types';
import path from 'path';
import fs from 'fs';
import { execSync, exec } from 'child_process';

const TICKERS = [
  { id: '01', name: '미국 S&P 500 지수', ticker: '^GSPC' },
  { id: '02', name: '미국 나스닥 지수', ticker: '^IXIC' },
  { id: '03', name: '미국 국채 10년물 금리(TNX)', ticker: '^TNX', negativeFavorable: true },
  { id: '04', name: 'Crude Oil WTI (NYMEX)', ticker: 'CL=F', negativeFavorable: true },
  { id: '05', name: '미국 달러 지수(USD Index)', ticker: 'DX-Y.NYB', negativeFavorable: true },
  { id: '06', name: 'USD/KRW 환율', ticker: 'KRW=X', negativeFavorable: true },
  { id: '07', name: '필라델피아 반도체 지수(SOX)', ticker: '^SOX' },
  { id: '08', name: 'EWY (MSCI South Korea ETF)', ticker: 'EWY' },
  { id: '09', name: '엔비디아(NVDA)', ticker: 'NVDA' },
  { id: '10', name: '마이크론(MU)', ticker: 'MU' },
  { id: '11', name: '샌디스크(SNDK)', ticker: 'SNDK' },
  { id: '12', name: 'DRAM (Roundhill ETF)', ticker: 'DRAM' },
  { id: '13', name: '비트코인(BTC-USD) 가격', ticker: 'BTC-USD' },
  { id: '14', name: 'CBOE VIX', ticker: '^VIX', negativeFavorable: true },
  { id: '15', name: 'CNN Fear & Greed Index', ticker: 'FEAR_GREED' },
  { id: '16', name: 'KOSPI 지수', ticker: '^KS11' },
  { id: '17', name: 'KOSDAQ 지수', ticker: '^KQ11' },
  { id: '18', name: 'KOSPI200 선물 지수', ticker: 'KOSPI200_FUTURES' },
  { id: '19', name: 'KOSPI PER', ticker: 'KOSPI_PER' },
  { id: '20', name: 'KOSPI PBR', ticker: 'KOSPI_PBR' },
  { id: '21', name: 'KOSPI RSI(14, %)', ticker: 'KOSPI_RSI' },
  { id: '22', name: 'KOSPI ADR(20, %)', ticker: 'ADR_INFO' },
  { id: '23', name: 'KOSPI 거래대금 (단위:억원)', ticker: 'KOSPI_TRADE_VALUE' },
  { id: '24', name: '고객예탁금 (단위:억원)', ticker: 'CUSTOMER_DEPOSITS' },
  { id: '25', name: '신용공여 잔고 (단위:억원)', ticker: 'CREDIT_BALANCE' },
  { id: '26', name: '반대매매금액 (단위:억원)', ticker: 'MARGIN_CALL', negativeFavorable: true },
  { id: '27', name: 'KOSPI200 야간 선물 지수', ticker: 'KOSPI200_NIGHT' },
  { id: '28', name: 'CDS 5Y Korea', ticker: 'CDS_KOREA' },
  { id: '29', name: '외환보유액', ticker: 'FX_RESERVES' },
];

async function getFearAndGreed() {
  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://edition.cnn.com/markets/fear-and-greed'
      },
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const score = data.fear_and_greed.score;
    const prev_close = data.fear_and_greed.previous_close;
    const changeAmt = score - prev_close;
    const changePercent = (changeAmt / prev_close) * 100;
    
    const hist = data.fear_and_greed_historical?.data || [];
    const hist_scores = hist.map((item: any) => ({
      date: new Date(item.x).toISOString(),
      value: item.y
    }));
    const history = hist_scores.slice(-60);
    
    return { score, changeAmt, changePercent, history };
  } catch (error) {
    console.error("Fear and Greed fetch error:", error);
    return null;
  }
}

export async function GET() {
  try {
    const results: IndicatorData[] = [];
    
    // Fear and greed
    const fgData = await getFearAndGreed();

    // Fetch KRX data from cache immediately (for ultra-fast response)
    let krxData: any = null;
    const scriptPath = path.join(process.cwd(), 'src/app/api/market-data/get_kospi_fundamentals.py');
    const cachePath = path.join(process.cwd(), 'src/app/api/market-data/krx_cache.json');

    try {
      if (fs.existsSync(cachePath)) {
        const cacheContent = fs.readFileSync(cachePath, 'utf-8');
        krxData = JSON.parse(cacheContent);
      }
    } catch (cacheErr) {
      console.error("Error reading KRX cache:", cacheErr);
    }

    // Trigger asynchronous background update to keep the cache fresh for next time
    try {
      exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
        if (!error && stdout) {
          try {
            const jsonStart = stdout.indexOf('{');
            if (jsonStart !== -1) {
              const parsed = JSON.parse(stdout.substring(jsonStart));
              if (parsed && !parsed.error) {
                fs.writeFileSync(cachePath, JSON.stringify(parsed, null, 2), 'utf-8');
                console.log("KRX cache updated successfully in background.");
              } else if (parsed && parsed.error) {
                console.error("KRX background update script returned error:", parsed.error);
              }
            } else {
              console.error("KRX background update did not output valid JSON:", stdout);
            }
          } catch (e) {
            // Ignore parse errors from background refresh
          }
        } else if (error) {
          console.error("Failed to execute KRX background update:", error);
        }
      });
    } catch (bgErr) {
      console.error("Failed to start background KRX update:", bgErr);
    }

    // Fetch WTI data from cache immediately (for ultra-fast response)
    let wtiData: any = null;
    const wtiScriptPath = path.join(process.cwd(), 'src/app/api/market-data/get_wti_crude_oil.py');
    const wtiCachePath = path.join(process.cwd(), 'src/app/api/market-data/wti_cache.json');

    try {
      if (fs.existsSync(wtiCachePath)) {
        const cacheContent = fs.readFileSync(wtiCachePath, 'utf-8');
        wtiData = JSON.parse(cacheContent);
      }
    } catch (wtiErr) {
      console.error("Error reading WTI cache:", wtiErr);
    }

    // Trigger asynchronous background update to keep the WTI cache fresh
    try {
      exec(`python "${wtiScriptPath}"`, (error, stdout, stderr) => {
        if (!error && stdout) {
          try {
            const jsonStart = stdout.indexOf('{');
            if (jsonStart !== -1) {
              const parsed = JSON.parse(stdout.substring(jsonStart));
              if (parsed && parsed.success) {
                console.log("WTI cache updated successfully in background.");
              } else if (parsed && parsed.error) {
                console.error("WTI background update script returned error:", parsed.error);
              }
            } else {
              console.error("WTI background update did not output valid JSON:", stdout);
            }
          } catch (e) {
            // Ignore parse errors
          }
        } else if (error) {
          console.error("Failed to execute WTI background update:", error);
        }
      });
    } catch (bgErr) {
      console.error("Failed to start background WTI update:", bgErr);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    for (const item of TICKERS) {
      let dataRow: IndicatorData = {
        id: item.id,
        name: item.name,
        ticker: item.ticker,
        price: null,
        changeAmt: null,
        changePercent: null,
        history: [],
        open: null,
        high: null,
        low: null,
        close: null,
        isNegativeFavorable: !!item.negativeFavorable,
        isOdd: false // calculated dynamically on frontend
      };

      if (item.ticker === 'KOSPI200_NIGHT') {
        if (krxData && krxData.kospi200_night) {
          dataRow.price = krxData.kospi200_night.price;
          dataRow.changeAmt = krxData.kospi200_night.changeAmt;
          dataRow.changePercent = krxData.kospi200_night.changePercent;
          dataRow.history = krxData.kospi200_night.history;
          dataRow.open = krxData.kospi200_night.open ?? null;
          dataRow.high = krxData.kospi200_night.high ?? null;
          dataRow.low = krxData.kospi200_night.low ?? null;
          dataRow.close = krxData.kospi200_night.close ?? null;
        }
      } else if (item.ticker === 'KOSPI200_FUTURES') {
        if (krxData && krxData.kospi200_futures) {
          dataRow.price = krxData.kospi200_futures.price;
          dataRow.changeAmt = krxData.kospi200_futures.changeAmt;
          dataRow.changePercent = krxData.kospi200_futures.changePercent;
          dataRow.history = krxData.kospi200_futures.history;
          dataRow.open = krxData.kospi200_futures.open ?? null;
          dataRow.high = krxData.kospi200_futures.high ?? null;
          dataRow.low = krxData.kospi200_futures.low ?? null;
          dataRow.close = krxData.kospi200_futures.close ?? null;
        }
      } else if (item.ticker === 'KOSPI_RSI') {
        if (krxData && krxData.kospi_rsi) {
          dataRow.price = krxData.kospi_rsi.price;
          dataRow.changeAmt = krxData.kospi_rsi.changeAmt;
          dataRow.changePercent = null; // Suppress change rate as requested by user
          dataRow.history = krxData.kospi_rsi.history;
        }
      } else if (item.ticker === 'ADR_INFO') {
        if (krxData && krxData.kospi_adr) {
          dataRow.price = krxData.kospi_adr.price;
          dataRow.changeAmt = krxData.kospi_adr.changeAmt;
          dataRow.changePercent = null; // Suppress change rate as requested by user
          dataRow.history = krxData.kospi_adr.history;
        }
      } else if (item.ticker === 'CDS_KOREA') {
        dataRow.isLinkOnly = true;
        dataRow.linkUrl = 'https://www.indexergo.com/series/?detailId=09201&frq=D';
      } else if (item.ticker === 'FX_RESERVES') {
        dataRow.isLinkOnly = true;
        dataRow.linkUrl = 'https://www.indexergo.com/series/?detailId=12501&frq=M';
      } else if (item.ticker === 'FEAR_GREED') {
        if (fgData) {
          dataRow.price = fgData.score;
          dataRow.changeAmt = fgData.changeAmt;
          dataRow.changePercent = fgData.changePercent;
          dataRow.history = fgData.history;
        }
      } else if (item.ticker === 'KOSPI_PER') {
        if (krxData && krxData.per) {
          dataRow.price = krxData.per.price;
          dataRow.changeAmt = krxData.per.changeAmt;
          dataRow.changePercent = krxData.per.changePercent;
          dataRow.history = krxData.per.history;
        }
      } else if (item.ticker === 'KOSPI_PBR') {
        if (krxData && krxData.pbr) {
          dataRow.price = krxData.pbr.price;
          dataRow.changeAmt = krxData.pbr.changeAmt;
          dataRow.changePercent = krxData.pbr.changePercent;
          dataRow.history = krxData.pbr.history;
        }
      } else if (item.ticker === 'KOSPI_TRADE_VALUE') {
        if (krxData && krxData.kospi_trade_value) {
          dataRow.price = krxData.kospi_trade_value.price;
          dataRow.changeAmt = krxData.kospi_trade_value.changeAmt;
          dataRow.changePercent = krxData.kospi_trade_value.changePercent;
          dataRow.history = krxData.kospi_trade_value.history;
        }
      } else if (item.ticker === 'CUSTOMER_DEPOSITS') {
        if (krxData && krxData.customer_deposits) {
          dataRow.price = krxData.customer_deposits.price;
          dataRow.changeAmt = krxData.customer_deposits.changeAmt;
          dataRow.changePercent = krxData.customer_deposits.changePercent;
          dataRow.history = krxData.customer_deposits.history;
        }
      } else if (item.ticker === 'CREDIT_BALANCE') {
        if (krxData && krxData.credit_balance) {
          dataRow.price = krxData.credit_balance.price;
          dataRow.changeAmt = krxData.credit_balance.changeAmt;
          dataRow.changePercent = krxData.credit_balance.changePercent;
          dataRow.history = krxData.credit_balance.history;
        }
      } else if (item.ticker === 'MARGIN_CALL') {
        if (krxData && krxData.margin_call) {
          dataRow.price = krxData.margin_call.price;
          dataRow.changeAmt = krxData.margin_call.changeAmt;
          dataRow.changePercent = krxData.margin_call.changePercent;
          dataRow.history = krxData.margin_call.history;
        }
      } else if (item.ticker === 'CL=F') {
        if (wtiData) {
          dataRow.price = wtiData.price;
          dataRow.open = wtiData.open;
          dataRow.high = wtiData.high;
          dataRow.low = wtiData.low;
          dataRow.close = wtiData.close;
          dataRow.changeAmt = wtiData.changeAmt;
          dataRow.changePercent = wtiData.changePercent;
          dataRow.history = wtiData.history;
        }
      } else {
        try {
          // Fetch quote first for the latest real-time stats
          let quote: any = null;
          try {
            quote = (await yahooFinance.quote(item.ticker)) as any;
          } catch (quoteErr) {
            console.error(`Error fetching quote for ${item.ticker}:`, quoteErr);
          }

          const queryOptions = { period1: startDate, period2: endDate, interval: '1d' as const };
          const result = (await yahooFinance.chart(item.ticker, queryOptions)) as any;
          
          if (result && result.quotes && result.quotes.length > 0) {
            // Map the quotes to history, but if the close is null and it's the last element, patch it with the quote price!
            const validQuotes = result.quotes.map((r: any, idx: number) => {
              if (r.close === null && idx === result.quotes.length - 1 && quote && quote.regularMarketPrice) {
                return { ...r, close: quote.regularMarketPrice };
              }
              return r;
            }).filter((r: any) => r.close !== null && r.date !== undefined);
            
            if (validQuotes.length > 0) {
              const historyClose = validQuotes.map((r: any) => ({
                date: r.date.toISOString(),
                value: r.close
              }));
              dataRow.history = historyClose.slice(-60);
              
              const last = validQuotes[validQuotes.length - 1];
              
              if (quote) {
                dataRow.price = quote.regularMarketPrice ?? last.close;
                dataRow.open = quote.regularMarketOpen ?? last.open;
                dataRow.high = quote.regularMarketDayHigh ?? last.high;
                dataRow.low = quote.regularMarketDayLow ?? last.low;
                dataRow.close = quote.regularMarketPrice ?? last.close;
                if (quote.regularMarketChange !== undefined) {
                  dataRow.changeAmt = quote.regularMarketChange;
                  dataRow.changePercent = quote.regularMarketChangePercent;
                } else if (validQuotes.length >= 2) {
                  const prev = validQuotes[validQuotes.length - 2];
                  if (dataRow.price !== null && prev.close !== null) {
                    dataRow.changeAmt = dataRow.price - prev.close;
                    dataRow.changePercent = (dataRow.changeAmt / prev.close) * 100;
                  }
                }
              } else {
                dataRow.price = last.close;
                dataRow.open = last.open;
                dataRow.high = last.high;
                dataRow.low = last.low;
                dataRow.close = last.close;
                if (validQuotes.length >= 2) {
                  const prev = validQuotes[validQuotes.length - 2];
                  if (last.close !== null && prev.close !== null) {
                    dataRow.changeAmt = last.close - prev.close;
                    dataRow.changePercent = (dataRow.changeAmt / prev.close) * 100;
                  }
                }
              }
            }
          } else {
             // Fallback to quote alone
             const activeQuote = quote || (await yahooFinance.quote(item.ticker)) as any;
             if (activeQuote && activeQuote.regularMarketPrice) {
               dataRow.price = activeQuote.regularMarketPrice;
               dataRow.open = activeQuote.regularMarketOpen || null;
               dataRow.high = activeQuote.regularMarketDayHigh || null;
               dataRow.low = activeQuote.regularMarketDayLow || null;
               dataRow.close = activeQuote.regularMarketPrice;
               if (activeQuote.regularMarketPreviousClose) {
                 dataRow.changeAmt = activeQuote.regularMarketPrice - activeQuote.regularMarketPreviousClose;
                 dataRow.changePercent = activeQuote.regularMarketChangePercent || ((dataRow.changeAmt / activeQuote.regularMarketPreviousClose) * 100);
               }
             }
          }
        } catch (e) {
          console.error(`Error fetching ${item.ticker}:`, e);
        }
      }
      results.push(dataRow);
    }
    
    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
