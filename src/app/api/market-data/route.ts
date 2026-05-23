import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { IndicatorData } from '@/types';

const TICKERS = [
  { id: '01', name: '미국 S&P 500 지수', ticker: '^GSPC' },
  { id: '02', name: '미국 나스닥 지수', ticker: '^IXIC' },
  { id: '03', name: '필라델피아 반도체 지수(SOX)', ticker: '^SOX' },
  { id: '04', name: 'CBOE VIX', ticker: '^VIX', negativeFavorable: true },
  { id: '05', name: 'CNN Fear & Greed Index', ticker: 'FEAR_GREED' },
  { id: '06', name: '엔비디아(NVDA)', ticker: 'NVDA' },
  { id: '07', name: '마이크론(MU)', ticker: 'MU' },
  { id: '08', name: '샌디스크(SNDK)', ticker: 'SNDK' },
  { id: '09', name: 'DRAM (Roundhill ETF)', ticker: 'DRAM' },
  { id: '10', name: '미국 달러 지수(USD Index)', ticker: 'DX-Y.NYB', negativeFavorable: true },
  { id: '11', name: 'EWY (MSCI South Korea ETF)', ticker: 'EWY' },
  { id: '12', name: 'USD/KRW 환율', ticker: 'KRW=X', negativeFavorable: true },
  { id: '13', name: 'KOSPI200 야간 선물 지수', ticker: 'KOSPI200_NIGHT', negativeFavorable: true },
  { id: '14', name: 'Crude Oil WTI (CME Globex)', ticker: 'CL=F', negativeFavorable: true },
  { id: '15', name: '미국 국채 10년물 금리(TNX)', ticker: '^TNX', negativeFavorable: true },
  { id: '16', name: '비트코인(BTC-USD) 가격', ticker: 'BTC-USD' },
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
    const hist_scores = hist.map((item: any) => item.y);
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

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    for (const item of TICKERS) {
      const isOdd = parseInt(item.id, 10) % 2 !== 0;
      let dataRow: IndicatorData = {
        id: item.id,
        name: `${item.id}. ${item.name}`,
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
        isOdd
      };

      if (item.ticker === 'KOSPI200_NIGHT') {
        dataRow.isLinkOnly = true;
        dataRow.linkUrl = 'https://esignal.co.kr/kospi200-futures-night/';
      } else if (item.ticker === 'FEAR_GREED') {
        if (fgData) {
          dataRow.price = fgData.score;
          dataRow.changeAmt = fgData.changeAmt;
          dataRow.changePercent = fgData.changePercent;
          dataRow.history = fgData.history;
        }
      } else {
        try {
          const queryOptions = { period1: startDate, period2: endDate, interval: '1d' as const };
          const result = (await yahooFinance.historical(item.ticker, queryOptions)) as any[];
          
          if (result && result.length > 0) {
            const historyClose = result.map(r => r.close);
            dataRow.history = historyClose.slice(-60);
            
            const last = result[result.length - 1];
            dataRow.price = last.close;
            dataRow.open = last.open;
            dataRow.high = last.high;
            dataRow.low = last.low;
            dataRow.close = last.close;

            if (result.length >= 2) {
              const prev = result[result.length - 2];
              dataRow.changeAmt = last.close - prev.close;
              dataRow.changePercent = (dataRow.changeAmt / prev.close) * 100;
            } else {
              // Try to get quote if historical only has 1
              const quote = (await yahooFinance.quote(item.ticker)) as any;
              if (quote && quote.regularMarketPreviousClose) {
                dataRow.changeAmt = last.close - quote.regularMarketPreviousClose;
                dataRow.changePercent = (dataRow.changeAmt / quote.regularMarketPreviousClose) * 100;
              }
            }
          } else {
             // Fallback to quote
             const quote = (await yahooFinance.quote(item.ticker)) as any;
             if (quote && quote.regularMarketPrice) {
               dataRow.price = quote.regularMarketPrice;
               dataRow.open = quote.regularMarketOpen || null;
               dataRow.high = quote.regularMarketDayHigh || null;
               dataRow.low = quote.regularMarketDayLow || null;
               dataRow.close = quote.regularMarketPrice;
               if (quote.regularMarketPreviousClose) {
                 dataRow.changeAmt = quote.regularMarketPrice - quote.regularMarketPreviousClose;
                 dataRow.changePercent = quote.regularMarketChangePercent || ((dataRow.changeAmt / quote.regularMarketPreviousClose) * 100);
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
