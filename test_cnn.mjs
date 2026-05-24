async function test() {
  const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const data = await res.json();
  const hist = data.fear_and_greed_historical.data.slice(-1)[0];
  console.log(hist);
}
test();
