import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import { todayISO, addDaysISO } from "../lib/scurveCalc";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import {
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Sliders,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

export default function SCurveTab({ projectId, isOwner, projectTasks = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Time scale switcher state: 'daily' | 'weekly' | 'monthly'
  const [timeScale, setTimeScale] = useState("weekly");

  // View mode switcher: 'matrix' (Sumbu Y = Item Pekerjaan) | 'cumulative' (Kurva S Kumulatif)
  const [viewMode, setViewMode] = useState("matrix");

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .get(`/projects/${projectId}/s-curve`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.detail || "Gagal memuat data Kurva S");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const removeItem = async (id, name) => {
    if (!window.confirm(`Hapus item pekerjaan "${name || "ini"}"?`)) return;
    try {
      await api.delete(`/projects/${projectId}/work-items/${id}`);
      toast.success("Item pekerjaan dihapus");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menghapus item pekerjaan");
    }
  };

  const quickUpdateProgress = async (id, actual) => {
    try {
      await api.patch(`/projects/${projectId}/work-items/${id}`, {
        actual_progress: actual,
      });
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal memperbarui progress");
    }
  };

  const handleSyncFromTasks = async () => {
    if (items.length > 0) {
      if (!window.confirm("Sinkronisasi akan menimpa/menambah item pekerjaan dari daftar tugas Kanban saat ini. Lanjutkan?")) {
        return;
      }
    }
    setSyncing(true);
    try {
      await api.post(`/projects/${projectId}/s-curve/sync-tasks`, {});
      toast.success("Item pekerjaan berhasil disinkronkan dari tugas proyek");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal sinkronisasi tugas");
    } finally {
      setSyncing(false);
    }
  };

  const items = data?.items || [];
  const totalWeight = data?.total_weight || 0;
  const planned = data?.current_planned || 0;
  const actual = data?.current_actual || 0;
  const deviation = actual - planned;
  const weightOff = Math.abs(totalWeight - 100) > 0.05;

  // Active time series based on selected timeScale
  const activeSeries = useMemo(() => {
    if (!data) return [];
    if (timeScale === "daily") return data.series_daily || [];
    if (timeScale === "monthly") return data.series_monthly || [];
    return data.series_weekly || [];
  }, [data, timeScale]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground border border-dashed border-border/50 rounded-xl bg-card/30">
        <RefreshCw className="h-5 w-5 mr-2 animate-spin text-indigo-400" />
        Memuat Kurva S & Item Pekerjaan...
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="s-curve-container">
      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="s-curve-kpis">
        <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-indigo-300 uppercase">
              Progress Rencana
            </span>
            <Clock className="h-4 w-4 text-indigo-400 opacity-80" />
          </div>
          <div className="text-3xl font-extrabold mt-1 text-indigo-100 font-mono">
            {planned.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Target kumulatif saat ini</div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-emerald-300 uppercase">
              Progress Realisasi
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400 opacity-80" />
          </div>
          <div className="text-3xl font-extrabold mt-1 text-emerald-100 font-mono">
            {actual.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Pencapaian fisik aktual</div>
        </div>

        <div
          className={cn(
            "rounded-xl border p-4",
            deviation >= 0
              ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent"
              : "border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-transparent"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wider uppercase",
                deviation >= 0 ? "text-emerald-300" : "text-rose-300"
              )}
            >
              Deviasi Progres
            </span>
            <TrendingUp
              className={cn(
                "h-4 w-4",
                deviation >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            />
          </div>
          <div
            className={cn(
              "text-3xl font-extrabold mt-1 font-mono",
              deviation >= 0 ? "text-emerald-200" : "text-rose-200"
            )}
          >
            {deviation >= 0 ? `+${deviation.toFixed(1)}` : deviation.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {deviation >= 0 ? "Lebih cepat dari rencana" : "Keterlambatan dari rencana"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Total Bobot
            </span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div
            className={cn(
              "text-3xl font-extrabold mt-1 font-mono",
              weightOff ? "text-amber-400" : "text-emerald-400"
            )}
          >
            {totalWeight.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {weightOff ? (
              <span className="text-amber-400 flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3 inline" /> Perlu disesuaikan ke 100%
              </span>
            ) : (
              <span className="text-emerald-400">Total bobot sudah 100%</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. CONTROLS BAR: TIME-SCALE SWITCHER & VIEW SWITCHER */}
      <Card className="border-border bg-card/70 backdrop-blur-sm shadow-sm">
        <CardHeader className="p-4 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <CardTitle className="text-base font-bold text-foreground">
                Visualisasi Kurva S & Linimasa Progres
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Sumbu Y menampilkan item pekerjaan, sumbu X dapat disesuaikan (Harian, Mingguan, Bulanan) dengan indikator persentase di setiap titik.
            </CardDescription>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {isOwner && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncFromTasks}
                  disabled={syncing}
                  className="h-8 text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                  title="Otomatis buat item pekerjaan dari tugas Kanban"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
                  Sinkronkan Tugas
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setDialogOpen(true);
                  }}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
                  data-testid="add-work-item-btn"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Item Baru
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* SWITCHERS TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background/50 p-2.5 rounded-lg border border-border/40">
            {/* Sumbu X: Time Scale Switcher (Daily, Weekly, Monthly) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Sumbu X:
              </span>
              <div className="inline-flex rounded-lg bg-card border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setTimeScale("daily")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    timeScale === "daily"
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  data-testid="scale-daily"
                >
                  Harian (Daily)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeScale("weekly")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    timeScale === "weekly"
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  data-testid="scale-weekly"
                >
                  Mingguan (Weekly)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeScale("monthly")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    timeScale === "monthly"
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  data-testid="scale-monthly"
                >
                  Bulanan (Monthly)
                </button>
              </div>
            </div>

            {/* View Mode Toggle: Matrix (Y = Work Items) vs Cumulative Chart */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Tampilan:
              </span>
              <div className="inline-flex rounded-lg bg-card border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("matrix")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                    viewMode === "matrix"
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  data-testid="view-matrix"
                >
                  <Layers className="h-3 w-3" /> Matriks Item Pekerjaan (Sumbu Y)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cumulative")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                    viewMode === "cumulative"
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  data-testid="view-cumulative"
                >
                  <TrendingUp className="h-3 w-3" /> Kurva S Kumulatif
                </button>
              </div>
            </div>
          </div>

          {/* 3A. VIEW 1: MATRIX S-CURVE (SUMBU Y: ITEM PEKERJAAN, SUMBU X: WAKTU, DENGAN % POINT) */}
          {viewMode === "matrix" && (
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/50 rounded-xl space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Belum ada item pekerjaan. Tambahkan item pekerjaan atau sinkronkan dari tugas proyek.
                  </div>
                  {isOwner && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingItem(null);
                          setDialogOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item Pertama
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncFromTasks}
                        className="text-xs border-indigo-500/30 text-indigo-300"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sinkronkan dari Kanban
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden bg-background/40">
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      {/* Grid Header */}
                      <div className="grid grid-cols-[280px_1fr] border-b border-border bg-card/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="p-3 border-r border-border flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-indigo-300">
                            <Layers className="h-3.5 w-3.5" /> Sumbu Y: Item Pekerjaan
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {items.length} item
                          </span>
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-300">
                            <Calendar className="h-3.5 w-3.5" /> Sumbu X: Linimasa (
                            {timeScale === "daily" ? "Harian" : timeScale === "weekly" ? "Mingguan" : "Bulanan"}
                            ) & Titik Progres (%)
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Hari ini: {data?.today || todayISO()}
                          </span>
                        </div>
                      </div>

                      {/* Header Timeline Columns */}
                      <div className="grid grid-cols-[280px_1fr] border-b border-border/60 bg-muted/20">
                        <div className="p-2.5 border-r border-border text-[10px] text-muted-foreground">
                          Nama Pekerjaan & Bobot
                        </div>
                        <div
                          className="grid divide-x divide-border/30 text-center"
                          style={{
                            gridTemplateColumns: `repeat(${activeSeries.length}, minmax(${timeScale === "daily" ? "52px" : "90px"}, 1fr))`,
                          }}
                        >
                          {activeSeries.map((point, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "py-2 px-1 text-[10px] font-mono transition-colors",
                                point.date === data?.today && "bg-amber-500/10 text-amber-300 font-bold"
                              )}
                              title={point.label}
                            >
                              <div className="truncate font-semibold">{point.label}</div>
                              {point.dayOfWeek && (
                                <div className="text-[9px] text-muted-foreground">{point.dayOfWeek}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Work Items Rows (Sumbu Y) */}
                      <div className="divide-y divide-border/40">
                        {items.map((item, itemIdx) => {
                          const itemProgress = Number(item.actual_progress) || 0;
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[280px_1fr] hover:bg-muted/10 transition-colors group"
                            >
                              {/* Sumbu Y Item Column */}
                              <div className="p-3 border-r border-border space-y-1.5 bg-card/20">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="font-semibold text-xs text-foreground truncate flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-mono">
                                      {itemIdx + 1}
                                    </span>
                                    <span title={item.name}>{item.name}</span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] px-1.5 py-0 border-indigo-500/30 text-indigo-300 bg-indigo-500/5 shrink-0"
                                  >
                                    {Number(item.weight).toFixed(1)}%
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span>
                                    {item.start_date || "—"} s/d {item.end_date || "—"}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-mono font-bold",
                                      itemProgress >= 100
                                        ? "text-emerald-400"
                                        : itemProgress > 0
                                        ? "text-indigo-300"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {itemProgress}%
                                  </span>
                                </div>

                                {/* Quick inline progress bar */}
                                <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      itemProgress >= 100
                                        ? "bg-emerald-500"
                                        : itemProgress > 0
                                        ? "bg-indigo-500"
                                        : "bg-transparent"
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, itemProgress))}%` }}
                                  />
                                </div>
                              </div>

                              {/* Sumbu X Timeline with explicit Point Progress */}
                              <div
                                className="grid divide-x divide-border/20 relative items-center py-2 px-1"
                                style={{
                                  gridTemplateColumns: `repeat(${activeSeries.length}, minmax(${timeScale === "daily" ? "52px" : "90px"}, 1fr))`,
                                }}
                              >
                                {activeSeries.map((colPoint, colIdx) => {
                                  const itPoint = colPoint.itemPoints?.find((p) => p.id === item.id);
                                  const pointActual = itPoint?.actual;
                                  const pointPlanned = itPoint?.planned ?? 0;
                                  const isPastOrToday = colPoint.date <= (data?.today || todayISO());
                                  const inDateRange =
                                    (!item.start_date || colPoint.date >= item.start_date) &&
                                    (!item.end_date || colPoint.date <= item.end_date);

                                  return (
                                    <div
                                      key={colIdx}
                                      className={cn(
                                        "h-12 flex flex-col items-center justify-center relative p-1 rounded transition-all",
                                        colPoint.date === data?.today && "bg-amber-500/5",
                                        inDateRange && "bg-indigo-500/[0.03]"
                                      )}
                                    >
                                      {/* PROGRESS POINT BADGE */}
                                      {isPastOrToday && pointActual !== null ? (
                                        <div
                                          className={cn(
                                            "group/point cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-110",
                                            pointActual >= 100
                                              ? "text-emerald-300"
                                              : pointActual > 0
                                              ? "text-indigo-300"
                                              : "text-muted-foreground/60"
                                          )}
                                          title={`${item.name} (${colPoint.label}): Realisasi ${pointActual}%, Rencana ${pointPlanned}%`}
                                        >
                                          {/* Circle point with explicit percentage text */}
                                          <div
                                            className={cn(
                                              "px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-0.5 shadow-sm border",
                                              pointActual >= 100
                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                                : pointActual > 0
                                                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200"
                                                : "bg-muted/40 border-border/40 text-muted-foreground"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                pointActual >= 100
                                                  ? "bg-emerald-400"
                                                  : pointActual > 0
                                                  ? "bg-indigo-400"
                                                  : "bg-slate-500"
                                              )}
                                            />
                                            <span>{Math.round(pointActual)}%</span>
                                          </div>
                                        </div>
                                      ) : (
                                        /* Future planned point */
                                        <div
                                          className="text-[9px] font-mono text-muted-foreground/40 text-center"
                                          title={`Rencana target: ${pointPlanned}%`}
                                        >
                                          <span className="border border-dashed border-border/40 rounded px-1 py-0.5">
                                            {Math.round(pointPlanned)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cumulative Row at Bottom of Matrix */}
                      <div className="grid grid-cols-[280px_1fr] border-t-2 border-indigo-500/30 bg-card/90 text-xs font-semibold">
                        <div className="p-3 border-r border-border flex items-center justify-between">
                          <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> Total Progres Kumulatif
                          </span>
                          <span className="font-mono text-emerald-400 font-extrabold text-sm">
                            {actual.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="grid divide-x divide-border/30 text-center"
                          style={{
                            gridTemplateColumns: `repeat(${activeSeries.length}, minmax(${timeScale === "daily" ? "52px" : "90px"}, 1fr))`,
                          }}
                        >
                          {activeSeries.map((colPoint, colIdx) => (
                            <div
                              key={colIdx}
                              className={cn(
                                "py-2.5 px-1 font-mono text-[11px]",
                                colPoint.date === data?.today && "bg-amber-500/10 font-bold"
                              )}
                            >
                              <div
                                className={cn(
                                  "font-bold",
                                  colPoint.actual !== null
                                    ? "text-emerald-400"
                                    : "text-muted-foreground/40"
                                )}
                              >
                                {colPoint.actual !== null ? `${colPoint.actual.toFixed(1)}%` : "—"}
                              </div>
                              <div className="text-[9px] text-indigo-300/80">
                                R: {colPoint.planned.toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3B. VIEW 2: CUMULATIVE S-CURVE RECHARTS (PLANNED VS ACTUAL) */}
          {viewMode === "cumulative" && (
            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border/50 rounded-xl">
                  Belum ada item pekerjaan untuk kurva S.
                </div>
              ) : (
                <div className="h-80 w-full pt-2" data-testid="s-curve-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={activeSeries}
                      margin={{ top: 15, right: 25, bottom: 5, left: 5 }}
                    >
                      <defs>
                        <linearGradient id="plannedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value, name) => [
                          value !== null && value !== undefined ? `${Number(value).toFixed(2)}%` : "—",
                          name === "planned" ? "Rencana (Planned)" : "Realisasi (Actual)",
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {data?.today && (
                        <ReferenceLine
                          x={
                            activeSeries.find((p) => p.date === data.today)?.label ||
                            activeSeries[0]?.label
                          }
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{
                            value: "Hari ini",
                            fill: "#f59e0b",
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="planned"
                        name="Rencana"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#plannedFill)"
                        dot={{ r: 3, fill: "#6366f1" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="Realisasi"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#actualFill)"
                        dot={{ r: 4, fill: "#10b981" }}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. WORK ITEMS MANAGEMENT TABLE */}
      <Card className="border-border bg-card" data-testid="work-items-card">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-border">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Daftar Item Pekerjaan & Bobot
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Ubah bobot, tanggal rencana, dan perbarui progres aktual secara langsung.
            </CardDescription>
          </div>

          {isOwner && (
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              Belum ada item pekerjaan. Klik "Tambah Item" untuk memulai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="work-items-table">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2.5">No</th>
                    <th className="text-left px-4 py-2.5">Item Pekerjaan</th>
                    <th className="text-right px-3 py-2.5">Bobot (%)</th>
                    <th className="text-left px-3 py-2.5 hidden sm:table-cell">Mulai</th>
                    <th className="text-left px-3 py-2.5 hidden sm:table-cell">Selesai</th>
                    <th className="text-left px-4 py-2.5 min-w-[180px]">Progres Aktual (%)</th>
                    {isOwner && <th className="text-right px-4 py-2.5 w-24">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it, idx) => (
                    <tr
                      key={it.id}
                      className="hover:bg-muted/10 transition-colors"
                      data-testid={`work-item-row-${it.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="font-medium">{it.name}</div>
                        {it.description && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {it.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-indigo-300 font-semibold">
                        {Number(it.weight).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell text-muted-foreground text-xs font-mono">
                        {it.start_date || "—"}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell text-muted-foreground text-xs font-mono">
                        {it.end_date || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            disabled={!isOwner}
                            value={it.actual_progress || 0}
                            onChange={(e) => quickUpdateProgress(it.id, Number(e.target.value))}
                            className="flex-1 accent-emerald-500 cursor-pointer h-2 bg-muted rounded-lg"
                            data-testid={`progress-slider-${it.id}`}
                          />
                          <span
                            className={cn(
                              "font-mono text-xs font-bold w-12 text-right",
                              (it.actual_progress || 0) >= 100
                                ? "text-emerald-400"
                                : (it.actual_progress || 0) > 0
                                ? "text-indigo-300"
                                : "text-muted-foreground"
                            )}
                          >
                            {it.actual_progress || 0}%
                          </span>
                        </div>
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem(it);
                                setDialogOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit item"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(it.id, it.name)}
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              title="Hapus item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/20 font-semibold text-xs">
                  <tr>
                    <td className="px-4 py-2.5 text-muted-foreground" colSpan={2}>
                      Total Kumulatif Bobot
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-mono text-sm font-bold",
                        weightOff ? "text-amber-400" : "text-emerald-400"
                      )}
                    >
                      {totalWeight.toFixed(1)}%
                    </td>
                    <td colSpan={2} className="hidden sm:table-cell" />
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                        <span>Total Realisasi Proyek:</span>
                        <span className="font-extrabold text-sm">{actual.toFixed(1)}%</span>
                      </div>
                    </td>
                    {isOwner && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. ADD / EDIT WORK ITEM DIALOG */}
      <WorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        item={editingItem}
        onSaved={() => {
          setDialogOpen(false);
          loadData();
        }}
      />
    </div>
  );
}

function WorkItemDialog({ open, onOpenChange, projectId, item, onSaved }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (item) {
        setName(item.name || "");
        setWeight(String(item.weight ?? ""));
        setStartDate(item.start_date || todayISO());
        setEndDate(item.end_date || addDaysISO(todayISO(), 7));
        setProgress(String(item.actual_progress ?? 0));
      } else {
        setName("");
        setWeight("");
        setStartDate(todayISO());
        setEndDate(addDaysISO(todayISO(), 7));
        setProgress("0");
      }
    }
  }, [open, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama item pekerjaan wajib diisi");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("Tanggal selesai harus sama atau lebih besar dari tanggal mulai");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        weight: Number(weight) || 0,
        start_date: startDate,
        end_date: endDate,
        actual_progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      };

      if (item) {
        await api.patch(`/projects/${projectId}/work-items/${item.id}`, payload);
        toast.success("Item pekerjaan berhasil diperbarui");
      } else {
        await api.post(`/projects/${projectId}/work-items`, payload);
        toast.success("Item pekerjaan baru berhasil ditambahkan");
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan item pekerjaan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            {item ? "Edit Item Pekerjaan" : "Tambah Item Pekerjaan Baru"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tentukan nama, persentase bobot kegiatan, dan rentang tanggal pelaksanaan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nama Item Pekerjaan *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Pengukuran GCP atau Digitasi Peta"
              className="text-sm bg-background/50"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Bobot (%) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Contoh: 15.0"
              className="text-sm font-mono bg-background/50"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Kontribusi item ini terhadap total 100% proyek.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tanggal Mulai</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-mono bg-background/50"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tanggal Selesai</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-mono bg-background/50"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Progres Aktual Saat Ini</Label>
              <span className="text-xs font-mono font-bold text-emerald-400">{progress}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-16 text-center text-xs font-mono bg-background/50 h-8"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              {saving ? "Menyimpan..." : item ? "Simpan Perubahan" : "Tambahkan Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
