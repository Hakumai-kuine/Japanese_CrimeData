"use client";

import React, { useEffect, useState, useRef } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

interface CrimeRecord {
  Year: number;
  RegionID: number;
  RegionName: string;
  CrimeType: string;
  CaseCount: number;
  RatePer100k: number;
  ClearedCount: number;
  ClearedPersons: number;
  ClearanceRate: number;
}

interface MapChartProps {
  year: number;
  selectedCrime: string;
  selectedRegions: number[];
  onRegionClick: (regionId: number, regionName: string) => void;
  crimeData: CrimeRecord[];
  metric: "cases" | "cleared" | "persons" | "rate";
  isPer100k: boolean;
  scaleMode: "auto" | "fixed" | "custom";
  customMaxVal: number;
}

export default function MapChart({
  year,
  selectedCrime,
  selectedRegions,
  onRegionClick,
  crimeData,
  metric,
  isPer100k,
  scaleMode,
  customMaxVal
}: MapChartProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const chartRef = useRef<ReactECharts>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch and register the custom GeoJSON of Japan
  useEffect(() => {
    fetch("/japan_custom.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        echarts.registerMap("japan", geojson);
        setMapLoaded(true);
      })
      .catch((err) => console.error("Error loading GeoJSON map:", err));
  }, []);

  // Filter data for the current year and selected crime type
  const currentYearData = crimeData.filter(
    (r) => r.Year === year && r.CrimeType === selectedCrime
  );
  
  // Also get previous year data for YoY calculations
  const prevYearData = crimeData.filter(
    (r) => r.Year === (year - 1) && r.CrimeType === selectedCrime
  );

  // Helper to get region population dynamically
  const getPopulation = (curr: CrimeRecord) => {
    if (curr.RatePer100k > 0 && curr.CaseCount > 0) {
      return (curr.CaseCount / curr.RatePer100k) * 100000;
    }
    return 1000000; // fallback
  };

  const getRawMetricValue = (rec: CrimeRecord) => {
    return metric === "rate"
      ? rec.ClearanceRate
      : metric === "cases"
      ? rec.CaseCount
      : metric === "cleared"
      ? rec.ClearedCount
      : rec.ClearedPersons;
  };

  // Map region ID to YoY data (cases/cleared/persons/rate depending on selection)
  const getMetricValue = (rec: CrimeRecord) => {
    const rawVal = getRawMetricValue(rec);
    if (rawVal === -1) {
      return -1;
    }
    if (metric === "rate") {
      return rawVal;
    }
    if (isPer100k) {
      const pop = getPopulation(rec);
      return (rawVal / pop) * 100000;
    }
    return rawVal;
  };

  const getMetricLabel = () => {
    if (metric === "rate") return "検挙率 (%)";
    const base = metric === "cases" ? "認知件数" : metric === "cleared" ? "検挙件数" : "検挙人員";
    return isPer100k ? `${base} (10万人あたり)` : `${base} (実数)`;
  };

  const yoyMap = new Map<number, { diff: number; pct: number | null }>();
  currentYearData.forEach((curr) => {
    const prev = prevYearData.find((p) => p.RegionID === curr.RegionID);
    const currVal = getMetricValue(curr);
    
    if (prev) {
      const prevVal = getMetricValue(prev);
      const diff = currVal - prevVal;
      const pct = prevVal > 0 ? (diff / prevVal) * 100 : null;
      yoyMap.set(curr.RegionID, { diff, pct });
    } else {
      yoyMap.set(curr.RegionID, { diff: 0, pct: null });
    }
  });

  // Prepare map data for ECharts
  const isForeignCrime = selectedCrime.startsWith("来日外国人");

  const mapData = currentYearData.map((r) => {
    const val = getMetricValue(r);
    const yoy = yoyMap.get(r.RegionID);
    const isSelected = selectedRegions.includes(r.RegionID);
    const isDataMissing = getRawMetricValue(r) === -1;
    
    // Custom itemStyle if selected or missing
    let customItemStyle = undefined;
    if (isSelected) {
      customItemStyle = {
        areaColor: "#f43f5e", // Rose pink for selected regions
        borderColor: "#ffffff",
        borderWidth: 2,
        shadowBlur: 8,
        shadowColor: "rgba(244, 63, 94, 0.6)"
      };
    } else if (isForeignCrime && isDataMissing) {
      customItemStyle = {
        areaColor: "rgba(51, 65, 85, 0.35)", // slate-700 with opacity to look greyed out
        borderColor: "rgba(71, 85, 105, 0.2)",
        borderWidth: 0.5
      };
    }

    return {
      name: r.RegionName,
      value: val,
      id: r.RegionID,
      cases: r.CaseCount,
      cleared: r.ClearedCount,
      persons: r.ClearedPersons,
      clearanceRate: r.ClearanceRate,
      metricVal: val,
      yoyDiff: yoy ? yoy.diff : 0,
      yoyPct: yoy ? yoy.pct : null,
      selected: isSelected,
      isDataMissing: isDataMissing,
      itemStyle: customItemStyle
    };
  });

  // Calculate dynamic maximum value for visualMap scaling
  // If metric is Clearance Rate, maximum is always 100%.
  // Otherwise calculate based on scaleMode.
  let maxVal = 100;
  if (metric === "rate") {
    maxVal = 100;
  } else if (scaleMode === "custom") {
    maxVal = customMaxVal;
  } else if (scaleMode === "fixed") {
    // Max value across ALL years for this crime type (excluding national total RegionID 999)
    const allYearsData = crimeData.filter((r) => r.CrimeType === selectedCrime && r.RegionID !== 999);
    const mapMaxValues = allYearsData.map((r) => getMetricValue(r)).filter((v) => v >= 0);
    maxVal = mapMaxValues.length > 0 ? Math.max(...mapMaxValues) : 100;
  } else {
    // scaleMode === "auto": Max value of the CURRENT year only
    const validValues = mapData.filter((d) => !d.isDataMissing).map((d) => d.value);
    maxVal = validValues.length > 0 ? Math.max(...validValues) : 100;
  }

  // Choose a color palette depending on metric
  // Clearance rate uses Green/Emerald scale (high is good), crimes use Indigo/Pink scale (high is bad)
  const colorRange = metric === "rate"
    ? ["rgba(30, 41, 59, 0.6)", "#e11d48", "#f59e0b", "#10b981"] // Red (low) -> Yellow -> Green (high)
    : ["rgba(30, 41, 59, 0.6)", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"]; // Blue -> Indigo -> Pink

  // ECharts Configuration
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        if (!params.data) return params.name;
        const d = params.data;
        const label = getMetricLabel();
        
        if (isForeignCrime) {
          if (d.isDataMissing) {
            return `
              <div class="p-2.5 font-sans text-xs bg-slate-900/90 text-slate-100 border border-slate-700/50 rounded-lg backdrop-blur-md">
                <div class="font-bold text-sm mb-1 text-purple-300 border-b border-slate-700/50 pb-1">${d.name}</div>
                <div class="py-1 text-slate-400 italic">この地域・年度のデータは非公表または未取得です。</div>
                <div class="text-[10px] text-slate-500 mt-1.5 border-t border-slate-800/80 pt-1">
                  大阪府・埼玉県・愛知県（人員のみ）のデータが利用可能です。
                </div>
              </div>
            `;
          } else {
            const casesStr = "構造上定義なし";
            const clearedStr = d.cleared >= 0 ? `${d.cleared.toLocaleString()} 件` : "非公表 / 未取得";
            const personsStr = d.persons >= 0 ? `${d.persons.toLocaleString()} 人` : "非公表 / 未取得";
            const rateStr = "構造上定義なし";
            const valStr = d.metricVal >= 0 ? d.metricVal.toFixed(isPer100k ? 2 : 0) : "非公表 / 未取得";

            let yoyText = "前年データなし";
            let yoyColor = "text-slate-400";
            if (d.yoyPct !== null && d.yoyDiff >= -500000) { // check if yoy is valid
              const sign = d.yoyDiff >= 0 ? "+" : "";
              const diffStr = `${d.yoyDiff.toFixed(0)}`;
              yoyText = `${sign}${diffStr} (${sign}${d.yoyPct.toFixed(1)}%)`;
              yoyColor = d.yoyDiff < 0 ? "text-emerald-400" : d.yoyDiff > 0 ? "text-rose-400" : "text-slate-400";
            }

            return `
              <div class="p-2.5 font-sans text-xs bg-slate-900/90 text-slate-100 border border-slate-700/50 rounded-lg backdrop-blur-md">
                <div class="font-bold text-sm mb-1 text-purple-300 border-b border-slate-700/50 pb-1">${d.name} (来日外国人犯罪)</div>
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400">認知件数:</span>
                  <span class="font-medium text-slate-500 italic">${casesStr}</span>
                </div>
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400">検挙件数:</span>
                  <span class="font-semibold text-slate-200">${clearedStr}</span>
                </div>
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400">検挙人員:</span>
                  <span class="font-semibold text-slate-200">${personsStr}</span>
                </div>
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400">検挙率:</span>
                  <span class="font-medium text-slate-500 italic">${rateStr}</span>
                </div>
                
                <div class="border-t border-slate-800/80 my-1.5"></div>
                
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400 font-medium">${label}:</span>
                  <span class="font-bold text-purple-300">${valStr}</span>
                </div>
                <div class="flex justify-between gap-4 py-0.5">
                  <span class="text-slate-400 font-medium">前年比増減:</span>
                  <span class="font-bold ${yoyColor}">${yoyText}</span>
                </div>
                
                <div class="text-[10px] text-purple-400/80 mt-1 border-t border-slate-800/80 pt-1">
                  クリックでトレンド比較に追加/削除
                </div>
              </div>
            `;
          }
        }

        // Format YoY change string
        let yoyText = "前年データなし";
        let yoyColor = "text-slate-400";
        if (d.yoyPct !== null) {
          const sign = d.yoyDiff >= 0 ? "+" : "";
          const diffStr = metric === "rate" ? `${d.yoyDiff.toFixed(1)}%` : `${d.yoyDiff.toFixed(1)}`;
          yoyText = `${sign}${diffStr} (${sign}${d.yoyPct.toFixed(1)}%)`;
          
          if (metric === "rate") {
            // High clearance rate is good (green is positive change, red is negative change)
            yoyColor = d.yoyDiff > 0 ? "text-emerald-400" : d.yoyDiff < 0 ? "text-rose-400" : "text-slate-400";
          } else {
            // High crime metric is bad (green is negative change/decrease, red is positive change/increase)
            yoyColor = d.yoyDiff < 0 ? "text-emerald-400" : d.yoyDiff > 0 ? "text-rose-400" : "text-slate-400";
          }
        }
        
        return `
          <div class="p-2 font-sans text-xs bg-slate-900/90 text-slate-100 border border-slate-700/50 rounded-lg backdrop-blur-md">
            <div class="font-bold text-sm mb-1 text-indigo-300 border-b border-slate-700 pb-1">${d.name}</div>
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400">認知件数:</span>
              <span class="font-semibold text-slate-200">${d.cases.toLocaleString()} 件</span>
            </div>
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400">検挙件数:</span>
              <span class="font-semibold text-slate-200">${d.cleared.toLocaleString()} 件</span>
            </div>
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400">検挙人員:</span>
              <span class="font-semibold text-slate-200">${d.persons.toLocaleString()} 人</span>
            </div>
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400">検挙率:</span>
              <span class="font-semibold text-emerald-400">${d.clearanceRate.toFixed(1)} %</span>
            </div>
            
            <div class="border-t border-slate-800/80 my-1.5"></div>
            
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400 font-medium">${label}:</span>
              <span class="font-bold text-indigo-300">${d.metricVal.toFixed(metric === "rate" ? 1 : isPer100k ? 2 : 0)}</span>
            </div>
            <div class="flex justify-between gap-4 py-0.5">
              <span class="text-slate-400 font-medium">前年比増減:</span>
              <span class="font-bold ${yoyColor}">${yoyText}</span>
            </div>
            
            <div class="text-[10px] text-indigo-400/80 mt-1 border-t border-slate-800/80 pt-1">
              クリックでトレンド比較に追加/削除
            </div>
          </div>
        `;
      },
      padding: 0,
      backgroundColor: "transparent",
      borderWidth: 0,
      extraCssText: "box-shadow: none;"
    },
    visualMap: {
      min: 0,
      max: maxVal || 10,
      left: isMobile ? "center" : "5%",
      bottom: isMobile ? "2%" : "5%",
      orient: isMobile ? "horizontal" : "vertical",
      text: ["高", "低"],
      realtime: false,
      calculable: true,
      inRange: {
        color: colorRange
      },
      textStyle: {
        color: "#94a3b8",
        fontSize: 10
      },
      itemWidth: isMobile ? 12 : 20,
      itemHeight: isMobile ? 100 : 140
    },
    series: [
      {
        name: "日本犯罪統計",
        type: "map",
        map: "japan",
        nameProperty: "nam_ja", // Matches properties.nam_ja in GeoJSON
        roam: !isMobile, // Disable zoom and pan on mobile to allow scrolling the page
        scaleLimit: {
          min: 1,
          max: 5
        },
        label: {
          show: false,
          color: "#ffffff",
          fontSize: 10
        },
        itemStyle: {
          areaColor: "rgba(30, 41, 59, 0.4)",
          borderColor: "rgba(100, 116, 139, 0.4)",
          borderWidth: 0.8
        },
        select: {
          disabled: true // Manage select manually
        },
        emphasis: {
          label: {
            show: false
          },
          itemStyle: {
            areaColor: "#4f46e5",
            borderColor: "#ffffff",
            borderWidth: 1.2,
            shadowBlur: 5,
            shadowColor: "rgba(79, 70, 229, 0.6)"
          }
        },
        data: mapData
      }
    ]
  };

  // Handle click on map regions
  const onEvents = {
    click: (params: any) => {
      if (params.data) {
        onRegionClick(params.data.id, params.data.name);
      }
    }
  };

  if (!mapLoaded) {
    return (
      <div 
        className="flex items-center justify-center w-full bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800/80"
        style={{ height: isMobile ? "380px" : "550px" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">地図データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* 
        CRITICAL: We use notMerge={false} to preserve the map zoom/pan (roam) state 
        during data updates (timeline playback or metric changes)
      */}
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ width: "100%", height: isMobile ? "380px" : "550px" }}
        onEvents={onEvents}
        notMerge={false}
      />
    </div>
  );
}
