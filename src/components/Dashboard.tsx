"use client";

import React, { useState, useEffect } from "react";
import MapChart from "./MapChart";
import LineChart from "./LineChart";
import { Play, Pause, RotateCcw, MapPin, BarChart3, ShieldAlert, SlidersHorizontal, Trash2, CheckCircle2 } from "lucide-react";

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

export default function Dashboard() {
  const [crimeData, setCrimeData] = useState<CrimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard States
  const [year, setYear] = useState(2025);
  const [selectedCrime, setSelectedCrime] = useState("殺人");
  const [selectedRegions, setSelectedRegions] = useState<{ id: number; name: string }[]>([]);
  const selectedRegionIds = selectedRegions.map((r) => r.id);
  
  // New Metric States
  const [metric, setMetric] = useState<"cases" | "cleared" | "persons" | "rate">("cases");
  const [isPer100k, setIsPer100k] = useState(false);
  
  const [scaleMode, setScaleMode] = useState<"auto" | "fixed" | "custom">("fixed");
  const [customMaxVal, setCustomMaxVal] = useState<number>(1000);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms per step

  // Fetch the mock crime data on mount
  useEffect(() => {
    fetch("/mock_crime_data.json")
      .then((res) => res.json())
      .then((data) => {
        setCrimeData(data);
        setLoading(false);
      })
      .catch((err) => console.error("Error fetching mock crime data:", err));
  }, []);

  // Handle auto-playback of the timeline
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setYear((prevYear) => {
          if (prevYear >= 2025) {
            return 2008; // Wrap around to start
          }
          return prevYear + 1;
        });
      }, playSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  // Handle clicking on map regions to toggle selection for comparison
  const handleRegionClick = (regionId: number, regionName: string) => {
    setSelectedRegions((prev) => {
      const exists = prev.some((r) => r.id === regionId);
      if (exists) {
        return prev.filter((r) => r.id !== regionId);
      } else {
        if (prev.length >= 8) {
          alert("比較できる地域は最大8件までです。");
          return prev;
        }
        return [...prev, { id: regionId, name: regionName }];
      }
    });
  };

  // Clear all region selections
  const clearSelectedRegions = () => {
    setSelectedRegions([]);
  };

  // Categorized 16 Crime Types
  const violentCrimes = [
    "殺人", "強盗", "侵入強盗", "放火", "不同意性交等", "略取誘拐・人身売買", "強制わいせつ", "住居侵入"
  ];
  
  const propertyCrimes = [
    "重要窃盗犯", "侵入盗", "住宅対象", "自動車盗", "ひったくり", "すり", "器物損壊", "その他"
  ];

  const foreignCrimes = [
    "来日外国人犯罪（総数）", "来日外国人犯罪（刑法犯）", "来日外国人犯罪（特別法犯）"
  ];

  const isForeignCrime = selectedCrime.startsWith("来日外国人");

  // Reset metric to 'cleared' and disable per-100k if foreign crime is selected
  useEffect(() => {
    if (isForeignCrime && (metric === "cases" || metric === "rate")) {
      setMetric("cleared");
      setIsPer100k(false);
    }
  }, [selectedCrime, metric, isForeignCrime]);

  // Automatically update customMaxVal to match the fixed maximum of the selected crime type/metric
  useEffect(() => {
    if (crimeData.length === 0) return;
    
    const isForeignCrime = selectedCrime.startsWith("来日外国人");
    const activeMetric = isForeignCrime && (metric === "cases" || metric === "rate") ? "cleared" : metric;
    
    const showNational = selectedRegions.length === 0;
    let values: number[] = [];
    
    if (showNational) {
      if (isForeignCrime) {
        // For foreign crimes, load from RegionID 999
        const nationalRecords = crimeData.filter(
          (r) => r.CrimeType === selectedCrime && r.RegionID === 999
        );
        values = nationalRecords.map((r) => {
          if (activeMetric === "rate") return r.ClearanceRate;
          const rawVal = activeMetric === "cases" ? r.CaseCount : activeMetric === "cleared" ? r.ClearedCount : r.ClearedPersons;
          return rawVal === -1 ? -1 : rawVal;
        }).filter((v) => v >= 0);
      } else {
        // For normal crimes, calculate national sum for each year dynamically
        const years = Array.from({ length: 18 }, (_, i) => 2008 + i);
        
        // Helper to extract population from a record
        const getPopulation = (rec: CrimeRecord) => {
          if (rec.RatePer100k > 0 && rec.CaseCount > 0) {
            return (rec.CaseCount / rec.RatePer100k) * 100000;
          }
          return 1000000; // fallback
        };
        
        const filteredData = crimeData.filter((r) => r.CrimeType === selectedCrime);
        const baseYearRecords = filteredData.filter((r) => r.Year === 2008);
        const nationalPopulation = baseYearRecords.reduce((sum, r) => sum + getPopulation(r), 0) || 125000000;
        
        values = years.map((year) => {
          const yearRecords = filteredData.filter((r) => r.Year === year);
          if (activeMetric === "rate") {
            const totalCases = yearRecords.reduce((sum, r) => sum + r.CaseCount, 0);
            const totalCleared = yearRecords.reduce((sum, r) => sum + r.ClearedCount, 0);
            return totalCases > 0 ? (totalCleared / totalCases) * 100 : 0;
          }
          
          const rawSum = yearRecords.reduce((sum, r) => {
            const val = activeMetric === "cases" ? r.CaseCount : activeMetric === "cleared" ? r.ClearedCount : r.ClearedPersons;
            return sum + val;
          }, 0);
          
          if (isPer100k) {
            return (rawSum / nationalPopulation) * 100000;
          }
          return rawSum;
        });
      }
    } else {
      // Calculate the maximum value of individual prefectures (excluding RegionID 999 "全国" to get correct local maximum)
      const filtered = crimeData.filter(
        (r) => r.CrimeType === selectedCrime && r.RegionID !== 999
      );
      if (filtered.length === 0) return;
  
      values = filtered.map((r) => {
        if (activeMetric === "rate") {
          return r.ClearanceRate;
        }
        const rawVal = activeMetric === "cases"
          ? r.CaseCount
          : activeMetric === "cleared"
          ? r.ClearedCount
          : r.ClearedPersons;
  
        if (rawVal === -1) return -1;
  
        if (isPer100k) {
          if (r.RatePer100k > 0 && r.CaseCount > 0) {
            const pop = (r.CaseCount / r.RatePer100k) * 100000;
            return (rawVal / pop) * 100000;
          }
          return (rawVal / 1000000) * 100000; // fallback
        }
        return rawVal;
      }).filter((v) => v >= 0);
    }
  
    const maxVal = values.length > 0 ? Math.max(...values) : 100;
    // Set customMaxVal rounded to nearest nice number
    setCustomMaxVal(Math.ceil(maxVal));
  }, [selectedCrime, metric, isPer100k, selectedRegions, crimeData]);

  const metricsConfig = [
    { value: "cases", label: "認知件数" },
    { value: "cleared", label: "検挙件数" },
    { value: "persons", label: "検挙人員" },
    { value: "rate", label: "検挙率 (%)" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-slate-400 font-medium animate-pulse">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Background Decorative Glowing Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-6 h-6 text-indigo-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Japan Crime Analysis Suite</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-pink-200 bg-clip-text text-transparent">
              重大犯罪・地域別動態可視化ダッシュボード
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              日本全国 46都府県 ＋ 北海道5分割（札幌・函館・旭川・釧路・北見）の時系列犯罪統計 (2008 - 2025)
            </p>
          </div>
          
          {/* Controls: Metric Selection & Scale Switch */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Selector Tabs */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
              {metricsConfig.map((m) => {
                const isDisabled = isForeignCrime && (m.value === "cases" || m.value === "rate");
                return (
                  <button
                    key={m.value}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      setMetric(m.value as any);
                      // Reset per-100k switch if Clearance Rate is selected
                      if (m.value === "rate") setIsPer100k(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                      isDisabled
                        ? "opacity-25 cursor-not-allowed text-slate-600"
                        : metric === m.value
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title={isDisabled ? "来日外国人犯罪ではこの指標は定義・公表されません" : ""}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Per 100k Toggle - Disable/Hide if Clearance Rate is active */}
            {metric !== "rate" && (
              <div className="flex items-center bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800/80 gap-2">
                <span className="text-xs text-slate-400 font-bold">10万人あたり:</span>
                <button
                  onClick={() => setIsPer100k(!isPer100k)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                    isPer100k ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${
                      isPer100k ? "translate-x-4.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Scale Control Button Group (Auto, Fixed, Arbitrary/Custom) */}
            <div className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-800/80 gap-2">
              <span className="text-xs text-slate-400 font-bold px-1">軸スケール:</span>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setScaleMode("auto")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-300 ${
                    scaleMode === "auto" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="表示データに合わせてスケールを自動調整します"
                >
                  自動
                </button>
                <button
                  onClick={() => setScaleMode("fixed")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-300 ${
                    scaleMode === "fixed" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="時系列および全地域を通じた最大値でスケールを固定します"
                >
                  固定
                </button>
                <button
                  onClick={() => setScaleMode("custom")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-300 ${
                    scaleMode === "custom" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="手動で最大値を指定してスケールを固定します（任意）"
                >
                  任意
                </button>
              </div>

              {/* Custom Max Value Input (only visible when in custom/arbitrary mode) */}
              {scaleMode === "custom" && (
                <div className="flex items-center gap-1.5 pl-1 animate-fadeIn">
                  <span className="text-[10px] text-slate-500 font-bold">上限値:</span>
                  <input
                    type="number"
                    min="1"
                    value={customMaxVal}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setCustomMaxVal(val);
                    }}
                    className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-indigo-400 font-mono text-center focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}
            </div>

            {/* Warning Message for Foreign Crime */}
            {isForeignCrime && (
              <div className="text-[10px] text-amber-400 bg-amber-950/30 border border-amber-900/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 max-w-sm md:max-w-md shadow-inner">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>来日外国人犯罪は構造上「認知件数」「検挙率」が定義されません（検挙数・人員のみ表示可能）。</span>
              </div>
            )}
          </div>
        </header>

        {/* Crime Type Filter & Controller Panel */}
        <section className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/50 pb-4">
            <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              分析対象とする犯罪種別の選択 (全17区分)
            </div>
            
            <button
              onClick={() => setSelectedCrime("全犯罪（刑法犯総数）")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border flex items-center gap-1.5 ${
                selectedCrime === "全犯罪（刑法犯総数）"
                  ? "bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-transparent shadow-lg shadow-indigo-500/20"
                  : "bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              📊 すべての犯罪の総数（刑法犯総数）を表示
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category 1: Violent Crimes */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 border-l-2 border-indigo-500">
                凶悪・粗暴犯
              </div>
              <div className="flex flex-wrap gap-1.5">
                {violentCrimes.map((crime) => (
                  <button
                    key={crime}
                    onClick={() => setSelectedCrime(crime)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedCrime === crime
                        ? "bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-inner"
                        : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    {crime}
                  </button>
                ))}
              </div>
            </div>

            {/* Category 2: Theft & Property Crimes */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 border-l-2 border-pink-500">
                窃盗・財産犯・その他
              </div>
              <div className="flex flex-wrap gap-1.5">
                {propertyCrimes.map((crime) => (
                  <button
                    key={crime}
                    onClick={() => setSelectedCrime(crime)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedCrime === crime
                        ? "bg-pink-600/20 text-pink-300 border-pink-500 shadow-inner"
                        : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    {crime}
                  </button>
                ))}
              </div>
            </div>

            {/* Category 3: Foreign Crimes */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 border-l-2 border-purple-500">
                来日外国人犯罪（特別枠）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {foreignCrimes.map((crime) => (
                  <button
                    key={crime}
                    onClick={() => setSelectedCrime(crime)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedCrime === crime
                        ? "bg-purple-600/20 text-purple-300 border-purple-500 shadow-inner"
                        : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    {crime}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Main Dashboard Layout (Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map Chart Area (Span 2) */}
          <section className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-pink-500" />
                  タイムライン・アニメーションマップ ({year}年)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  日本地図上に犯罪統計をコロプレスマップで視覚化（北海道は5管轄地域に分解。ズーム固定に対応）
                </p>
              </div>
            </div>

            {/* Choropleth Map Component */}
            <div className="flex-grow flex items-center justify-center">
              <MapChart
                year={year}
                selectedCrime={selectedCrime}
                selectedRegions={selectedRegionIds}
                onRegionClick={handleRegionClick}
                crimeData={crimeData}
                metric={metric}
                isPer100k={isPer100k}
                scaleMode={scaleMode}
                customMaxVal={customMaxVal}
              />
            </div>

            {/* Time Controls Panel */}
            <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-4 mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Playback buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 transition-all duration-300 active:scale-95"
                    title={isPlaying ? "一時停止" : "再生"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setYear(2008);
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all duration-300 active:scale-95 border border-slate-700/50"
                    title="タイムラインをリセット"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  
                  {/* Playback speed switcher */}
                  <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg ml-2">
                    <button
                      onClick={() => setPlaySpeed(1500)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        playSpeed === 1500 ? "bg-indigo-600/20 text-indigo-400" : "text-slate-500"
                      }`}
                    >
                      遅め
                    </button>
                    <button
                      onClick={() => setPlaySpeed(1000)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        playSpeed === 1000 ? "bg-indigo-600/20 text-indigo-400" : "text-slate-500"
                      }`}
                    >
                      標準
                    </button>
                    <button
                      onClick={() => setPlaySpeed(600)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        playSpeed === 600 ? "bg-indigo-600/20 text-indigo-400" : "text-slate-500"
                      }`}
                    >
                      早め
                    </button>
                  </div>
                </div>
                
                {/* Year display */}
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-400 tracking-wider font-mono">
                    {year}
                  </span>
                  <span className="text-xs text-slate-500 ml-1 font-semibold">年 (1月〜12月)</span>
                </div>
              </div>

              {/* Range Slider */}
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500 font-mono font-bold">2008</span>
                <input
                  type="range"
                  min="2008"
                  max="2025"
                  value={year}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setYear(parseInt(e.target.value));
                  }}
                  className="flex-grow accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-500 font-mono font-bold">2025</span>
              </div>
            </div>
          </section>

          {/* Trend Graph Area (Span 1) */}
          <section className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  年別推移のトレンドグラフ
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  マップ上での地域クリックで比較用ラインを動的に追加可能
                </p>
              </div>

              {/* Selection Summary Panel */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    選択した比較地域 ({selectedRegions.length}/8)
                  </span>
                  {selectedRegions.length > 0 && (
                    <button
                      onClick={clearSelectedRegions}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      クリア
                    </button>
                  )}
                </div>

                {selectedRegions.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic py-1 leading-relaxed">
                    ※ 地図上の地域（例: 「東京都」や「北海道（札幌）」）をクリックすると、個別トレンドをプロットします。現在は「全国合計/平均値」を表示しています。
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {selectedRegions.map((region) => (
                      <span
                        key={region.id}
                        onClick={() => handleRegionClick(region.id, region.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/50 text-indigo-300 border border-indigo-800/50 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-800/50 cursor-pointer transition-all duration-300"
                        title="クリックで削除"
                      >
                        {region.name}
                        <span className="text-[9px] opacity-60">×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Line/Trend Chart Component */}
            <div className="mt-6 flex-grow flex items-center">
              <LineChart
                selectedCrime={selectedCrime}
                selectedRegions={selectedRegionIds}
                crimeData={crimeData}
                metric={metric}
                isPer100k={isPer100k}
                scaleMode={scaleMode}
                customMaxVal={customMaxVal}
              />
            </div>
            
            {/* Visual Indicator of Selected Metric */}
            <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-3 mt-4 text-center font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              表示項目: {selectedCrime} ＞ 
              {metric === "rate"
                ? "検挙率 (%)"
                : `${metric === "cases" ? "認知件数" : metric === "cleared" ? "検挙件数" : "検挙人員"}${isPer100k ? " (10万人あたり)" : " (実数)"}`}
            </div>
          </section>
        </div>

        {/* Detailed Explanation Note Card for Foreign Crime Statistics */}
        {isForeignCrime && (
          <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 mt-6">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              来日外国人犯罪統計に関する詳細注記
            </h3>
            <div className="text-xs text-slate-400 space-y-2.5 leading-relaxed">
              <p>
                <strong>1. 「来日外国人」の定義:</strong><br />
                本データにおける「来日外国人」とは、日本国内に在留する外国人のうち、永住者・特別永住者（在日韓国・朝鮮人など）、在日米軍関係者、および在留資格不明者を除いた「観光・短期滞在・留学・就労等の目的で来日した外国人」を指します。永住者等を含む「外国人犯罪全体」の中のサブセット（一部集合）となります。
              </p>
              <p>
                <strong>2. 認知件数・検挙率が公表されない理由:</strong><br />
                犯罪を認知した時点（捜査の入口）では被疑者の国籍や在留資格が特定されていないため、「来日外国人犯罪の認知件数」は構造上存在しません。被疑者を検挙し、取調べ等で国籍・在留資格が確認された時点で初めて本統計に計上されるため、<strong>「検挙件数」および「検挙人員」のみが公表されます</strong>。分母となる認知件数がないため、「検挙率」も算出されません。
              </p>
              <div>
                <strong>3. 都道府県別の公開状況（データの欠損について）:</strong><br />
                本ダッシュボードに統合されているデータは、警察庁および各県警の公式発表に基づいています。
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>大阪府・埼玉県</strong>: 検挙件数・検挙人員の双方を公表しています（大阪は2023〜2024年、埼玉は2024年）。</li>
                  <li><strong>愛知県</strong>: 検挙人員のみ公表（2024年：刑法犯666人、特別法犯506人）しており、検挙件数は非公表です（検挙件数＝非公表/未取得と表示されます）。</li>
                  <li><strong>東京都・千葉県・沖縄県など</strong>: 2024年の県警資料等の存在が確認されていますが、電子データ形式の都合等により本分析では「未取得」となっています。</li>
                  <li><strong>神奈川県</strong>: 神奈川県警は「来日外国人犯罪」に特化した単独の統計区分を公開していないため「非公開仕様（データなし）」となっています。</li>
                  <li><strong>その他の県・期間</strong>: 警察庁による都道府県別データの網羅的な公開がないため「非公表/未取得」となっています。</li>
                </ul>
              </div>
              <p>
                <strong>4. 全国合計値の推移について:</strong><br />
                折れ線グラフで何も地域を選択しない場合に表示される「全国（合計）」は、警察庁が公表している全国合計の実数（2015〜2024年の経年推移、およびユーザー提供による2009〜2018年の推移）を表示しています。他都府県のデータが非公表であっても、実際の全国トレンドを正しく比較できるよう設計されています。なお、平成27年・28年のデータにおいて、一部ソース（警察庁CSVと提供Excel）間で集計定義等の差異により数値の不一致がありますが、それぞれの発表元の値をそのまま掲載しています。
              </p>
            </div>
          </section>
        )}
        
        {/* References Section */}
        <section className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-3 mt-6">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            📚 参考文献・データ引用元 (References)
          </h3>
          <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-5 leading-relaxed">
            <li>
              <strong>一般犯罪統計 (2008年 - 2025年)</strong>: 警察庁『犯罪統計資料（確定値）』各年版（第１表、第３表、第４表、重要犯罪・重要窃盗犯に関する主要データ）
            </li>
            <li>
              <strong>来日外国人犯罪（全国統計）</strong>: 警察庁組織犯罪対策部『来日外国人犯罪の検挙状況』各年次報告、および統計CSV資料
            </li>
            <li>
              <strong>来日外国人犯罪（都道府県統計）</strong>:
              <ul className="list-[circle] pl-5 mt-1 space-y-1">
                <li>埼玉県警察『埼玉県内の来日外国人犯罪の検挙状況 (令和6年)』</li>
                <li>大阪府警察『大阪の来日外国人犯罪 (令和5年・令和6年)』</li>
                <li>愛知県警察『愛知県内の来日外国人検挙状況 (令和6年)』※検挙人員のみ</li>
              </ul>
            </li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 border-t border-slate-900 pt-6 mt-8">
          日本の犯罪統計（平成・令和）可視化システム &copy; 2026 Dashboard MVP. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
