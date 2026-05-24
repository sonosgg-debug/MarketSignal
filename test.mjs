import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const result = await yahooFinance.quote('^GSPC');
    console.log("Quote result keys:", Object.keys(result));
    console.log("Price:", result.regularMarketPrice, "PrevClose:", result.regularMarketPreviousClose);
  } catch(e) {
    console.error("Error:", e);
  }
}

test();
