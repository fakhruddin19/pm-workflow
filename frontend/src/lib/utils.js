import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDuration(fromISO) {
  if (!fromISO) return "0m";
  const from = new Date(fromISO).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - from);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}h ${hours % 24}j`;
  if (hours > 0) return `${hours}j ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(diff / 1000)}s`;
}

export function hoursSince(fromISO) {
  if (!fromISO) return 0;
  const from = new Date(fromISO).getTime();
  return (Date.now() - from) / 3600000;
}

export function durationLevel(fromISO, slaHours = null) {
  if (!fromISO) return "ok";
  const h = hoursSince(fromISO);
  if (slaHours && slaHours > 0) {
    if (h >= slaHours) return "danger";
    if (h >= slaHours * 0.75) return "warn";
    return "ok";
  }
  if (h > 72) return "danger";
  if (h > 24) return "warn";
  return "ok";
}

// Normalize stages to [{name, sla_hours}]. Accepts legacy array of strings.
export function normalizeStages(stages) {
  return (stages || []).map((s) =>
    typeof s === "string" ? { name: s, sla_hours: null } : { name: s.name, sla_hours: s.sla_hours ?? null }
  );
}

export function stageNames(stages) {
  return normalizeStages(stages).map((s) => s.name);
}

export function slaOf(stages, stageName) {
  const s = normalizeStages(stages).find((x) => x.name === stageName);
  return s?.sla_hours ?? null;
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
