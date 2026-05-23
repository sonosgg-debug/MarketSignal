export interface IndicatorData {
  id: string;
  name: string;
  ticker: string;
  price: number | null;
  changeAmt: number | null;
  changePercent: number | null;
  history: number[]; // 60-day history for sparklines
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  isNegativeFavorable: boolean;
  isOdd: boolean;
  isLinkOnly?: boolean;
  linkUrl?: string;
}
