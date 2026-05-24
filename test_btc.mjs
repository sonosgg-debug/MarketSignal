import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function test() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  const queryOptions = { period1: startDate, period2: endDate, interval: '1d' };

  try {
    const result = await yahooFinance.chart('BTC-USD', queryOptions);
    console.log("Last 5 quotes:", result.quotes.slice(-5));
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
