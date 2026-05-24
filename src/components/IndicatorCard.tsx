"use client";

import { IndicatorData } from "@/types";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

interface Props {
  data: IndicatorData;
  displayIndex?: number;
}

// 미니 일봉 캔들 컴포넌트
function DailyCandle({ o, h, l, c }: { o: number; h: number; l: number; c: number }) {
  const isRise = c >= o;
  const colorClass = isRise ? "bg-red-500" : "bg-blue-500"; // 한국식: 상승(Red), 하락(Blue)
  
  // 상대적 비율 계산을 위해 최댓값, 최솟값 범위를 구합니다.
  const range = h - l || 1; // 0 나누기 방지
  const heightPx = 32; // 캔들의 전체 높이 픽셀
  const scale = heightPx / range;

  const topY = (h - Math.max(o, c)) * scale;
  const bottomY = (Math.min(o, c) - l) * scale;
  const bodyHeight = Math.max(Math.abs(c - o) * scale, 2); // 최소 2px 두께

  return (
    <div className="flex flex-col items-center justify-center w-6 h-[32px] relative" title={`O:${o.toFixed(2)} H:${h.toFixed(2)} L:${l.toFixed(2)} C:${c.toFixed(2)}`}>
      {/* 윗꼬리 */}
      <div className={`w-[2px] ${colorClass}`} style={{ height: topY }} />
      {/* 몸통 */}
      <div className={`w-full ${colorClass}`} style={{ height: bodyHeight }} />
      {/* 아랫꼬리 */}
      <div className={`w-[2px] ${colorClass}`} style={{ height: bottomY }} />
    </div>
  );
}

export function IndicatorCard({ data, displayIndex }: Props) {
  const {
    name,
    price,
    changeAmt,
    changePercent,
    history,
    open,
    high,
    low,
    close,
    isNegativeFavorable,
    isOdd,
    isLinkOnly,
    linkUrl,
  } = data;

  const isPositive = changeAmt !== null && changeAmt > 0;
  const isNegative = changeAmt !== null && changeAmt < 0;

  const displayName = displayIndex !== undefined ? `${String(displayIndex).padStart(2, '0')}. ${name}` : name;

  // Determine colors based on favorable conditions
  let valueColor = "text-foreground";
  let badgeBg = "bg-muted text-muted-foreground";
  let icon = null;

  if (isPositive) {
    icon = <ArrowUpRight className="w-4 h-4 mr-1" />;
    if (isNegativeFavorable) {
      valueColor = "text-red-500";
      badgeBg = "bg-red-500/10 text-red-500";
    } else {
      valueColor = "text-green-500";
      badgeBg = "bg-green-500/10 text-green-500";
    }
  } else if (isNegative) {
    icon = <ArrowDownRight className="w-4 h-4 mr-1" />;
    if (isNegativeFavorable) {
      valueColor = "text-green-500";
      badgeBg = "bg-green-500/10 text-green-500";
    } else {
      valueColor = "text-red-500";
      badgeBg = "bg-red-500/10 text-red-500";
    }
  }

  const chartData = history.map((item, i) => {
    const d = new Date(item.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    return { value: item.value, date: dateStr };
  });
  
  const isItemOdd = displayIndex !== undefined ? displayIndex % 2 !== 0 : isOdd;
  const strokeColor = isItemOdd ? "#eab308" : "#94a3b8"; // Yellow for odd, Slate for even

  if (isLinkOnly) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="glass rounded-xl p-5 flex flex-col justify-between hover:bg-card/80 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 group cursor-pointer h-full min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-muted-foreground text-sm line-clamp-2 pr-2">{displayName}</h3>
          <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-foreground">Click to view</p>
          <p className="text-sm text-muted-foreground mt-1">Data not available directly</p>
        </div>
      </a>
    );
  }

  const formattedPrice = price !== null ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A";
  const formattedChange = changeAmt !== null ? Math.abs(changeAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
  const formattedPercent = changePercent !== null ? Math.abs(changePercent).toFixed(2) + "%" : "-";

  return (
    <div className="glass rounded-xl p-5 flex flex-col justify-between hover:bg-card/80 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 relative overflow-hidden group min-h-[160px]">
      <div className="flex justify-between items-start mb-2 z-10 relative">
        <h3 className="font-medium text-muted-foreground text-sm pr-4 line-clamp-2 leading-tight">
          {displayName}
        </h3>
      </div>

      <div className="mt-2 z-10 relative flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold tracking-tight">{formattedPrice}</div>
            {/* 일봉 캔들 표시 */}
            {open !== null && high !== null && low !== null && close !== null && (
              <div className="ml-1 opacity-90">
                <DailyCandle o={open} h={high} l={low} c={close} />
              </div>
            )}
          </div>
          <div className={`flex items-center text-sm mt-1 font-medium ${valueColor}`}>
            {icon}
            <span>
              {isPositive ? "+" : isNegative ? "-" : ""}
              {formattedChange}
              {changePercent !== null && ` (${isPositive ? "+" : isNegative ? "-" : ""}${formattedPercent})`}
            </span>
          </div>
        </div>
        
        {/* Sparkline */}
        <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity relative z-20">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(24,24,27,0.4)', 
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    border: '1px solid rgba(63,63,70,0.5)', 
                    borderRadius: '6px', 
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                  itemStyle={{ color: '#fafafa' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '4px', fontSize: '11px' }}
                  formatter={(value: any) => {
                    if (typeof value === 'number') return [value.toLocaleString(undefined, { minimumFractionDigits: 2 }), ""];
                    return [value, ""];
                  }}
                  labelFormatter={(label) => label}
                  separator=""
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-end text-xs text-muted-foreground">No data</div>
          )}
        </div>
      </div>
      
      {/* Decorative background glow */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors z-0" />
    </div>
  );
}
