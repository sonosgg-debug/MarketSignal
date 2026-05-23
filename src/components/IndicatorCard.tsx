"use client";

import { IndicatorData } from "@/types";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

interface Props {
  data: IndicatorData;
}

export function IndicatorCard({ data }: Props) {
  const {
    name,
    price,
    changeAmt,
    changePercent,
    history,
    isNegativeFavorable,
    isOdd,
    isLinkOnly,
    linkUrl,
  } = data;

  const isPositive = changeAmt !== null && changeAmt > 0;
  const isNegative = changeAmt !== null && changeAmt < 0;

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

  const chartData = history.map((val, i) => ({ value: val, index: i }));
  const strokeColor = isOdd ? "#eab308" : "#94a3b8"; // Yellow for odd, Slate for even

  if (isLinkOnly) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="glass rounded-xl p-5 flex flex-col justify-between hover:bg-card/80 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 group cursor-pointer h-full min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-muted-foreground text-sm line-clamp-2 pr-2">{name}</h3>
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
          {name}
        </h3>
        {changePercent !== null && (
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-semibold ${badgeBg} whitespace-nowrap`}>
            {icon}
            {formattedPercent}
          </div>
        )}
      </div>

      <div className="mt-2 z-10 relative flex justify-between items-end">
        <div>
          <div className="text-2xl font-bold tracking-tight">{formattedPrice}</div>
          <div className={`text-sm mt-1 font-medium ${valueColor}`}>
            {isPositive ? "+" : isNegative ? "-" : ""}
            {formattedChange}
          </div>
        </div>
        
        {/* Sparkline */}
        <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={["dataMin", "dataMax"]} hide />
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
