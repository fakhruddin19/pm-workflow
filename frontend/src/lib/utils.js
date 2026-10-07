import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function daysSince(fromISO) {
  if (!fromISO) return 0;
  const from = new Date(fromISO).getTime();
  return (Date.now() - from) / (1000 * 3600 * 24);
}

export function hoursSince(fromISO) {
  if (!fromISO) return 0;
  const from = new Date(fromISO).getTime();
  return (Date.now() - from) / (1000 * 3600);
}

export function formatDuration(fromISO) {
  if (!fromISO) return "0 hari";
  const from = new Date(fromISO).getTime();
  const diff = Math.max(0, Date.now() - from);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} Hari`;
  if (hours > 0) return `${hours} Jam`;
  return `${minutes} Menit`;
}

export function durationLevel(fromISO, slaDays = null) {
  if (!fromISO) return "ok";
  const days = daysSince(fromISO);
  if (slaDays && slaDays > 0) {
    if (days >= slaDays) return "danger";
    if (days >= slaDays * 0.75) return "warn";
    return "ok";
  }
  if (days > 3) return "danger";
  if (days > 1) return "warn";
  return "ok";
}

export function getSlaInfo(fromISO, slaDays) {
  if (!fromISO || !slaDays) return { label: null, level: "ok", text: "" };
  const days = daysSince(fromISO);
  const remainingDays = Math.ceil(slaDays - days);

  if (days >= slaDays) {
    const overdue = Math.floor(days - slaDays);
    return {
      label: overdue > 0 ? `Lewat ${overdue} Hari` : "Lewat Hari Ini",
      level: "danger",
      text: `${slaDays} Hari`,
    };
  }
  if (days >= slaDays * 0.75) {
    return {
      label: remainingDays <= 1 ? "Sisa < 1 Hari" : `Sisa ${remainingDays} Hari`,
      level: "warn",
      text: `${slaDays} Hari`,
    };
  }
  return {
    label: `Sisa ${remainingDays} Hari`,
    level: "ok",
    text: `${slaDays} Hari`,
  };
}

// Normalize stages to [{name}].
export function normalizeStages(stages) {
  return (stages || []).map((s) => (typeof s === "string" ? { name: s } : { name: s.name }));
}

export function stageNames(stages) {
  return normalizeStages(stages).map((s) => s.name);
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
