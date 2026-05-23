"use client";

import { useEffect, useState } from "react";
import { IndicatorData } from "@/types";
import { IndicatorCard } from "./IndicatorCard";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export function Dashboard() {
  const [data, setData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
            Market Signal Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Daily Investment Indicators & Market Overview
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {data.map((item) => (
          <IndicatorCard key={item.id} data={item} />
        ))}
      </div>
    </div>
  );
}
