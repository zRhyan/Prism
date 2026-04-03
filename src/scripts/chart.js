// src/scripts/chart.js
import {
  getEntries, getGoals, getParameters,
  localDateStr, getWeekStart,
} from './storage.js';

// ─── Bucket generation ────────────────────────────────────────────────────────
// Each bucket: { label: string, filterFn: (entry) => boolean }

function getChartBuckets(interval) {
  const today = new Date();

  if (interval === 'weekly') {
    const day  = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon  = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      // const in block scope — each iteration gets its own binding ✓
      const ds = localDateStr(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
      return { label: ds, filterFn: e => e.date === ds };
    });
  }

  if (interval === 'monthly') {
    const y    = today.getFullYear();
    const m    = today.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const ds = localDateStr(new Date(y, m, i + 1));
      return { label: ds, filterFn: e => e.date === ds };
    });
  }

  if (interval === 'yearly') {
    const y = today.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const mm    = String(i + 1).padStart(2, '0');
      const start = `${y}-${mm}-01`;
      const end   = localDateStr(new Date(y, i + 1, 0));
      return { label: `${y}-${mm}`, filterFn: e => e.date >= start && e.date <= end };
    });
  }

  return [];
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregateEntries(entries, mode) {
  if (entries.length === 0) return null;

  if (mode === 'rating') {
    return Number(
      (entries.reduce((s, e) => s + e.rating, 0) / entries.length).toFixed(2)
    );
  }

  if (mode === 'duration') {
    const wd = entries.filter(e => e.duration != null);
    if (wd.length === 0) return null;
    return Number((wd.reduce((s, e) => s + e.duration, 0) / wd.length).toFixed(2));
  }

  if (mode === 'weighted') {
    const wd = entries.filter(e => e.duration != null);
    if (wd.length === 0) return null;
    const totalDur = wd.reduce((s, e) => s + e.duration, 0);
    return Number(
      (wd.reduce((s, e) => s + e.rating * e.duration, 0) / totalDur).toFixed(2)
    );
  }

  return null;
}

// ─── OLS linear regression ────────────────────────────────────────────────────
// yValues: (number|null)[] — null entries are excluded from the fit
// Returns { trendLine: number[], slope: number } or null if insufficient data

function linearRegression(yValues) {
  const points = yValues
    .map((y, x) => ({ x, y }))
    .filter(p => p.y !== null);

  const n = points.length;
  if (n < 2) return null;

  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;

  // denom === 0 means all non-null points share the same x — degenerate case
  if (denom === 0) return null;

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const trendLine = yValues.map((_, x) => Number((intercept + slope * x).toFixed(2)));

  return { trendLine, slope };
}

// ─── computeData (internal) ───────────────────────────────────────────────────

function computeData(paramId, mode, interval) {
  const buckets    = getChartBuckets(interval);
  const allEntries = getEntries().filter(e => e.parameterId === paramId);

  return {
    labels:    buckets.map(b => b.label),
    morning:   buckets.map(b =>
      aggregateEntries(allEntries.filter(e => b.filterFn(e) && e.period === 'morning'), mode)
    ),
    afternoon: buckets.map(b =>
      aggregateEntries(allEntries.filter(e => b.filterFn(e) && e.period === 'afternoon'), mode)
    ),
    overall:   buckets.map(b =>
      aggregateEntries(allEntries.filter(e => b.filterFn(e)), mode)
    ),
  };
}

// ─── computeAverages (exported for stats cards) ───────────────────────────────
// Returns { weekly, monthly, yearly } — each is number|null for the current
// calendar week, calendar month, and calendar year respectively.

export function computeAverages(paramId, mode) {
  const entries    = getEntries().filter(e => e.parameterId === paramId);
  const today      = new Date();
  const weekStart  = getWeekStart(today);
  const monthStart = localDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
  const yearStart  = `${today.getFullYear()}-01-01`;

  return {
    weekly:  aggregateEntries(entries.filter(e => e.date >= weekStart),  mode),
    monthly: aggregateEntries(entries.filter(e => e.date >= monthStart), mode),
    yearly:  aggregateEntries(entries.filter(e => e.date >= yearStart),  mode),
  };
}

// ─── renderChart ──────────────────────────────────────────────────────────────

export function renderChart({
  paramId,
  paramName,
  mode      = 'rating',
  interval  = 'weekly',
  showTrend = false,
}) {
  if (!paramId) return;

  const { labels, morning, afternoon, overall } = computeData(paramId, mode, interval);

  // Regression threshold from parameter config
  const param      = getParameters().find(p => p.id === paramId);
  const thresholds = param?.regressionThresholds ?? { weekly: 3, monthly: 12, yearly: 52 };
  const threshold  = thresholds[interval] ?? 3;

  // Goal: renders only when (paramId, mode, interval) all match
  const goal = getGoals().find(
    g => g.parameterId === paramId && g.mode === mode && g.interval === interval
  );

  // Period average over non-null overall points
  const nonNullVals = overall.filter(v => v !== null);
  const periodAvg   = nonNullVals.length > 0
    ? Number((nonNullVals.reduce((s, v) => s + v, 0) / nonNullVals.length).toFixed(2))
    : null;

  const ctx = document.getElementById('weeklyChart').getContext('2d');
  if (window.currentChart) window.currentChart.destroy();

  const datasets = [
    {
      label:               'Morning',
      data:                morning,
      spanGaps:            true,
      fill:                false,
      tension:             0.3,
      borderWidth:         2,
      borderColor:         'rgb(99, 179, 237)',
      pointBackgroundColor:'rgb(99, 179, 237)',
    },
    {
      label:               'Afternoon',
      data:                afternoon,
      spanGaps:            true,
      fill:                false,
      tension:             0.3,
      borderWidth:         2,
      borderColor:         'rgb(246, 173, 85)',
      pointBackgroundColor:'rgb(246, 173, 85)',
    },
    {
      label:               'Overall',
      data:                overall,
      spanGaps:            true,
      fill:                false,
      tension:             0.3,
      borderWidth:         2,
      borderColor:         'rgb(154, 230, 180)',
      pointBackgroundColor:'rgb(154, 230, 180)',
    },
  ];

  // Average line — horizontal dashed, color neutral
  if (periodAvg !== null) {
    datasets.push({
      label:       `Avg ${periodAvg}`,
      data:        Array(labels.length).fill(periodAvg),
      borderWidth: 1.5,
      borderDash:  [4, 4],
      borderColor: 'rgba(255, 255, 255, 0.4)',
      pointRadius: 0,
      fill:        false,
      tension:     0,
    });
  }

  // Goal line — renders only when (paramId, mode, interval) triple matches
  if (goal) {
    datasets.push({
      label:       `Goal (${goal.target})`,
      data:        Array(labels.length).fill(goal.target),
      borderWidth: 1.5,
      borderDash:  [8, 4],
      borderColor: 'rgba(245, 101, 101, 0.8)',
      pointRadius: 0,
      fill:        false,
      tension:     0,
    });
  }

  // Trend line — OLS, only if non-null count >= threshold
  if (showTrend) {
    const nonNullCount = overall.filter(v => v !== null).length;
    if (nonNullCount >= threshold) {
      const result = linearRegression(overall);
      if (result) {
        const { trendLine, slope } = result;
        const sign  = Math.abs(slope) < 0.1 ? '→' : slope > 0 ? '↑' : '↓';
        datasets.push({
          label:       `${sign} Trend`,
          data:        trendLine,
          borderWidth: 1.5,
          borderDash:  [3, 3],
          borderColor: 'rgba(183, 148, 246, 0.8)',
          pointRadius: 0,
          fill:        false,
          tension:     0,
        });
      }
    }
  }

  // Y-axis: duration is unbounded (minutes); rating and weighted are 0–10
  const yScale = mode === 'duration'
    ? { suggestedMin: 0 }
    : { suggestedMin: 0, suggestedMax: 10 };

  window.currentChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      scales:  { y: yScale },
      plugins: { legend: { display: true } },
    },
  });
}