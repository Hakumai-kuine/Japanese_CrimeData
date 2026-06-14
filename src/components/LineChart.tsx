"use client";

import React, { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";

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

interface LineChartProps {
  selectedCrime: string;
  selectedRegions: number[];
  crimeData: CrimeRecord[];
  metric: "cases" | "cleared" | "persons" | "rate";
  isPer100k: boolean;
  scaleMode: "auto" | "fixed" | "custom";
  customMaxVal: number;
}

export default function LineChart({
  selectedCrime,
  selectedRegions,
  crimeData,
  metric,
  isPer100k,
  scaleMode,
  customMaxVal
}: LineChartProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Years list from 2008 to 2025
  const years = Array.from({ length: 18 }, (_, i) => 2008 + i);

  // Group crime data by region and year for the selected crime type
  const filteredData = crimeData.filter((r) => r.CrimeType === selectedCrime);

  const seriesData: any[] = [];
  const legendData: string[] = [];

  // Line Colors Palette
  const colors = [
    "#ec4899", // Pink
    "#3b82f6", // Blue
    "#10b981", // Emerald Green
    "#f59e0b", // Amber Yellow
    "#8b5cf6", // Purple
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#14b8a6", // Teal
  ];

  // Helper to extract population from a record
  const getPopulation = (rec: CrimeRecord) => {
    if (rec.RatePer100k > 0 && rec.CaseCount > 0) {
      return (rec.CaseCount / rec.RatePer100k) * 100000;
    }
    return 1000000; // fallback
  };

  // Helper to get metric value per record
  const getRecordValue = (rec: CrimeRecord) => {
    const rawVal = metric === "rate"
      ? rec.ClearanceRate
      : metric === "cases"
      ? rec.CaseCount
      : metric === "cleared"
      ? rec.ClearedCount
      : rec.ClearedPersons;

    // If data is missing/unpublished (-1), return null so ECharts doesn't plot it
    if (rawVal === -1) {
      return null;
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

  const isForeignCrime = selectedCrime.startsWith("来日外国人");

  // Calculate national population by summing region populations in 2008
  const baseYearRecords = filteredData.filter((r) => r.Year === 2008);
  const nationalPopulation = baseYearRecords.reduce((sum, r) => sum + getPopulation(r), 0) || 125000000;

  if (selectedRegions.length === 0) {
    // If no specific regions are selected, show "全国" (National Total)
    legendData.push("全国（合計）");
    
    let nationalData;
    if (isForeignCrime) {
      // For foreign crimes, load pre-calculated national data directly from RegionID 999
      const nationalRecords = filteredData.filter((r) => r.RegionID === 999);
      nationalData = years.map((year) => {
        const rec = nationalRecords.find((r) => r.Year === year);
        return rec ? getRecordValue(rec) : null;
      });
    } else {
      nationalData = years.map((year) => {
        const yearRecords = filteredData.filter((r) => r.Year === year);
        
        if (metric === "rate") {
          // Clearance rate is Sum of ClearedCount / Sum of CaseCount
          const totalCases = yearRecords.reduce((sum, r) => sum + r.CaseCount, 0);
          const totalCleared = yearRecords.reduce((sum, r) => sum + r.ClearedCount, 0);
          return totalCases > 0 ? (totalCleared / totalCases) * 100 : 0;
        }
        
        // Calculate raw sum first
        const rawSum = yearRecords.reduce((sum, r) => {
          const val = metric === "cases"
            ? r.CaseCount
            : metric === "cleared"
            ? r.ClearedCount
            : r.ClearedPersons;
          return sum + val;
        }, 0);
        
        if (isPer100k) {
          return (rawSum / nationalPopulation) * 100000;
        }
        return rawSum;
      });
    }

    seriesData.push({
      name: "全国（合計）",
      type: "line",
      data: nationalData,
      smooth: true,
      symbolSize: 6,
      connectNulls: false, // Don't connect points over missing years
      lineStyle: {
        width: 3,
        color: isForeignCrime ? "#8b5cf6" : "#6366f1" // Purple for foreign crime, Indigo otherwise
      },
      itemStyle: {
        color: isForeignCrime ? "#8b5cf6" : "#6366f1"
      },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: isForeignCrime ? "rgba(139, 92, 246, 0.2)" : "rgba(99, 102, 241, 0.2)" },
            { offset: 1, color: "rgba(99, 102, 241, 0.0)" }
          ]
        }
      }
    });
  } else {
    // Show a line for each selected region
    selectedRegions.forEach((regId, idx) => {
      const regionRecords = filteredData.filter((r) => r.RegionID === regId);
      if (regionRecords.length === 0) return;
      
      const regionName = regionRecords[0].RegionName;
      legendData.push(regionName);

      const dataValues = years.map((year) => {
        const rec = regionRecords.find((r) => r.Year === year);
        return rec ? getRecordValue(rec) : null;
      });

      const color = colors[idx % colors.length];

      seriesData.push({
        name: regionName,
        type: "line",
        data: dataValues,
        smooth: true,
        symbolSize: 6,
        connectNulls: false, // Don't connect lines through null points (missing years)
        lineStyle: {
          width: 2.5,
          color: color
        },
        itemStyle: {
          color: color
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}25` },
              { offset: 1, color: `${color}00` }
            ]
          }
        }
      });
    });
  }

  let yAxisMax: number | undefined = undefined;
  if (metric === "rate") {
    yAxisMax = 100;
  } else if (scaleMode === "custom") {
    yAxisMax = customMaxVal;
  } else if (scaleMode === "fixed") {
    if (selectedRegions.length === 0) {
      // If no regions are selected, we show the national total (RegionID 999)
      const nationalRecords = filteredData.filter((r) => r.RegionID === 999 || r.RegionName === "全国");
      const nationalValues = nationalRecords.map((r) => getRecordValue(r)).filter((v) => v !== null) as number[];
      yAxisMax = nationalValues.length > 0 ? Math.max(...nationalValues) * 1.05 : undefined;
    } else {
      // Max value of all prefectures (excluding national total) across all years
      const prefectureRecords = filteredData.filter((r) => r.RegionID !== 999 && r.RegionName !== "全国");
      const prefValues = prefectureRecords.map((r) => getRecordValue(r)).filter((v) => v !== null) as number[];
      yAxisMax = prefValues.length > 0 ? Math.max(...prefValues) * 1.05 : undefined;
    }
  }

  const yAxisName = metric === "rate"
    ? "検挙率 (%)"
    : metric === "cases"
    ? `認知件数 ${isPer100k ? "(10万人あたり)" : "(件)"}`
    : metric === "cleared"
    ? `検挙件数 ${isPer100k ? "(10万人あたり)" : "(件)"}`
    : `検挙人員 ${isPer100k ? "(10万人あたり)" : "(人)"}`;

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      borderColor: "rgba(51, 65, 85, 0.8)",
      borderWidth: 1,
      textStyle: {
        color: "#e2e8f0"
      },
      axisPointer: {
        type: "cross",
        label: {
          backgroundColor: "#4f46e5"
        }
      },
      valueFormatter: (value: number | null | undefined) => {
        if (value === null || value === undefined || isNaN(value)) {
          return "非公表 / 未取得";
        }
        return metric === "rate" 
          ? `${value.toFixed(1)} %` 
          : isPer100k 
          ? value.toFixed(2) 
          : `${Math.round(value).toLocaleString()} ${metric === "persons" ? "人" : "件"}`;
      }
    },
    legend: {
      data: legendData,
      textStyle: {
        color: "#94a3b8",
        fontSize: isMobile ? 10 : 12
      },
      top: "0%",
      type: "scroll"
    },
    grid: {
      left: isMobile ? "2%" : "3%",
      right: "4%",
      bottom: "3%",
      top: isMobile ? "16%" : "12%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: years.map(String),
      axisLine: {
        lineStyle: {
          color: "rgba(71, 85, 105, 0.4)"
        }
      },
      axisLabel: {
        color: "#94a3b8"
      }
    },
    yAxis: {
      type: "value",
      name: yAxisName,
      max: yAxisMax,
      minInterval: 1, // Always force integer intervals
      nameTextStyle: {
        color: "#94a3b8",
        fontSize: 10,
        padding: [0, 0, 0, 30]
      },
      axisLine: {
        lineStyle: {
          color: "rgba(71, 85, 105, 0.4)"
        }
      },
      axisLabel: {
        color: "#94a3b8",
        formatter: (value: number) => {
          // Always format axis labels as integers
          return Math.round(value).toLocaleString();
        }
      },
      splitLine: {
        lineStyle: {
          color: "rgba(51, 65, 85, 0.2)",
          type: "dashed"
        }
      }
    },
    series: seriesData
  };

  return (
    <div className="w-full h-full">
      <ReactECharts
        option={option}
        style={{ width: "100%", height: isMobile ? "280px" : "350px" }}
        notMerge={true}
      />
    </div>
  );
}
