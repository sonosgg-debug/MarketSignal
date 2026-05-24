const lastClose = 76785.7890625;
const prevClose = null;

const changeAmt = lastClose - prevClose;
console.log("changeAmt:", changeAmt); // 76785.7890625

const changePercent = (changeAmt / prevClose) * 100;
console.log("changePercent:", changePercent); // Infinity
