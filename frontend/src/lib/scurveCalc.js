/**
 * S-Curve & Progress Tracking Calculation Utilities
 * Handles daily, weekly, and monthly time-bucketing,
 * cumulative S-Curve generation, and item-level progress point calculations.
 */

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateStr, days) {
  const d = new Date(dateStr || todayISO());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getItemPlanned(item, dateStr) {
  if (!item.start_date || dateStr < item.start_date) return 0;
  if (!item.end_date || dateStr >= item.end_date) return 100;
  const s = new Date(item.start_date).getTime();
  const e = new Date(item.end_date).getTime();
  const t = new Date(dateStr).getTime();
  const dur = Math.max(1, e - s);
  return Math.min(100, Math.max(0, ((t - s) / dur) * 100));
}

export function getItemActual(item, dateStr, today = todayISO()) {
  if (dateStr > today) return null;
  if (!item.start_date || dateStr < item.start_date) return 0;
  const itemActual = Number(item.actual_progress) || 0;
  if (dateStr >= today) return itemActual;
  const s = new Date(item.start_date).getTime();
  const t = new Date(dateStr).getTime();
  const todayTime = new Date(today).getTime();
  const elapsed = Math.max(1, todayTime - s);
  return Math.min(itemActual, Math.max(0, ((t - s) / elapsed) * itemActual));
}

export function computeSCurve(items = [], today = todayISO()) {
  const total_weight = items.reduce((acc, it) => acc + (Number(it.weight) || 0), 0);

  if (!items || items.length === 0) {
    return {
      items: [],
      total_weight: 0,
      current_planned: 0,
      current_actual: 0,
      series_daily: [],
      series_weekly: [],
      series_monthly: [],
      today,
    };
  }

  // Find date boundaries
  let minDate = items[0].start_date || today;
  let maxDate = items[0].end_date || today;

  items.forEach((it) => {
    if (it.start_date && it.start_date < minDate) minDate = it.start_date;
    if (it.end_date && it.end_date > maxDate) maxDate = it.end_date;
  });

  if (minDate > maxDate) maxDate = addDaysISO(minDate, 14);

  // Pad by 1 day before and after for smooth curve display
  const padMin = addDaysISO(minDate, 0);
  const padMax = addDaysISO(maxDate, 0);

  // 1. Daily Series
  const series_daily = [];
  const curr = new Date(padMin);
  const end = new Date(padMax);

  while (curr <= end) {
    const dStr = curr.toISOString().slice(0, 10);
    let dayPlanned = 0;
    let dayActual = 0;
    const hasActual = dStr <= today;

    const itemPoints = items.map((it) => {
      const pl = getItemPlanned(it, dStr);
      const act = getItemActual(it, dStr, today);
      const w = Number(it.weight) || 0;

      dayPlanned += (w * pl) / 100;
      if (hasActual && act !== null) {
        dayActual += (w * act) / 100;
      }

      return {
        id: it.id,
        name: it.name,
        weight: w,
        planned: Number(pl.toFixed(1)),
        actual: act !== null ? Number(act.toFixed(1)) : null,
      };
    });

    const [y, m, d] = dStr.split('-');
    series_daily.push({
      date: dStr,
      label: `${d}/${m}`,
      dayOfWeek: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][curr.getDay()],
      planned: Number(Math.min(100, dayPlanned).toFixed(2)),
      actual: hasActual ? Number(Math.min(100, dayActual).toFixed(2)) : null,
      itemPoints,
    });

    curr.setDate(curr.getDate() + 1);
  }

  // 2. Weekly Series
  const series_weekly = [];
  const chunkSize = 7;
  for (let i = 0; i < series_daily.length; i += chunkSize) {
    const slice = series_daily.slice(i, i + chunkSize);
    const lastPoint = slice[slice.length - 1];
    const firstPoint = slice[0];
    const weekNum = Math.floor(i / chunkSize) + 1;
    series_weekly.push({
      date: lastPoint.date,
      label: `Minggu ${weekNum} (${firstPoint.label} - ${lastPoint.label})`,
      weekNumber: weekNum,
      planned: lastPoint.planned,
      actual: lastPoint.actual,
      itemPoints: lastPoint.itemPoints,
    });
  }

  // 3. Monthly Series
  const monthlyMap = new Map();
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  series_daily.forEach((p) => {
    const monthKey = p.date.slice(0, 7);
    monthlyMap.set(monthKey, p);
  });
  const series_monthly = Array.from(monthlyMap.entries()).map(([mKey, p]) => {
    const [y, m] = mKey.split('-');
    return {
      date: p.date,
      label: `${monthNames[Number(m)] || m} ${y}`,
      monthKey,
      planned: p.planned,
      actual: p.actual,
      itemPoints: p.itemPoints,
    };
  });

  // KPI aggregates
  let current_planned = 0;
  let current_actual = 0;

  items.forEach((it) => {
    const pl = getItemPlanned(it, today);
    const act = Number(it.actual_progress) || 0;
    const w = Number(it.weight) || 0;
    current_planned += (w * pl) / 100;
    current_actual += (w * act) / 100;
  });

  return {
    items,
    total_weight: Number(total_weight.toFixed(2)),
    current_planned: Number(Math.min(100, current_planned).toFixed(2)),
    current_actual: Number(Math.min(100, current_actual).toFixed(2)),
    series_daily,
    series_weekly,
    series_monthly,
    today,
  };
}
