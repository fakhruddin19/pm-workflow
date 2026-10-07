import React, { useEffect, useState } from "react";
import { ChevronRight, Clock, Circle, Timer, AlertTriangle } from "lucide-react";
import { cn, formatDuration, durationLevel, normalizeStages, hoursSince, daysSince } from "../lib/utils";

/**
 * Auto-generated workflow diagram.
 * Shows each stage as a connected node with its SLA cap.
 * Tasks are listed under their current stage with a live stage-duration timer
 * color-coded by SLA (hijau <75%, amber 75-100%, merah >SLA / breach).
 */
export default function WorkflowDiagram({ stages = [], tasks = [], onTaskClick }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const normalized = normalizeStages(stages);
  if (!normalized.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border/40 rounded-xl">
        Workflow belum ada. Tambahkan stage di tab Workflow.
      </div>
    );
  }

  const stageData = normalized.map((stage) => ({
    stage,
    tasks: tasks.filter((t) => t.stage === stage.name),
  }));
  const totalBreaches = tasks.reduce((acc, t) => {
    if (t.sla_days && daysSince(t.stage_entered_at || t.created_at) >= t.sla_days) return acc + 1;
    const s = normalized.find((x) => x.name === t.stage);
    if (s?.sla_hours && hoursSince(t.stage_entered_at) >= s.sla_hours) return acc + 1;
    return acc;
  }, 0);

  return (
    <div
      className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 md:p-6"
      data-testid="workflow-diagram"
    >
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Bagan Workflow Otomatis
          </div>
          <div className="font-semibold text-base" style={{ fontFamily: "Plus Jakarta Sans" }}>
            Posisi Data Saat Ini
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {totalBreaches > 0 && (
            <span
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold"
              data-testid="sla-breach-badge"
            >
              <AlertTriangle className="h-3 w-3" /> {totalBreaches} tugas melewati SLA
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> dalam SLA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> mendekati batas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> SLA terlewati
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-0 min-w-max">
          {stageData.map((sd, idx) => {
            const isLast = idx === stageData.length - 1;
            const hasTasks = sd.tasks.length > 0;
            const breachCount = sd.tasks.filter((t) => {
              if (t.sla_days) return daysSince(t.stage_entered_at || t.created_at) >= t.sla_days;
              if (sd.stage.sla_hours) return hoursSince(t.stage_entered_at) >= sd.stage.sla_hours;
              return false;
            }).length;
            const stageBorder = breachCount > 0
              ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
              : hasTasks
                ? "border-indigo-500/40 shadow-lg shadow-indigo-500/5"
                : "border-border/60";
            return (
              <React.Fragment key={sd.stage.name}>
                <div
                  className={cn(
                    "flex flex-col rounded-xl border bg-background/40 p-3 min-w-[240px] max-w-[280px] transition-all",
                    stageBorder
                  )}
                  data-testid={`diagram-stage-${sd.stage.name}`}
                >
                  <div className="flex items-start justify-between mb-3 pb-2 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold shrink-0",
                          breachCount > 0
                            ? "bg-rose-500/20 text-rose-200 border border-rose-500/40"
                            : hasTasks
                              ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
                              : "bg-muted/40 text-muted-foreground border border-border"
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm leading-tight">{sd.stage.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>{sd.tasks.length} tugas</span>
                          {sd.stage.sla_hours ? (
                            <span className="inline-flex items-center gap-0.5 text-indigo-300" data-testid={`stage-sla-${sd.stage.name}`}>
                              <Timer className="h-2.5 w-2.5" /> SLA {sd.stage.sla_hours}j
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">· tanpa SLA</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasTasks && (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full animate-pulse",
                          breachCount > 0 ? "bg-rose-400" : "bg-emerald-400"
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1.5 min-h-[80px]">
                    {sd.tasks.length === 0 ? (
                      <div className="flex items-center justify-center text-[11px] text-muted-foreground/60 italic py-6">
                        <Circle className="h-3 w-3 mr-1.5" /> kosong
                      </div>
                    ) : (
                      sd.tasks.map((t) => {
                        const level = t.sla_days
                          ? durationLevel(t.stage_entered_at || t.created_at, t.sla_days)
                          : durationLevel(t.stage_entered_at, sd.stage.sla_hours);
                        const breached = level === "danger";
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onTaskClick?.(t)}
                            className={cn(
                              "w-full text-left group p-2 rounded-lg bg-card border transition-all",
                              breached
                                ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60"
                                : "border-border/60 hover:border-indigo-500/50"
                            )}
                            data-testid={`diagram-task-${t.id}`}
                          >
                            <div className="text-xs font-medium leading-tight line-clamp-1 mb-1 group-hover:text-indigo-200 transition-colors flex items-center gap-1">
                              {breached && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
                              {t.title}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground truncate">
                                {t.assignee?.name || "— belum assign"}
                              </span>
                              <span
                                className={cn(
                                  "timer-pill",
                                  level === "warn" && "timer-pill-warn",
                                  level === "danger" && "timer-pill-danger"
                                )}
                                data-testid={`diagram-timer-${t.id}`}
                              >
                                <Clock className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />
                                {formatDuration(t.stage_entered_at)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {!isLast && (
                  <div className="flex items-center shrink-0 px-1" aria-hidden>
                    <ChevronRight
                      className={cn(
                        "h-6 w-6 transition-colors",
                        hasTasks ? "text-indigo-400" : "text-border"
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
