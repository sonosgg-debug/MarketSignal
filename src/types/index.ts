export interface IndicatorData {
  id: string;
  name: string;
  ticker: string;
  price: number | null;
  changeAmt: number | null;
  changePercent: number | null;
  history: { date: string; value: number }[]; // 60-day history with dates
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  isNegativeFavorable: boolean;
  isOdd: boolean;
  isLinkOnly?: boolean;
  linkUrl?: string;
  isStale?: boolean;
}
