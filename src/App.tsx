/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  Wallet,
  Calendar,
  Plus,
  TrendingDown,
  Target,
  Trash2,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Signal,
  Wifi,
  Battery,
  Smartphone,
  Camera,
  Laptop,
  Box,
  Settings,
  X,
  CreditCard,
  History,
  LayoutGrid,
  MoreVertical,
  CheckCircle2,
  Cpu,
  Share2,
  Zap,
  Sparkles,
  Award,
  Layers,
  Car,
  Pocket,
  Home,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  format,
  differenceInDays,
  parseISO,
  startOfToday,
  subDays,
  isWithinInterval,
} from "date-fns";
import { analyzeMarket, MarketAnalysis } from "./services/geminiService";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Asset {
  id: string;
  name: string;
  price: number;
  purchaseDate: string;
  category: string;
  imageUrl?: string;
  condition?: "mint" | "good" | "worn";
  targetDailyCost?: number;
  expectedDays?: number; // User set expected service life
  analysis?: MarketAnalysis & { updatedAt: string };
  targetMode?: "custom" | "period" | "ratio" | "ai";
  targetValue?: string;
  liquidityScore?: number; // 0-100
  // Derived fields
  days?: number;
  dailyCost?: number;
  actualDailyCost?: number; // (Price - MarketPrice) / Days
  marketPrice?: number;
  marketDemandIndex?: number;
  healthStatus?: "healthy" | "warning" | "danger" | "heroic";
  healthGrade?: string; // S, A, B, C
  efficiencyScore?: number; // 0-100
  statusTag?: string; // e.g., "开箱阵痛期"
  achievementRate?: number; // Achievement rate of goal
  progress?: number;
  todayChange?: number;
  netDailyPerformance?: number;
  hedgingRate?: number;
  lScore?: number;
  lRating?: string;
  isUnrecognized?: boolean;
  milestones?: { day: number; label: string; reached: boolean }[];
  candlestickData?: any[];
  // History fields
  isSold?: boolean;
  soldPrice?: number;
  soldDate?: string;
  isRetired?: boolean;
}

const getAssetIcon = (name: string, imageUrl?: string) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="size-10 object-cover rounded-xl"
        referrerPolicy="no-referrer"
      />
    );
  }
  const n = name.toLowerCase();
  const iconClass = "size-8 text-[#6B7280]";
  if (n.includes("phone") || n.includes("iphone"))
    return <Smartphone className={iconClass} strokeWidth={1.5} />;
  if (n.includes("camera") || n.includes("dji") || n.includes("action"))
    return <Camera className={iconClass} strokeWidth={1.5} />;
  if (n.includes("house") || n.includes("room") || n.includes("房"))
    return <Home className={iconClass} strokeWidth={1.5} />;
  if (n.includes("mac") || n.includes("laptop") || n.includes("电脑"))
    return <Laptop className={iconClass} strokeWidth={1.5} />;
  return <Box className={iconClass} strokeWidth={1.5} />;
};

const CATEGORIES = [
  { name: "全部", icon: <Layers className="size-3.5" /> },
  { name: "电子设备", icon: <Smartphone className="size-3.5" /> },
  { name: "房产", icon: <Home className="size-3.5" /> },
  { name: "交通工具", icon: <Car className="size-3.5" /> },
  { name: "家居", icon: <Pocket className="size-3.5" /> },
  { name: "其他", icon: <Layers className="size-3.5" /> }
] as const;

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentView, setCurrentView] = useState<"dashboard" | "analysis" | "warehouse" | "settings">(
    "dashboard",
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "all" | "serving" | "retired" | "sold"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    (typeof CATEGORIES)[number]["name"]
  >("全部");
  const [isSearching, setIsSearching] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [insightExpanded, setInsightExpanded] = useState(false);
  const [swipedAssetId, setSwipedAssetId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newAsset, setNewAsset] = useState({
    name: "",
    price: "",
    purchaseDate: format(new Date(), "yyyy-MM-dd"),
    targetDailyCost: "",
    category: "电子设备",
    imageUrl: "",
    condition: "good" as "mint" | "good" | "worn",
    targetMode: "custom" as "custom" | "period" | "ratio" | "ai",
    targetValue: "",
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Persistence: Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("assetsync_assets");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setAssets(parsed);
        } else {
          setAssets([]);
        }
      } catch (e) {
        console.error("Failed to load assets", e);
        setAssets([]);
      }
    } else {
      setAssets([]);
    }
  }, []);

  // Persistence: Save to localStorage
  useEffect(() => {
    localStorage.setItem("assetsync_assets", JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Add scroll lock effect for modals
  useEffect(() => {
    if (isAdding || selectedAsset) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isAdding, selectedAsset]);

  const stats = useMemo(() => {
    const today = startOfToday();
    let totalInitialValue = 0;
    let totalMarketValue = 0;
    let totalDailyCost = 0;
    let totalTodayMarketChange = 0;
    let totalActualDailyCost = 0;
    
    // Split assets into categories for warehouse analysis
    const activeAssets = assets.filter(a => !a.isSold && !a.isRetired);
    const soldAssets = assets.filter(a => a.isSold);
    const retiredAssets = assets.filter(a => a.isRetired);

    const summarizedAssets = assets.map((asset) => {
      let days = 1;
      try {
        const parsedDate = asset.purchaseDate ? parseISO(asset.purchaseDate) : today;
        days = Math.max(1, differenceInDays(today, parsedDate));
      } catch (e) {
        console.error("Date parsing failed for asset", asset.id, e);
      }
      
      const conditionMultiplier = asset.condition === "mint" ? 0.96 : asset.condition === "worn" ? 0.82 : 0.90;
      // If no AI analysis, provide a conservative estimated market price based on condition to avoid 0 cost
      const marketPrice =
        asset.analysis?.estimatedMarketPrice || (asset.price * conditionMultiplier) || 0;

      const assetPrice = asset.price || 0;
      const dailyCost = assetPrice / days;
      const actualDailyCost = Math.max(0.1, (assetPrice - marketPrice) / days);

      totalInitialValue += assetPrice;
      totalMarketValue += marketPrice;
      totalDailyCost += dailyCost;
      totalActualDailyCost += actualDailyCost;

      const seed = asset.id
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isUp = (seed + today.getDate()) % 2 === 0;
      const changeRange = (seed % 5) + 0.5;
      const todayChange = (isUp ? 1 : -1) * (marketPrice * (changeRange / 100));
      totalTodayMarketChange += todayChange;

      // New: Net Fluctuation (Today's market change minus today's depreciation)
      const netDailyPerformance = todayChange - dailyCost;
      // New: Hedging Rate (How much market value change covers the cost of ownership)
      const hedgingRate = dailyCost > 0 ? (todayChange / dailyCost) * 100 : 100;

      // Calculate Target Daily Cost based on mode
      let targetD = asset.targetDailyCost || 0;
      if (asset.targetMode === "period" && asset.targetValue) {
        targetD = asset.price / parseFloat(asset.targetValue);
      } else if (asset.targetMode === "ratio" && asset.targetValue) {
        const annualDeprecation = asset.price * (parseFloat(asset.targetValue) / 100);
        targetD = annualDeprecation / 365;
      }

      const progress =
        targetD > 0
          ? Math.min(100, (days / (asset.price / targetD)) * 100)
          : Math.min(100, (days / 1000) * 100);

      // Utility Health logic
      let healthStatus: "healthy" | "warning" | "danger" | "heroic" = "healthy";
      let statusTag = "稳定持产";
      
      const isSunkCostShield = days < 30; 
      const isPureProfit = actualDailyCost < (targetD ? targetD * 0.8 : 2); 
      
      // Calculate Efficiency Score (Health Index)
      // If actual is 2 and target is 3, score is (3/2)*100 = 150 -> capped or graded
      const efficiencyScore = targetD > 0 
        ? Math.min(100, Math.round((targetD / Math.max(0.1, actualDailyCost)) * 100))
        : 85; // Default healthy score if no target

      let healthGrade = "A";
      if (efficiencyScore >= 95) healthGrade = "S";
      else if (efficiencyScore >= 80) healthGrade = "A+";
      else if (efficiencyScore >= 65) healthGrade = "A";
      else if (efficiencyScore >= 45) healthGrade = "B";
      else if (efficiencyScore >= 25) healthGrade = "C";
      else healthGrade = "D";

      if (isSunkCostShield) {
        statusTag = "准新保护期";
        healthStatus = "healthy";
      } else if (isPureProfit && efficiencyScore >= 90) {
        statusTag = "👑 功勋元老";
        healthStatus = "heroic";
      } else if (asset.analysis?.priority === 'critical') {
        statusTag = "换代预警";
        healthStatus = "danger";
      } else if (targetD > 0) {
        if (actualDailyCost <= targetD) {
          statusTag = "超额回本";
          healthStatus = "healthy";
        } else if (actualDailyCost <= targetD * 1.5) {
          statusTag = "效用警报";
          healthStatus = "warning";
        } else {
          statusTag = "汰弱留强";
          healthStatus = "danger";
        }
      }

      if (asset.analysis?.suggestion === "sell" && !isSunkCostShield) {
        if (healthStatus === "heroic" || efficiencyScore >= 90) {
          statusTag = "✨ 收益封顶 · 宜置换";
          healthStatus = "heroic";
        } else {
          statusTag = "建议变现";
          healthStatus = "danger";
        }
      } else if (asset.analysis?.suggestion === "hold") {
        statusTag = "坚持继续";
        healthStatus = "healthy";
      }

      const achievementRate = targetD > 0 ? (targetD / Math.max(0.1, actualDailyCost)) * 100 : 0;

      const milestones = [
        { day: 30, label: "满月", reached: days >= 30 },
        { day: 100, label: "百天陪伴", reached: days >= 100 },
        { day: 365, label: "一周年", reached: days >= 365 },
        { day: 1000, label: "功勋千日", reached: days >= 1000 },
      ];

      const lScore = (seed % 40) + 60;
      let lRating = "A";
      if (lScore > 90) lRating = "S";
      else if (lScore > 80) lRating = "A";
      else if (lScore > 70) lRating = "B";
      else lRating = "C";

      // Mock market demand index based on seed and category
      const marketDemandIndex = (seed % 30) + 70;

      const candlestickData = Array.from({ length: 15 }, (_, i) => {
        const base = asset.price * (0.8 + Math.random() * 0.4);
        const open = base;
        const close = Math.max(0, base * (0.95 + Math.random() * 0.1));
        return {
          time: format(subDays(today, 14 - i), "MM.dd"),
          open,
          close,
          high: Math.max(open, close) * (1 + Math.random() * 0.05),
          low: Math.min(open, close) * (1 - Math.random() * 0.05),
        };
      });

      return {
        ...asset,
        days,
        dailyCost,
        actualDailyCost,
        marketPrice,
        healthStatus,
        healthGrade,
        efficiencyScore,
        statusTag,
        achievementRate,
        progress,
        todayChange,
        netDailyPerformance,
        hedgingRate,
        lScore,
        lRating,
        milestones,
        marketDemandIndex: asset.analysis?.marketDemandIndex || marketDemandIndex,
        candlestickData,
      };
    });

    const totalNetPerformance = totalActualDailyCost;
    const portfolioHedgingRate =
      totalDailyCost > 0
        ? (totalTodayMarketChange / totalDailyCost) * 100
        : 100;

    return {
      assets: summarizedAssets,
      totalMarketValue,
      totalInitialValue,
      totalDailyCost,
      totalTodayMarketChange,
      totalNetPerformance,
      portfolioHedgingRate,
      unhealthyCount: summarizedAssets.filter(
        (a) => !a.isSold && a.healthStatus !== "healthy",
      ).length,
      activeAssets: summarizedAssets.filter(a => !a.isSold && !a.isRetired),
      soldAssets: summarizedAssets.filter(a => a.isSold),
      retiredAssets: summarizedAssets.filter(a => a.isRetired),
    };
  }, [assets, currentTime]);

  const handleAnalyze = async (asset: Asset) => {
    setAnalyzingId(asset.id);
    try {
      const daysHeld = differenceInDays(new Date(), parseISO(asset.purchaseDate));
      const result = await analyzeMarket(asset.name, asset.price, daysHeld, asset.condition);
      
      const updatedAsset: Asset = {
        ...asset,
        isUnrecognized: result.isUnrecognized,
        analysis: { ...result, updatedAt: new Date().toISOString() },
        efficiencyScore: result.isUnrecognized ? 10 : Math.round(
          Math.min(100, Math.max(0, (result.confidence * 70 + (asset.targetDailyCost ? (asset.targetDailyCost / (asset.actualDailyCost || 1)) * 30 : 0))))
        ),
      };

      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? updatedAsset : a)),
      );
      
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(updatedAsset);
      }
      
      if (result.isUnrecognized) {
        setSuccessMsg("AI 提示: 无法定位具体市场型号，已切换至基础核算模式");
      } else {
        setSuccessMsg("实时行情同步成功");
      }
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      setSuccessMsg("行情同步失败，请检查网络连接");
      setShowSuccess(true);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleSold = (asset: Asset, price: number) => {
    const updated = {
      ...asset,
      isSold: true,
      soldPrice: price,
      soldDate: format(new Date(), "yyyy-MM-dd"),
      healthStatus: "heroic" as const,
      statusTag: "已变现",
      analysis: undefined,
    };
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
    setSelectedAsset(null);
    setSuccessMsg(`资产已离场，回笼资金 ¥${price.toLocaleString()}`);
    setShowSuccess(true);
  };

  const handleClearData = () => {
    if (confirm("确定要格式化所有系统数据吗？此操作无法撤销。")) {
      localStorage.removeItem("assetsync_assets");
      window.location.reload();
    }
  };

  const handleOpenAdd = () => {
    setEditingAssetId(null);
    setNewAsset({
      name: "",
      price: "",
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      targetDailyCost: "",
      category: "电子设备",
      imageUrl: "",
      condition: "good",
      targetMode: "custom",
      targetValue: "",
    });
    setIsAdding(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setNewAsset({
      name: asset.name,
      price: asset.price.toString(),
      purchaseDate: asset.purchaseDate,
      targetDailyCost: asset.targetDailyCost?.toString() || "",
      category: asset.category || "电子设备",
      imageUrl: asset.imageUrl || "",
      condition: asset.condition || "good",
      targetMode: "custom",
      targetValue: asset.targetDailyCost?.toString() || "",
    });
    setIsAdding(true);
    setSelectedAsset(null);
  };

  const showFeatureToast = (name: string) => {
    setSuccessMsg(`功能「${name}」研发中，敬请期待 ✨`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.price) return;

    let calculatedTarget: number | undefined = undefined;
    const priceNum = parseFloat(newAsset.price);
    const valNum = parseFloat(newAsset.targetValue);

    if (newAsset.targetMode === "custom" && valNum > 0) {
      calculatedTarget = valNum;
    } else if (newAsset.targetMode === "period" && valNum > 0) {
      calculatedTarget = priceNum / valNum;
    } else if (newAsset.targetMode === "ratio" && valNum > 0) {
      // Annual ratio: (Price * Ratio%) / 365
      calculatedTarget = (priceNum * (valNum / 100)) / 365;
    } else if (newAsset.targetMode === "ai") {
      // AI logic: High fidelity depreciation model (roughly 15% annual for electronics, etc.)
      calculatedTarget = (priceNum * 0.15) / 365;
    }

    if (editingAssetId) {
      setAssets(
        assets.map((a) =>
          a.id === editingAssetId
            ? {
                ...a,
                name: newAsset.name,
                price: priceNum,
                purchaseDate: newAsset.purchaseDate,
                targetDailyCost: calculatedTarget,
                category: newAsset.category,
                imageUrl: newAsset.imageUrl,
                condition: newAsset.condition,
              }
            : a,
        ),
      );
    } else {
      const asset: Asset = {
        id: Math.random().toString(36).substr(2, 9),
        name: newAsset.name,
        price: priceNum,
        category: newAsset.category,
        imageUrl: newAsset.imageUrl,
        purchaseDate: newAsset.purchaseDate,
        targetDailyCost: calculatedTarget,
        condition: newAsset.condition,
      };
      setAssets([...assets, asset]);
      setSuccessMsg(`「${asset.name}」已成功锚定，财富档案实时同步中`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }

    setNewAsset({
      name: "",
      price: "",
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      targetDailyCost: "",
      category: "电子设备",
      imageUrl: "",
      condition: "good",
      targetMode: "custom",
      targetValue: "",
    });
    setIsAdding(false);
    setEditingAssetId(null);
  };

  const removeAsset = (id: string, force = false) => {
    if (force) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedAsset(null);
      setDeleteConfirmId(null);
      setSuccessMsg("资产已永久从档案中移除");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } else {
      setDeleteConfirmId(id);
      // Auto reset after 3 seconds
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-[#0F172A] flex flex-col">
      {/* Main Screen Content */}
      <div className="relative w-full h-full flex-1 flex flex-col overflow-hidden">
        
        <div className="flex-1 overflow-y-auto scrollbar-hide relative px-5 space-y-6 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(100px+env(safe-area-inset-bottom))]">
          {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-[#E5E5E5] rounded-full">
                  <Smartphone className="size-4" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] text-[#8E9299] font-medium">
                    当前管理资产员
                  </p>
                  <p className="text-xs font-bold">
                    {assets.length} 项资产在库
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -top-0.5 -right-0.5 size-2.5 bg-[#F97316] rounded-full border-2 border-white ring-2 ring-[#F97316]/10" />
                <Settings className="size-5 text-[#1C1C1E]" strokeWidth={1.5} />
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-12 bg-white rounded-2xl flex items-center px-4 shadow-sm border border-[#F1F1F1]">
                <Search
                  className="size-4 text-[#8E9299] mr-3"
                  strokeWidth={2}
                />
                <input
                  type="text"
                  placeholder="搜索您的资产..."
                  className="flex-1 bg-transparent border-none outline-none text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="h-12 w-12 bg-[#1C1C1E] rounded-2xl flex items-center justify-center text-white shadow-lg border border-white/5">
                <Signal className="size-5 rotate-45" strokeWidth={2} />
              </button>
            </div>
            <div className="relative group px-1">
              {/* Background Glow Orb - Positioned under the card */}
              <div className="absolute -inset-10 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px]" />
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-blue-400/5 rounded-full blur-[80px]" />
              </div>

              <div className={cn(
                "relative z-10 bg-[#0F172A] rounded-[40px] text-white shadow-[0_40px_80px_-20px_rgba(15,23,42,0.5)] flex flex-col overflow-hidden border border-white/[0.08] transition-all duration-700",
              )}>
                {/* Subtle Refined Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-blue-400/5 pointer-events-none" />
                
                <div className="p-8 pb-8 relative z-10 space-y-8">
                  {/* Wealth View Header */}
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[2.5px] text-white/50">资产组合概览</p>
                        <div className={cn(
                          "size-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]"
                        )} />
                      </div>
                      <h2 className="text-[42px] font-black font-mono tracking-tighter tabular-nums text-white leading-none">
                        ¥{hideAmounts ? "****" : stats.totalInitialValue.toLocaleString()}
                      </h2>
                    </div>
                    {/* Compact Share Action */}
                    <button
                      onClick={() => setShowPoster(true)}
                      className="p-3 text-white/20 hover:text-white/60 transition-colors active:scale-90"
                    >
                      <Share2 className="size-5" />
                    </button>
                  </div>

                  {/* Stats Grid - No Nesting, High Contrast */}
                  <div className="grid grid-cols-2 relative group/stats">
                    {/* Vertical Divider */}
                    <div className="absolute left-1/2 top-1 bottom-1 w-px bg-white/5 -translate-x-1/2" />

                    <div className="space-y-1.5 pr-4">
                      <p className="text-[10px] font-black uppercase text-white/50 tracking-widest select-none">各资产日消耗总和</p>
                      <div className={cn(
                        "flex items-baseline gap-1.5 font-mono font-black text-[24px] leading-tight text-white/90",
                      )}>
                        <span>{stats.totalNetPerformance.toFixed(1)}</span>
                        <span className="text-[8px] font-bold opacity-40 uppercase tracking-tighter">人民币</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pl-8">
                      <p className="text-[10px] font-black uppercase text-white/50 tracking-widest select-none">流动性评级</p>
                      <div className="flex items-center gap-2 font-mono font-black text-[24px] text-indigo-300 leading-tight">
                        <span>
                          {stats.portfolioHedgingRate > 200 ? "S" : stats.portfolioHedgingRate > 100 ? "A+" : "A"}
                        </span>
                        <Sparkles className="size-4 text-indigo-400 opacity-60" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integrated Intelligence Bar - Professional & Functional */}
                <div 
                  className="bg-white/[0.03] border-t border-white/[0.05] px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.06] transition-colors" 
                  onClick={() => setCurrentView("analysis")}
                >
                  <Cpu className={cn(
                    "size-3.5 flex-shrink-0",
                    stats.unhealthyCount > 0 ? "text-amber-500/60" : "text-blue-400/60"
                  )} />
                  <div className="flex-1 overflow-hidden h-4 relative">
                    <div className="flex items-center gap-12 whitespace-nowrap animate-[marquee_35s_linear_infinite] absolute will-change-transform">
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-[2px]">
                        {stats.unhealthyCount > 0 
                          ? `系统情报：${stats.unhealthyCount} 项资产建议审查` 
                          : "审计完成：资产组合完整性已确认"}
                      </span>
                      <span className="text-[8px] font-black text-white/10 opacity-30">/ /</span>
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-[2px]">实时行情同步：稳定</span>
                      <span className="text-[8px] font-black text-white/10 opacity-30">/ /</span>
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-[2px]">核心引擎负载 0.04% · 正在处理快照</span>
                    </div>
                  </div>
                  <ChevronRight className="size-3 text-white/10" />
                </div>
              </div>
            </div>

            {currentView === "dashboard" ? (
              <>
                {/* Category Filter - Segmented Control Style */}
                <div className="px-5">
                  <div className="flex gap-2 p-1.5 bg-white/50 rounded-2xl border border-black/5 overflow-x-auto scrollbar-hide no-scrollbar relative touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={cn(
                          "relative px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap z-10",
                          selectedCategory === cat.name
                            ? "text-white shadow-lg"
                            : "text-[#8E9299] hover:text-[#1C1C1E]"
                        )}
                      >
                        {selectedCategory === cat.name && (
                          <motion.div
                            layoutId="cat-bg"
                            className="absolute inset-0 bg-[#0F172A] rounded-xl -z-10 shadow-lg shadow-black/10"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        )}
                        <div className={cn(
                          "size-3.5 flex items-center justify-center transition-colors",
                          selectedCategory === cat.name ? "text-white/60" : "text-[#8E9299]"
                        )}>
                          {cat.icon}
                        </div>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List Header */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-800">资产档案</h2>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-500/20 tabular-nums">
                      {
                        stats.assets.filter((a) => {
                          const matchesSearch = a.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase());
                          const matchesCategory =
                            selectedCategory === "全部" ||
                            a.category === selectedCategory;
                          return matchesSearch && matchesCategory;
                        }).length
                      }
                    </span>
                  </div>
                  <button 
                    onClick={() => setCurrentView("warehouse")}
                    className="text-[10px] font-bold text-[#8E9299] hover:text-indigo-600 transition-colors"
                  >
                    全部档案库
                  </button>
                </div>

                {/* Asset List */}
                <div className="space-y-4 pb-12">
                  {stats.assets
                    .filter((a) => {
                      const matchesSearch = (a.name || "")
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase());
                      const matchesCategory =
                        selectedCategory === "全部" ||
                        a.category === selectedCategory;
                      return matchesSearch && matchesCategory;
                    }).length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-white/5 rounded-[40px] border border-dashed border-white/10">
                        <div className="size-16 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                          <Box className="size-8" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white/50">暂无资产</p>
                          <p className="text-[10px] text-white/20">点击下方按钮添加您的第一笔资产记录</p>
                        </div>
                      </div>
                    ) : stats.assets
                    .filter((a) => {
                      const matchesSearch = a.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase());
                      const matchesCategory =
                        selectedCategory === "全部" ||
                        a.category === selectedCategory;
                      return matchesSearch && matchesCategory;
                    })
                    .map((asset) => {
                      const progress = Math.min(
                        100,
                        (asset.days /
                          (asset.targetDailyCost
                            ? asset.price / Math.max(1, asset.targetDailyCost)
                            : 1000)) *
                          100,
                      );

                      return (
                        <div key={asset.id} className="relative">
                          {/* Swipe Actions Background */}
                          <div className="absolute top-0 bottom-0 right-0 w-[160px] flex items-stretch bg-neutral-900 rounded-[32px] overflow-hidden">
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(asset);
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center text-white/50 transition-all gap-1 border-r border-white/5"
                             >
                                <Settings className="size-4" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">编辑</span>
                             </button>
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (deleteConfirmId === asset.id) {
                                    removeAsset(asset.id, true);
                                  } else {
                                    removeAsset(asset.id);
                                  }
                                }}
                                className={cn(
                                  "flex-[1.2] flex flex-col items-center justify-center transition-all gap-1",
                                  deleteConfirmId === asset.id ? "bg-red-600 text-white animate-pulse" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                )}
                             >
                                <Trash2 className="size-4" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">
                                  {deleteConfirmId === asset.id ? "确定" : "删除"}
                                </span>
                             </button>
                          </div>

                          {/* Main Asset Card */}
                          <motion.div
                            drag="x"
                            dragConstraints={{ left: -160, right: 0 }}
                            dragElastic={0.1}
                            dragMomentum={true}
                            onDragEnd={(e, info) => {
                              if (info.offset.x < -80) {
                                setSwipedAssetId(asset.id);
                              } else if (info.offset.x > 20) {
                                setSwipedAssetId(null);
                              }
                            }}
                            animate={{ x: swipedAssetId === asset.id ? -160 : 0 }}
                            onClick={() => setSelectedAsset(asset)}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "relative bg-[#1E1E1E] rounded-[32px] p-5 shadow-xl border border-white/5 cursor-pointer overflow-hidden z-10",
                            )}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
                            
                            <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
                              <div className="flex gap-2.5">
                                <div className="size-12 bg-white/5 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm relative transition-transform duration-500">
                                  <div className="relative z-10 grayscale opacity-80 brightness-150">
                                    {getAssetIcon(asset.name, asset.imageUrl)}
                                  </div>
                                </div>
                                
                                <div className="py-0.5">
                                  <h3 className="text-[15px] font-black text-white/90 truncate tracking-tight mb-0.5 max-w-[120px]">
                                    {asset.name}
                                  </h3>
                                  <div className={cn(
                                    "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-[2px] border inline-flex items-center gap-1",
                                    asset.healthStatus === 'healthy' || asset.healthStatus === 'heroic' 
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                                      : asset.healthStatus === 'warning' 
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                        : "bg-red-500/10 border-red-500/20 text-red-500"
                                  )}>
                                    {asset.healthStatus === 'heroic' && <Award className="size-2" />}
                                    {asset.statusTag}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={cn(
                                  "text-2xl font-black italic tracking-tighter tabular-nums leading-none",
                                  asset.healthGrade === 'S' || asset.healthGrade === 'A+' ? "text-amber-400" :
                                  asset.healthGrade === 'A' || asset.healthGrade === 'B' ? "text-emerald-400" :
                                  "text-red-500"
                                )} style={{ fontFamily: '"Playfair Display", serif' }}>
                                   {asset.healthGrade}
                                </div>
                                <p className="text-[7px] font-bold text-white/20 uppercase tracking-[2px] mt-0.5">
                                  评级
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 relative z-10 py-3 border-y border-white/5 bg-white/[0.02] -mx-5 px-5">
                               <div className="space-y-0.5">
                                  <p className="text-[7px] font-bold text-white/20 uppercase tracking-[0.5px]">效率得分</p>
                                  <div className="flex items-baseline gap-1">
                                     <span className="text-[13px] font-black font-mono leading-none text-white/80">{asset.efficiencyScore}</span>
                                     <span className="text-[7px] font-bold text-white/10 italic">/ 100</span>
                                  </div>
                               </div>
                               <div className="space-y-0.5 text-center border-x border-white/5 px-1">
                                  <p className="text-[7px] font-bold text-white/20 uppercase tracking-[0.5px]">二级市场估值</p>
                                  <div className="flex items-baseline justify-center gap-0.5">
                                     {asset.analysis ? (
                                        <span className="text-[10px] font-black text-indigo-400 leading-none">
                                          {asset.analysis.priceRange 
                                            ? `¥${(asset.analysis.priceRange.min/1000).toFixed(1)}k-${(asset.analysis.priceRange.max/1000).toFixed(1)}k`
                                            : `¥${asset.analysis.estimatedMarketPrice?.toFixed(0)}`}
                                        </span>
                                     ) : (
                                        <span className="text-[9px] font-bold text-white/30 leading-none">点击进行评估</span>
                                     )}
                                  </div>
                               </div>
                               <div className="space-y-0.5 text-right">
                                  <p className="text-[7px] font-bold text-white/20 uppercase tracking-[0.5px]">当前实际日耗</p>
                                  <div className="flex items-baseline justify-end gap-1">
                                    <span className="text-[13px] font-black text-white/90 leading-none">¥{asset.actualDailyCost?.toFixed(1)}</span>
                                    <div className={cn(
                                      "size-1 rounded-full animate-pulse",
                                      (asset.actualDailyCost || 0) > (asset.targetDailyCost || 0) ? "bg-red-500" : "bg-emerald-500"
                                    )} />
                                  </div>
                               </div>
                            </div>

                            <div className="mt-3 relative z-10 px-0.5">
                               <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-[7px] font-black uppercase text-white/20 tracking-widest leading-none">生命周期监控带</span>
                                  <span className="text-[7px] font-bold text-white/30 uppercase">陪伴 {asset.days} 天</span>
                               </div>
                               
                               <div className="relative h-2 flex items-center">
                                 <div className="absolute inset-0 h-[3px] bg-white/5 rounded-full my-auto" />
                                 <motion.div
                                   initial={{ width: 0 }}
                                   animate={{ width: `${progress}%` }}
                                   className={cn(
                                     "absolute h-[3px] top-0.5 rounded-full transition-all duration-1000",
                                     asset.healthStatus === 'danger' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : "bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                   )}
                                 />
                               </div>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : currentView === "analysis" ? (
              <motion.div 
                key="analysis-view"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="space-y-4 pb-12"
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentView("dashboard")}
                    className="size-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-[#1C1C1E] active:scale-90 transition-transform"
                  >
                    <ChevronRight className="size-5 rotate-180" strokeWidth={2.5} />
                  </button>
                  <h2 className="text-sm font-bold tracking-tight">
                    智能追踪洞察
                  </h2>
                </div>
                  <div className="flex items-center gap-2">
                     <span className="px-2 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[8px] font-bold rounded-lg border border-[#F97316]/20 tabular-nums">
                      {stats.assets.length} 项资产
                    </span>
                  </div>

                {/* Smart Alert Panel - Foldable & Graded */}
                {(() => {
                  const criticals = stats.assets.filter(a => a.analysis?.priority === 'critical' || (a.hedgingRate ?? 0) < 55);
                  const warnings = stats.assets.filter(a => a.analysis?.priority === 'warning' || (a.healthStatus === 'warning' && !criticals.find(c => c.id === a.id)));
                  
                  const showAlerts = criticals.length > 0 || warnings.length > 0;
                  
                  if (!showAlerts) return (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-5 flex items-center gap-4">
                      <div className="size-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-0.5 tracking-widest">全盘健康</p>
                        <p className="text-[11px] font-medium text-emerald-900/80 leading-tight">所有资产均在理想效用区间，建议保持现状，享受数字生活。</p>
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-3">
                      {/* Summary Card if multiple items */}
                      {(criticals.length + warnings.length) > 2 && (
                        <button 
                          onClick={() => setInsightExpanded(!insightExpanded)}
                          className="w-full bg-[#1C1C1E] text-white rounded-3xl p-4 flex items-center justify-between border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400">
                              <Zap className="size-4" fill="currentColor" />
                            </div>
                            <p className="text-[11px] font-bold">您有 {criticals.length + warnings.length} 项资产建议及时关注动态</p>
                          </div>
                          <ChevronRight className={cn("size-4 text-white/40 transition-transform duration-300", insightExpanded && "rotate-90")} />
                        </button>
                      )}

                      <AnimatePresence>
                        {(insightExpanded || (criticals.length + warnings.length) <= 2) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {criticals.map(asset => (
                              <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                key={`alert-crit-${asset.id}`}
                                className="relative bg-red-50 border border-red-100 rounded-[28px] p-4 flex items-center gap-4 overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12">
                                  <AlertTriangle className="size-16 text-red-600" />
                                </div>
                                <div className="size-11 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 flex-shrink-0">
                                  <Zap className="size-5" fill="currentColor" />
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="px-1.5 py-0.5 bg-red-600 text-white text-[7px] font-black rounded-sm uppercase tracking-widest">Action</span>
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">行动指令：换代暴跌预警</p>
                                  </div>
                                  <p className="text-[11px] font-bold text-red-900 leading-tight">
                                    「{asset.name}」残值面临断崖式下行风险，建议未来 7 天内离场！
                                  </p>
                                </div>
                              </motion.div>
                            ))}

                            {criticals.length < 2 && warnings.slice(0, 2 - criticals.length).map(asset => (
                              <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                key={`alert-warn-${asset.id}`}
                                className="bg-amber-50 border border-amber-100 rounded-[28px] p-4 flex items-center gap-4"
                              >
                                <div className="size-11 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
                                  <TrendingDown className="size-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-amber-600 uppercase mb-1 tracking-widest">效用监控：持有策略变动</p>
                                  <p className="text-[11px] font-bold text-amber-900 leading-tight">
                                    「{asset.name}」当前单位效用开始下降，建议关注同类二手行情波动。
                                  </p>
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                  </div>
                );
              })()}

                {stats.assets.map((asset) => (
                  <div
                    key={`analysis-${asset.id}`}
                    className="bg-white rounded-[32px] p-5 shadow-sm border border-[#F1F1F1] space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-[#F8FAFC] rounded-xl flex items-center justify-center border border-[#F1F1F1] overflow-hidden">
                          {getAssetIcon(asset.name, asset.imageUrl)}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-[#1C1C1E]">
                            {asset.name}
                          </h3>
                          <p className="text-[8px] font-bold text-[#8E9299]">
                            {(asset.lScore ?? 0) > 85
                              ? "极易出手"
                              : (asset.lScore ?? 0) > 65
                                ? "平稳观望"
                                : "建议长持"}{" "}
                            · 变现力评分 {asset.lScore}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-[#8E9299] uppercase font-mono">
                          24H 波动
                        </p>
                        <p
                          className={cn(
                            "text-xs font-bold flex items-center gap-1 justify-end tabular-nums",
                            asset.todayChange >= 0
                              ? "text-[#10B981]"
                              : "text-red-500",
                          )}
                        >
                          {asset.todayChange >= 0 ? (
                            <TrendingUp className="size-3" />
                          ) : (
                            <TrendingDown className="size-3" />
                          )}
                          {asset.todayChange >= 0 ? "+" : ""}
                          {asset.todayChange.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="h-32 w-full pt-2 relative">
                      {asset.isUnrecognized ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 rounded-2xl border border-dashed border-white/10">
                          <Search className="size-6 text-white/20 mb-1" />
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">无信号 / 缺失数据</span>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={asset.candlestickData}>
                            <defs>
                              <linearGradient
                                id={`glow-${asset.id}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={
                                    asset.todayChange >= 0 ? "#10B981" : "#EF4444"
                                  }
                                  stopOpacity={0.25}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={
                                    asset.todayChange >= 0 ? "#10B981" : "#EF4444"
                                  }
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 6"
                              vertical={false}
                              opacity={0.03}
                            />
                            <Area
                              type="monotone"
                              dataKey="close"
                              stroke={
                                asset.todayChange >= 0 ? "#10B981" : "#EF4444"
                              }
                              strokeWidth={3}
                              fill={`url(#glow-${asset.id})`}
                              animationDuration={1500}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : currentView === "warehouse" ? (
              <motion.div 
                key="warehouse-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pb-24"
              >
                <div className="flex items-center justify-between sticky top-0 py-4 bg-[#F8F9FA]/80 backdrop-blur-md z-40 -mx-6 px-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setCurrentView("dashboard")}
                      className="size-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-[#1C1C1E]"
                    >
                      <ChevronRight className="size-5 rotate-180" strokeWidth={2.5} />
                    </button>
                    <h2 className="text-sm font-black tracking-tight uppercase">资产备库资源</h2>
                  </div>
                </div>

                <div className="flex gap-2 p-1.5 bg-white/50 rounded-2xl border border-black/5 relative">
                  {(["all", "serving", "retired", "sold"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "relative flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase transition-all z-10",
                        activeTab === tab ? "text-white" : "text-[#8E9299]"
                      )}
                    >
                      {activeTab === tab && (
                        <motion.div
                          layoutId="warehouse-tab-bg"
                          className="absolute inset-0 bg-[#0F172A] rounded-xl -z-10 shadow-lg shadow-black/10"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      {tab === "all" ? "全部" : tab === "serving" ? "服役中" : tab === "retired" ? "荣誉退役" : "已变现"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 mt-2">
                  {stats.assets
                    .filter(a => {
                      if (activeTab === "serving") return !a.isSold && !a.isRetired;
                      if (activeTab === "sold") return a.isSold;
                      if (activeTab === "retired") return a.isRetired;
                      return true;
                    })
                    .map(asset => (
                      <div 
                        key={`warehouse-${asset.id}`}
                        onClick={() => setSelectedAsset(asset)}
                        className="bg-white rounded-[32px] p-5 shadow-sm border border-[#F1F1F1] flex items-center justify-between group active:scale-95 transition-all"
                      >
                         <div className="flex items-center gap-4">
                           <div className="size-12 bg-[#F8FAFC] rounded-2xl flex items-center justify-center border border-[#F1F1F1] group-hover:scale-110 transition-transform">
                             {getAssetIcon(asset.name, asset.imageUrl)}
                           </div>
                           <div>
                             <h3 className="text-xs font-black text-[#1C1C1E]">{asset.name}</h3>
                             <p className="text-[9px] font-bold text-[#8E9299] uppercase mt-0.5">
                               {asset.isSold 
                                 ? `变现于 ${hideAmounts ? "¥****" : `¥${asset.soldPrice?.toLocaleString()}`}` 
                                 : `实际成本 ${hideAmounts ? "¥**.**" : `¥${asset.actualDailyCost?.toFixed(1)}`}/天`}
                             </p>
                           </div>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                              asset.isSold ? "bg-black/5 text-[#8E9299]" : "bg-emerald-500/10 text-emerald-500"
                            )}>
                              {asset.isSold ? "已清仓" : "在库"}
                            </span>
                            <ChevronRight className="size-4 text-black/10 mt-1" />
                         </div>
                      </div>
                    ))}
                  {stats.assets.filter(a => {
                      if (activeTab === "serving") return !a.isSold && !a.isRetired;
                      if (activeTab === "sold") return a.isSold;
                      if (activeTab === "retired") return a.isRetired;
                      return true;
                  }).length === 0 && (
                    <div className="py-20 text-center space-y-4">
                       <div className="size-16 bg-white/50 rounded-full flex items-center justify-center mx-auto border border-dashed border-black/10">
                          <Box className="size-6 text-black/10" />
                       </div>
                       <p className="text-[10px] font-black text-black/20 uppercase tracking-[3px]">暂无对应资产类别</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="settings-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6 pb-24"
              >
                <div className="flex items-center gap-4 py-4">
                   <button 
                      onClick={() => setCurrentView("dashboard")}
                      className="size-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-[#1C1C1E]"
                    >
                      <ChevronRight className="size-5 rotate-180" strokeWidth={2.5} />
                    </button>
                    <h2 className="text-sm font-black tracking-tight uppercase">系统控制中枢</h2>
                </div>

                <div className="bg-[#1C1C1E] rounded-[40px] p-8 text-white relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <Cpu className="size-24" />
                   </div>
                   <div className="relative z-10">
                      <div className="size-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                         <Wallet className="size-8 text-[#F97316]" />
                      </div>
                      <h3 className="text-xl font-black">AI 智能终端 V2.4</h3>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-[3px] mt-1">状态：运行平稳</p>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="bg-white rounded-[32px] p-2 space-y-1 shadow-sm border border-[#F1F1F1]">
                      <div className="flex items-center justify-between p-4 px-6 hover:bg-neutral-50 rounded-[24px] cursor-pointer" onClick={() => setHideAmounts(!hideAmounts)}>
                         <div className="flex items-center gap-4">
                            <div className="size-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                               {hideAmounts ? <Wifi className="size-5" /> : <Signal className="size-5" />}
                            </div>
                            <span className="text-xs font-bold text-[#1C1C1E]">隐身模式</span>
                         </div>
                         <div className={cn(
                           "w-12 h-6 rounded-full transition-all flex items-center p-1",
                           hideAmounts ? "bg-[#10B981]" : "bg-neutral-200"
                         )}>
                            <div className={cn("size-4 bg-white rounded-full transition-transform", hideAmounts && "translate-x-6")} />
                         </div>
                      </div>
                      <div className="flex items-center justify-between p-4 px-6 hover:bg-neutral-50 rounded-[24px] cursor-pointer">
                         <div className="flex items-center gap-4">
                            <div className="size-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                               <RefreshCw className="size-5" />
                            </div>
                            <span className="text-xs font-bold text-[#1C1C1E]">自动全天候行情同步</span>
                         </div>
                         <span className="text-[8px] font-black text-[#10B981] bg-emerald-50 px-2 py-1 rounded-md">已激活</span>
                      </div>
                   </div>

                   <div className="bg-white rounded-[32px] p-2 space-y-1 shadow-sm border border-[#F1F1F1]">
                      <div className="flex items-center justify-between p-4 px-6 hover:bg-red-50 text-red-500 rounded-[24px] cursor-pointer group" onClick={handleClearData}>
                         <div className="flex items-center gap-4">
                            <div className="size-10 bg-red-50 rounded-xl flex items-center justify-center transition-colors">
                               <Trash2 className="size-5" />
                            </div>
                            <span className="text-xs font-black">格式化所有系统数据</span>
                         </div>
                         <p className="text-[9px] font-black opacity-40">危险操作</p>
                      </div>
                   </div>
                </div>

                <div className="pt-6 text-center">
                   <p className="text-[10px] font-bold text-[#8E9299]">有数 (AssetSync) 协议 • {format(new Date(), 'yyyy')}</p>
                   <p className="text-[8px] font-black text-black/10 uppercase tracking-[4px] mt-1">为数字原住民打造</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Floating Navigation Pill */}
          <div className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-[72px] bg-[#020617] rounded-full shadow-[0_30px_60px_-12px_rgba(15,23,42,0.6)] flex items-center px-1 z-[60] border border-white/10">
            <div className="flex-1 flex justify-around items-center">
              <button
                onClick={() => setCurrentView("dashboard")}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  currentView === "dashboard" ? "text-indigo-400" : "text-white/20",
                )}
              >
                <div className="p-2.5 rounded-full">
                  <Home
                    className="size-5"
                    strokeWidth={currentView === "dashboard" ? 2.5 : 2}
                  />
                </div>
              </button>
              <button
                onClick={() => setCurrentView("analysis")}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  currentView === "analysis" ? "text-indigo-400" : "text-white/20",
                )}
              >
                <div className="p-2.5 rounded-full">
                  <TrendingUp
                    className="size-5"
                    strokeWidth={currentView === "analysis" ? 2.5 : 2}
                  />
                </div>
              </button>
            </div>

            <button
              onClick={handleOpenAdd}
              className="size-16 -mt-2 bg-white rounded-full flex items-center justify-center shadow-[0_12px_24px_-4px_rgba(79,70,229,0.4)] group active:scale-90 transition-all border-4 border-[#020617]"
            >
              <div className="size-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-inner">
                <Plus
                  className="size-7 transition-transform group-hover:rotate-90"
                  strokeWidth={3}
                />
              </div>
            </button>

            <div className="flex-1 flex justify-around items-center">
              <button 
                onClick={() => setCurrentView("warehouse")}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  currentView === "warehouse" ? "text-indigo-400" : "text-white/20",
                )}
              >
                <div className="p-2.5 rounded-full">
                  <Box className="size-5" strokeWidth={currentView === "warehouse" ? 2.5 : 2} />
                </div>
              </button>
              <button 
                onClick={() => setCurrentView("settings")}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  currentView === "settings" ? "text-indigo-400" : "text-white/20",
                )}
              >
                <div className="p-2.5 rounded-full">
                  <Settings className="size-5" strokeWidth={currentView === "settings" ? 2.5 : 2} />
                </div>
              </button>
            </div>
          </div>

          {/* Poster Modal - Redesigned: Black-Gold Research Report */}
          <AnimatePresence>
            {showPoster && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-black/80 backdrop-blur-md"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#111,black)] pointer-events-none" />
                
                <button
                  onClick={() => setShowPoster(false)}
                  className="absolute top-10 right-8 size-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 z-20"
                >
                  <X className="size-5" />
                </button>

                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-[340px] aspect-[1/1.5] bg-[#0A0A0A] rounded-[48px] p-8 relative overflow-hidden border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] group"
                >
                  {/* Holographic Light Effect */}
                  <motion.div 
                    animate={{ x: [0, 100, 0, -100, 0], y: [0, -50, 0, 50, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 pointer-events-none opacity-20 bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.1),transparent,rgba(249,115,22,0.1),transparent)] blur-3xl scale-150 rotate-45" 
                  />

                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-amber-400 rounded-2xl flex items-center justify-center text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                          <Zap fill="currentColor" className="size-6" />
                        </div>
                        <div className="font-black italic tracking-tighter text-lg leading-tight text-amber-100/90 whitespace-nowrap">
                          资产研究报告
                          <br />
                          <span className="text-[7px] tracking-[5px] opacity-40 not-italic uppercase font-bold">加密终端</span>
                        </div>
                      </div>

                      <div className="pt-6">
                        <p className="text-[9px] font-black uppercase tracking-[5px] text-amber-500/80 mb-2">资产组合估值</p>
                        <h3 className="text-4xl font-black font-mono tracking-tighter text-white tabular-nums">
                          {hideAmounts ? "¥***,***" : `¥${stats.totalMarketValue.toLocaleString()}`}
                        </h3>
                        <div className="mt-4 flex items-center gap-2">
                          <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[8px] font-black rounded-md border border-amber-500/20 italic tracking-widest">前 2% 财务精英</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                       <div className="p-5 bg-white/[0.03] rounded-[32px] border border-white/5 space-y-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none">安全等级</span>
                             <span className="text-[15px] font-black text-amber-400 font-mono">
                                {stats.portfolioHedgingRate > 100 ? "A+" : "A"}
                             </span>
                          </div>
                          <div className="h-px bg-white/5 w-full" />
                          <div className="space-y-1.5">
                             <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">AI 市场行情分析</p>
                             <p className="text-[12px] font-bold text-white/80 leading-snug italic">
                                “{stats.portfolioHedgingRate > 80 ? "击败 98% 消费者的理智，将每一分钱转化为生产力。" : "理智消费的终极形态：资产与价值的完美共振。"}”
                             </p>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-end justify-between pt-4">
                       <div className="space-y-2">
                          <div className="size-8 bg-white/5 rounded-lg flex items-center justify-center">
                             <Box className="size-4 text-white/20" />
                          </div>
                          <p className="text-[7px] font-black text-white/20 uppercase tracking-[4px]">系统完整性级别 v2.4</p>
                       </div>
                       <div className="size-16 bg-white/[0.03] p-1 rounded-xl border border-white/5">
                          <div className="size-full bg-white flex items-center justify-center p-2 rounded-lg">
                             <div className="size-full bg-black rounded-sm" />
                          </div>
                       </div>
                    </div>
                  </div>
                </motion.div>

                <div className="mt-12 w-full max-w-[340px] grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setHideAmounts(!hideAmounts)}
                    className="group py-5 bg-white/5 rounded-[28px] text-[10px] font-black text-white uppercase tracking-[2px] flex items-center justify-center gap-3 backdrop-blur-xl border border-white/10 active:scale-95 transition-all"
                  >
                    <div className={cn("size-6 bg-white/10 rounded-full flex items-center px-1 transition-all", hideAmounts && "bg-amber-500")}>
                       <motion.div animate={{ x: hideAmounts ? 12 : 0 }} className="size-4 bg-white rounded-full shadow-lg" />
                    </div>
                    {hideAmounts ? "已隐价格" : "显示价格"}
                  </button>
                  <button 
                    onClick={() => showFeatureToast("保存图片")}
                    className="py-5 bg-amber-400 rounded-[28px] text-[10px] font-black text-black uppercase tracking-[2px] flex items-center justify-center gap-2 shadow-[0_20px_40px_-5px_rgba(251,191,36,0.3)] active:scale-95 transition-all"
                  >
                    <Share2 className="size-4" strokeWidth={3} /> 保存海报
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Toast */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ y: 20, opacity: 0, x: "-50%" }}
                animate={{ y: 0, opacity: 1, x: "-50%" }}
                exit={{ y: -20, opacity: 0, x: "-50%" }}
                className="fixed top-[calc(16px+env(safe-area-inset-top))] left-1/2 z-[400] px-6 py-3 bg-[#1C1C1E] text-white rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3"
              >
                <div className="size-5 bg-[#10B981] rounded-full flex items-center justify-center">
                  <CheckCircle2 className="size-3 text-white" strokeWidth={3} />
                </div>
                <span className="text-[11px] font-bold tracking-wide whitespace-nowrap">
                  {successMsg}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full opacity-5" />

          {/* Detail View */}
          <AnimatePresence>
            {selectedAsset && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 300,
                  mass: 0.8,
                }}
                className="fixed inset-0 z-[100] bg-[#1C1C1E] overflow-hidden flex flex-col"
              >
                <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden">
                  <div className="h-[280px] bg-[#1C1C1E] relative flex-shrink-0 border-b border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1E] to-transparent opacity-60" />
                    <button
                      onClick={() => setSelectedAsset(null)}
                      className="absolute top-[calc(16px+env(safe-area-inset-top))] left-6 size-10 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 z-10 active:scale-90 transition-transform"
                    >
                      <X className="size-5" strokeWidth={2.5} />
                    </button>
                    
                    <button
                      onClick={() => {
                        if (deleteConfirmId === selectedAsset.id) {
                          removeAsset(selectedAsset.id, true);
                        } else {
                          setDeleteConfirmId(selectedAsset.id);
                          setTimeout(() => setDeleteConfirmId(prev => prev === selectedAsset.id ? null : prev), 3000);
                        }
                      }}
                      className={cn(
                        "absolute top-4 right-6 px-4 h-10 backdrop-blur-xl rounded-full flex items-center justify-center z-10 active:scale-90 transition-all text-[10px] font-black uppercase tracking-widest gap-2",
                        deleteConfirmId === selectedAsset.id 
                          ? "bg-red-600 text-white border-red-400 animate-pulse" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      )}
                    >
                      <Trash2 className="size-3.5" />
                      {deleteConfirmId === selectedAsset.id ? "再次点击确认" : "移除资产"}
                    </button>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white pt-10 text-center px-8">
                      <div className="size-20 bg-white/5 backdrop-blur-2xl rounded-[32px] flex items-center justify-center border border-white/10 mb-5 shadow-2xl relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/20 to-transparent rounded-[32px]" />
                        <div className="relative z-10 brightness-200 contrast-125">
                          {getAssetIcon(selectedAsset.name, selectedAsset.imageUrl)}
                        </div>
                      </div>
                      <h2 className={cn(
                        "font-black tracking-tight text-white leading-tight max-w-full px-6 break-words text-center",
                        selectedAsset.name.length > 12 ? "text-xl" : "text-2xl"
                      )}>
                        {selectedAsset.name}
                      </h2>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-white/40 uppercase tracking-[2px] border border-white/5">
                          {selectedAsset.category || "常规"}
                        </span>
                        <span className="px-3 py-1 bg-[#F97316]/10 rounded-full text-[9px] font-black text-[#F97316] uppercase tracking-[2px] border border-[#F97316]/10">
                          {selectedAsset.healthGrade} 级
                        </span>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-14 bg-[#2C2C2E] rounded-t-[32px] flex items-center justify-center border-t border-white/5 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                      <span className="text-[10px] font-bold uppercase tracking-[4px] text-[#F97316]">
                        市场洞察建议
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 bg-[#2C2C2E] px-8 pt-6 overflow-y-auto scrollbar-hide text-white">
                    <div className="space-y-8 pb-32">
                      {selectedAsset.isUnrecognized && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-[28px] p-5 flex items-start gap-4">
                           <div className="size-10 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500 flex-shrink-0 animate-pulse">
                              <AlertTriangle className="size-5" />
                           </div>
                           <div className="space-y-1">
                              <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">系统校验告警</p>
                              <p className="text-[11px] font-medium text-orange-100/80 leading-relaxed">检测到非标资产。因缺失底层市场报价，已禁用波动监测与AI精算功能。请修正名称或尝试手动锚定。</p>
                           </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-end border-b border-white/10 pb-6 relative">
                        {selectedAsset.isUnrecognized && (
                          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center border border-dashed border-white/10">
                             <div className="flex flex-col items-center gap-1">
                               <Search className="size-5 text-white/40" />
                               <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">行情源离线</span>
                             </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-white/40 font-bold uppercase mb-1">
                            买入价格
                          </p>
                          <p className="text-3xl font-bold font-mono tracking-tighter tabular-nums text-white/95">
                            ¥{hideAmounts ? "******" : (selectedAsset.price ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div
                            className={cn(
                              "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest",
                              selectedAsset.analysis?.suggestion === "sell"
                                ? "bg-red-500/20 text-red-500 border border-red-500/10"
                                : selectedAsset.analysis?.suggestion ===
                                    "monitor"
                                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/10"
                                  : selectedAsset.analysis?.suggestion ===
                                      "hold"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10"
                                    : "bg-white/5 text-white/40 border border-white/5",
                            )}
                          >
                            {selectedAsset.analysis?.suggestion === "sell"
                              ? "极易出手 · 建议变现"
                              : selectedAsset.analysis?.suggestion === "monitor"
                                ? "平稳观望 · 持续关注"
                                : selectedAsset.analysis?.suggestion === "hold"
                                  ? "建议长持 · 健康持有"
                                  : "等待评估 · --"}
                          </div>
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                            行动建议 ·{" "}
                            {(selectedAsset.lScore ?? 0) > 85
                              ? "推荐交易"
                              : "观察走势"}
                          </p>
                        </div>
                      </div>

                      <div className="relative pt-6">
                        {/* Life Energy Belt - Detail Version */}
                        <div className="px-1">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="size-3 bg-emerald-500 rounded-full animate-ping" />
                              <span className="text-[11px] font-black uppercase text-white/40 tracking-[4px]">资产能量带宽</span>
                            </div>
                            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                              <span className="text-[10px] font-black text-white/80 tracking-tighter tabular-nums">已锚定 {selectedAsset.days} 轮次</span>
                            </div>
                          </div>
                          
                          <div className="relative h-12 flex items-center bg-white/5 rounded-3xl border border-white/5 px-4 overflow-hidden shadow-inner">
                            {/* Track Rail */}
                            <div className="absolute left-4 right-4 h-1.5 bg-white/5 rounded-full" />
                            
                            {/* Progress Belt */}
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (selectedAsset.days / (selectedAsset.targetDailyCost ? selectedAsset.price / selectedAsset.targetDailyCost : 1000)) * 100)}%` }}
                              className={cn(
                                "absolute h-3 left-4 rounded-full transition-all duration-1000",
                                selectedAsset.healthStatus === 'heroic' 
                                  ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-purple-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]"
                                  : "bg-gradient-to-r from-[#10B981] to-[#6EE7B7] shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                              )}
                            />

                            {/* Milestone Nodes */}
                            {selectedAsset.milestones?.map((node, i) => {
                              const pos = Math.min(100, (node.day / (selectedAsset.targetDailyCost ? selectedAsset.price / selectedAsset.targetDailyCost : 1000)) * 100);
                              return (
                                <div 
                                  key={i}
                                  className={cn(
                                    "absolute size-8 rounded-full flex items-center justify-center transition-all duration-1000 border-2 z-20",
                                    node.reached 
                                      ? "bg-white border-[#10B981] scale-110 shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                                      : "bg-[#2C2C2E] border-white/10 scale-90"
                                  )}
                                  style={{ left: `calc(1rem + (100% - 2rem) * ${pos / 100})`, transform: 'translateX(-50%)' }}
                                >
                                  <div className={cn("size-3 rounded-full", node.reached ? "bg-[#10B981]" : "bg-white/10")} />
                                  {node.reached && (
                                    <motion.div 
                                      initial={{ y: 20, opacity: 0 }}
                                      animate={{ y: -30, opacity: 1 }}
                                      className="absolute whitespace-nowrap text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-black/40 px-2 py-1 rounded-md backdrop-blur-md border border-white/10"
                                    >
                                      {node.label} ✨
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* AI Re-Evaluation Section */}
                      <div className="space-y-6">
                        {/* Tags / Info Pills */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar scrollbar-hide py-1">
                          <div className={cn(
                            "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 whitespace-nowrap shadow-lg",
                            selectedAsset.healthStatus === "heroic"
                              ? "bg-purple-900/30 text-yellow-400 border-yellow-500/30"
                              : selectedAsset.healthStatus === "healthy" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {selectedAsset.healthStatus === 'heroic' && <Award className="size-3" />}
                            核心评定：{selectedAsset.statusTag}
                          </div>
                          <div className="px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border bg-white/5 text-white/60 border-white/10 whitespace-nowrap">
                            流动性：{selectedAsset.lRating} 级
                          </div>
                          <div className="px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border bg-white/5 text-white/60 border-white/10 whitespace-nowrap">
                            市场需求：{selectedAsset.marketDemandIndex}%
                          </div>
                        </div>

                        {/* Concentric Health Rings Dashboard - Stacked Layout */}
                        <div className="relative group bg-white/5 p-8 rounded-[40px] border border-white/5 overflow-hidden">
                           {/* Decorative Grid */}
                           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                           
                           {selectedAsset.isUnrecognized ? (
                             <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px] border border-dashed border-white/10 rounded-[32px] bg-black/20">
                               <div className="size-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-4 animate-pulse">
                                  <Search className="size-8 text-white/10" />
                               </div>
                               <p className="text-[10px] font-black uppercase tracking-[4px] text-white/20">Evaluation Offline</p>
                               <p className="text-[11px] text-white/40 mt-2 max-w-[200px] text-center leading-relaxed font-bold">系统无法匹配标准资产品类，无法生成效用雷达图。</p>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-8 relative z-10">
                                {/* The Rings - Centered */}
                                <div className="relative size-48 flex items-center justify-center">
                                   <svg className="size-48 -rotate-90">
                                      <circle cx="96" cy="96" r="84" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-white/5" />
                                      <motion.circle 
                                        cx="96" cy="96" r="84" 
                                        stroke="currentColor" strokeWidth="14" fill="transparent" 
                                        strokeDasharray={2 * Math.PI * 84}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 84 }}
                                        animate={{ strokeDashoffset: 2 * Math.PI * 84 * (1 - Math.max(0.1, Math.min(1, (selectedAsset.targetDailyCost || 1) / (selectedAsset.actualDailyCost || 1)))) }}
                                        className={cn(
                                          (selectedAsset.actualDailyCost || 0) > (selectedAsset.targetDailyCost || 1) ? "text-red-500" : "text-emerald-400"
                                        )}
                                      />
                                      
                                      <circle cx="96" cy="96" r="64" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-white/5" />
                                      <motion.circle 
                                        cx="96" cy="96" r="64" 
                                        stroke="#F97316" strokeWidth="14" fill="transparent" 
                                        strokeDasharray={2 * Math.PI * 64}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 64 }}
                                        animate={{ strokeDashoffset: 0 }}
                                        strokeLinecap="round"
                                        className="drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                                      />
                                   </svg>
                                   <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-1">
                                       <span className="text-4xl font-black tabular-nums">{selectedAsset.analysis ? selectedAsset.efficiencyScore : "--"}</span>
                                       <span className="text-[9px] font-black text-white/30 uppercase tracking-[4px]">{selectedAsset.analysis ? "诊断结论" : "等待评估"}</span>
                                   </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8 w-full border-t border-white/5 pt-8">
                                   <div className="text-center">
                                      <div className="flex items-center justify-center gap-2 mb-2">
                                         <div className="size-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                         <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">实际日耗压力</p>
                                      </div>
                                      <div className="flex items-baseline justify-center gap-1">
                                         <span className="text-2xl font-black font-mono">¥{selectedAsset.actualDailyCost?.toFixed(2)}</span>
                                      </div>
                                   </div>

                                   <div className="text-center">
                                      <div className="flex items-center justify-center gap-2 mb-2">
                                         <div className="size-2 rounded-full bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                                         <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">目标基准线</p>
                                      </div>
                                      <div className="flex items-baseline justify-center gap-1">
                                         <span className="text-2xl font-black font-mono text-white/60">¥{selectedAsset.targetDailyCost?.toFixed(2)}</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                           )}
                           {!selectedAsset.isUnrecognized && (
                             <div className="flex justify-between mt-6 px-2">
                               <p className="text-[9px] font-black text-white/20 uppercase tracking-[3px]">系统运行负荷</p>
                               <p className={cn(
                                 "text-[9px] font-black uppercase tracking-[3px]",
                                 (selectedAsset.actualDailyCost || 0) > (selectedAsset.targetDailyCost || 1) ? "text-red-400" : "text-emerald-400"
                               )}>
                                 {((selectedAsset.actualDailyCost || 0) / (selectedAsset.targetDailyCost || 1) * 100).toFixed(0)}% 负荷
                               </p>
                             </div>
                           )}
                        </div>

                        {/* Flattened AI Section */}
                        <div className="pt-4 relative">
                          <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="size-8 bg-[#F97316]/20 rounded-xl flex items-center justify-center text-[#F97316] shadow-inner">
                              <Sparkles fill="currentColor" className="size-4" />
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-white tracking-[2px] leading-tight">AI 核心结论</p>
                               <p className="text-[8px] font-bold text-[#F97316] uppercase tracking-[1px] opacity-60">Intelligence Protocol Phase 3</p>
                            </div>
                          </div>

                          <div className="text-[14px] leading-[1.7] text-white/80 font-medium tracking-normal px-2">
                            {(() => {
                              if (!selectedAsset.analysis) {
                                return (
                                  <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] text-center space-y-4">
                                    <div className="size-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                      <Zap className="size-6 text-white/20" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-white font-bold text-sm tracking-tight">等待启动行情监测</p>
                                      <p className="text-white/40 text-[11px] leading-relaxed px-4">
                                        基于新入库资产，我们需要链接 AI 核心引擎以同步当前二级市场的真实残值行情。
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleAnalyze(selectedAsset!)}
                                      className="w-full py-4 bg-[#F97316]/10 hover:bg-[#F97316]/20 text-[#F97316] rounded-2xl text-[11px] font-black uppercase tracking-[2px] transition-all"
                                    >
                                      {analyzingId === selectedAsset.id ? "同步算力中..." : "立刻评估市场行情"}
                                    </button>
                                  </div>
                                );
                              }

                              if (selectedAsset.isUnrecognized) {
                                return (
                                  <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl italic text-[13px] leading-relaxed">
                                    <span className="text-orange-500 font-black mr-2 tracking-widest">【无法识别型号】</span>
                                    AI 未能从当前公开数据库及二手平台中精准锁定该型号。可能原因：名称过于宽泛、品牌非主流或输入有误。
                                    <br/><br/>
                                    <span className="text-white/60">无法为您提供实时的行情对比。建议您通过修改名称来重试，或手动参考该资产的二手均价。</span>
                                  </div>
                                );
                              }

                              // If we have analysis and it is recognized
                              const days = selectedAsset.days || 3;
                              const isShield = days <= 30;
                              const isAction = selectedAsset.analysis?.priority === 'critical';
                              
                              return (
                                <div className="space-y-4">
                                  <p className="text-white/90 leading-relaxed">
                                    {selectedAsset.analysis.reasoning}
                                  </p>
                                  
                                  <div className="grid grid-cols-3 bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                                    <div className="p-3 text-center border-r border-white/5">
                                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">行情信心</p>
                                      <p className="text-xs font-bold text-emerald-400">{(selectedAsset.analysis.confidence * 100).toFixed(0)}%</p>
                                    </div>
                                    <div className="p-3 text-center border-r border-white/5">
                                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">二手区间</p>
                                      <p className="text-xs font-bold text-white/80">
                                        {selectedAsset.analysis.priceRange 
                                          ? `¥${(selectedAsset.analysis.priceRange.min/1000).toFixed(1)}k-¥${(selectedAsset.analysis.priceRange.max/1000).toFixed(1)}k`
                                          : "--"}
                                      </p>
                                    </div>
                                    <div className="p-3 text-center">
                                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">建议操作</p>
                                      <p className={cn(
                                        "text-xs font-bold uppercase",
                                        selectedAsset.analysis.suggestion === 'hold' ? "text-blue-400" :
                                        selectedAsset.analysis.suggestion === 'sell' ? "text-red-400" : "text-amber-400"
                                      )}>
                                        {selectedAsset.analysis.suggestion === 'hold' ? "坚守持有" :
                                         selectedAsset.analysis.suggestion === 'sell' ? "获利离场" : "持续观望"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {selectedAsset.analysis && (
                            <div className="pt-8 px-2">
                               <button
                                  onClick={() => handleAnalyze(selectedAsset!)}
                                  className="w-full py-5 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-3xl border border-white/10 flex items-center justify-center gap-3 transition-all group overflow-hidden relative"
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                  <RefreshCw className={cn("size-5 text-[#F97316] transition-transform duration-700", analyzingId === selectedAsset.id ? "animate-spin" : "group-hover:rotate-180")} />
                                  <span className={cn(
                                    "text-[11px] font-black uppercase tracking-[3px]",
                                    analyzingId === selectedAsset.id ? "text-orange-400" : "text-white/60"
                                  )}>
                                    {analyzingId === selectedAsset.id ? "正在同步算力..." : "重新评估市场行情"}
                                  </span>
                                </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 pb-24">
                        {selectedAsset.analysis?.suggestion === "sell" && (
                          <button 
                            onClick={() => handleSold(selectedAsset!, selectedAsset.marketPrice || selectedAsset.price * 0.8)}
                            className="w-full py-5 bg-[#F97316] text-white rounded-3xl text-sm font-bold flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                          >
                            <ArrowUpRight className="size-5" strokeWidth={3} />{" "}
                            一键启动变现交易线
                          </button>
                        )}
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleOpenEdit(selectedAsset!)}
                            className="flex-1 py-5 bg-white/5 border border-white/10 rounded-3xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                          >
                            <Settings className="size-4" /> 资产设置
                          </button>
                          <button
                            onClick={() => {
                              if (deleteConfirmId === selectedAsset!.id) {
                                removeAsset(selectedAsset!.id, true);
                              } else {
                                setDeleteConfirmId(selectedAsset!.id);
                                setTimeout(() => setDeleteConfirmId(prev => prev === selectedAsset?.id ? null : prev), 3000);
                              }
                            }}
                            className={cn(
                              "flex-1 py-5 border rounded-3xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                              deleteConfirmId === selectedAsset!.id
                                ? "bg-red-600 text-white border-red-400 animate-pulse"
                                : "bg-white/5 border-white/10 text-red-400 hover:bg-red-500/10"
                            )}
                          >
                            <Trash2 className="size-4" /> 
                            {deleteConfirmId === selectedAsset!.id ? "确认删除?" : "永久移除"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New Asset Dialog */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{
                  type: "spring",
                  damping: 32,
                  stiffness: 300,
                  mass: 0.9,
                }}
                className="fixed inset-0 z-[200] bg-[#1C1C1E] flex flex-col overflow-hidden"
              >
                {/* Header mimicking Detail View */}
                <div className="h-[120px] bg-[#1C1C1E] relative flex-shrink-0 border-b border-white/5 flex items-center px-8 pt-[env(safe-area-inset-top)]">
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setEditingAssetId(null);
                    }}
                    className="absolute top-[calc(16px+env(safe-area-inset-top))] left-6 size-10 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 z-10 active:scale-90 transition-transform"
                  >
                    <X className="size-5" strokeWidth={2.5} />
                  </button>
                  <div className="w-full text-center">
                    <h3 className="text-xl font-bold tracking-tight text-white/95 uppercase">
                      {editingAssetId ? "编辑资产信息" : "新资产入库"}
                    </h3>
                    <p className="text-[10px] text-white/30 font-bold uppercase mt-1 tracking-[3px]">
                      资产协同协议
                    </p>
                  </div>
                </div>

                <div className="flex-1 bg-[#2C2C2E] px-8 pt-4 overflow-y-auto scrollbar-hide text-white">
                  <form onSubmit={handleSaveAsset} className="space-y-6 pb-24">
                    <div className="space-y-2 px-1 mt-2 text-center pb-6 border-b border-white/5">
                        <div className="size-20 bg-white/5 rounded-[28px] flex items-center justify-center border border-white/10 mx-auto mb-4 relative group overflow-hidden">
                           {newAsset.imageUrl ? (
                             <img src={newAsset.imageUrl} alt="preview" className="size-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             <div className="text-white/20"><Camera className="size-6" /></div>
                           )}
                        </div>
                        <label className="text-[9px] font-bold uppercase text-white/30 tracking-[3px]">
                          资产视觉锚点 (头像链接)
                        </label>
                        <input
                          type="url"
                          placeholder="粘贴第三方图片链接以自定义头像..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-base outline-none focus:border-[#F97316] transition-all placeholder:text-white/20 text-center"
                          value={newAsset.imageUrl}
                          onChange={(e) =>
                            setNewAsset({ ...newAsset, imageUrl: e.target.value })
                          }
                        />
                    </div>
                    {/* Form content */}
                    <div className="space-y-2 px-1">
                      <label className="text-[9px] font-bold uppercase text-white/20 ml-2 tracking-widest">
                        资产核心标识与名称
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="例如: iPhone 16 Pro Max..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-base outline-none focus:border-[#F97316] transition-all placeholder:text-white/10"
                        value={newAsset.name}
                        onChange={(e) =>
                          setNewAsset({ ...newAsset, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 px-1">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase text-white/20 ml-2 tracking-widest">
                          买入初始价值 (¥)
                        </label>
                        <input
                          required
                          type="number"
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-lg font-bold outline-none focus:border-[#F97316] transition-all tabular-nums text-[#F97316]"
                          value={newAsset.price}
                          onChange={(e) =>
                            setNewAsset({ ...newAsset, price: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase text-white/20 ml-2 tracking-widest">
                          契约生效日期
                        </label>
                        <div className="relative">
                          <input
                            required
                            type="date"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-base outline-none focus:border-[#F97316] appearance-none"
                            style={{ colorScheme: "dark" }}
                            value={newAsset.purchaseDate}
                            onChange={(e) =>
                              setNewAsset({
                                ...newAsset,
                                purchaseDate: e.target.value,
                              })
                            }
                          />
                          <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 size-4 text-white/20 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 space-y-6 mx-1">
                      <div className="flex items-center justify-between">
                         <label className="text-[9px] font-bold uppercase text-white tracking-[3px] flex items-center gap-2">
                          <Target className="size-3.5 text-[#F97316]" />
                          资产绩效管理策略
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {(["ai", "custom", "period", "ratio"] as const).map(
                          (mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                setNewAsset({
                                  ...newAsset,
                                  targetMode: mode,
                                  targetValue: mode === "ai" ? "AI" : "",
                                })
                              }
                              className={cn(
                                "h-10 rounded-xl text-[9px] font-black transition-all flex items-center justify-center gap-2 border",
                                newAsset.targetMode === mode
                                  ? (mode === "custom" 
                                      ? "bg-[#2C2C2E] text-[#F97316] border-[#F97316] shadow-lg scale-105" 
                                      : "bg-[#F97316] text-white border-[#F97316] shadow-lg scale-105")
                                  : "bg-white/5 text-white/30 border-white/5 hover:text-white/60",
                              )}
                            >
                               {mode === "ai"
                                ? "AI 智能预测"
                                : mode === "custom"
                                  ? "日耗临界点"
                                  : mode === "period"
                                    ? "期望服役周期"
                                    : "年度折旧期望"}
                            </button>
                          ),
                        )}
                      </div>

                      <div className="relative pt-2">
                        {newAsset.targetMode === "ai" ? (
                          <div className="bg-gradient-to-br from-[#F97316]/5 to-transparent border border-[#F97316]/20 rounded-3xl p-6 flex items-center gap-6">
                            <div className="size-14 bg-[#F97316] rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-[0_8px_16px_-4px_rgba(249,115,22,0.4)]">
                              <Cpu className="size-7" />
                            </div>
                            <div>
                              <p className="text-[12px] font-black text-white uppercase tracking-wider mb-0.5">AI 资产智能已激活</p>
                              <p className="text-[10px] text-white/40 font-medium leading-relaxed">系统将动态监测折旧并优化持有建议。</p>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group p-4 bg-white/5 rounded-2xl border border-white/5">
                            <input
                              type="number"
                              className="w-full bg-transparent py-2 text-base font-bold outline-none placeholder:text-white/10 tabular-nums"
                              value={newAsset.targetValue}
                              onChange={(e) =>
                                setNewAsset({
                                  ...newAsset,
                                  targetValue: e.target.value,
                                })
                              }
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#F97316]/60 uppercase tracking-widest">
                              {newAsset.targetMode === "custom"
                                ? "¥/Day"
                                : newAsset.targetMode === "period"
                                  ? "Days"
                                  : "%/Year"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 px-1">
                      <label className="text-[10px] font-bold uppercase text-white/30 ml-2 tracking-widest">
                        管理归档板块
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["电子设备", "房产", "交通工具", "家居", "服饰", "其他"].map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() =>
                                setNewAsset({ ...newAsset, category: cat })
                              }
                              className={cn(
                                "px-2 py-3.5 rounded-[16px] text-[8px] font-black transition-all border flex items-center justify-center text-center",
                                newAsset.category === cat
                                  ? "bg-white border-white text-[#1C1C1E] shadow-lg"
                                  : "bg-white/5 border-white/5 text-white/20",
                              )}
                            >
                              {cat}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="flex justify-center px-4 mt-8 pb-10">
                      <button
                        type="submit"
                        className="w-full h-[52px] bg-indigo-600 text-white rounded-[20px] text-sm font-black shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] active:scale-[0.98] transition-all tracking-[4px] uppercase"
                      >
                        {editingAssetId
                          ? "确认并更新资产档案"
                          : "确认并签署入库协议"}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
  );
}
