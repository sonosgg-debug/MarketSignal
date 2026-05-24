"use client";

import { useEffect, useState } from "react";
import { IndicatorData } from "@/types";
import { IndicatorCard } from "./IndicatorCard";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["US Market", "K Market"];

export function Dashboard() {
  const [data, setData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("US Market");

  const fetchData = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      const res = await fetch("/api/market-data", {
        cache: refresh ? "no-store" : "default",
      });
      if (!res.ok) throw new Error("Failed to fetch data");
      const result: IndicatorData[] = await res.json();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-foreground">Loading Market Data...</h2>
        <p className="text-muted-foreground mt-2">Fetching the latest indicators from Yahoo Finance & CNN</p>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-destructive">
        <h2 className="text-2xl font-bold mb-2">Error Loading Data</h2>
        <p>{error}</p>
        <button 
          onClick={() => fetchData(true)}
          className="mt-6 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // 필터링 로직
  const filteredData = data.filter((item) => {
    const isKMarket = item.ticker === "KOSPI200_NIGHT" || item.ticker === "ADR_INFO" || item.ticker === "CDS_KOREA" || item.ticker === "FX_RESERVES";
    
    if (selectedCategory === "US Market") {
      return !isKMarket;
    } else if (selectedCategory === "K Market") {
      return isKMarket;
    }
    return true;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
      {/* Sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <div className="glass rounded-xl p-4 sticky top-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Markets</h2>
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-left px-4 py-3 rounded-lg transition-all font-medium whitespace-nowrap ${
                  selectedCategory === cat 
                    ? "bg-primary/20 text-primary shadow-sm" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
              {selectedCategory} Overview
            </h1>
            <p className="text-muted-foreground mt-1">
              Daily Investment Indicators & Market Signals
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Updated: {format(lastUpdated, "HH:mm:ss")}
              </span>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-2 rounded-full glass hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredData.map((item, index) => (
            <IndicatorCard key={item.id} data={item} displayIndex={index + 1} />
          ))}
          {filteredData.length === 0 && (
            <div className="col-span-full glass p-8 text-center text-muted-foreground rounded-xl">
              No indicators available for this market.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
