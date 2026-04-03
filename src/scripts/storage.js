// src/scripts/storage.js
const LS_PARAMS           = 'prism:parameters';
const LS_ENTRIES          = 'prism:entries';
const LS_GOALS            = 'prism:goals';
const LS_SNAPSHOTS_WEEKLY = 'prism:snapshots:weekly';
const LS_SNAPSHOTS_MONTHLY= 'prism:snapshots:monthly';
const LS_SNAPSHOTS_YEARLY = 'prism:snapshots:yearly';
const LS_CURSOR_WK        = 'prism:cursor:weekly';
const LS_CURSOR_MO        = 'prism:cursor:monthly';
const LS_CURSOR_YR        = 'prism:cursor:yearly';

const uid = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const readJSON = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

const writeJSON = (key, obj) => {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.error('[Prism] localStorage quota exceeded.');
      window.dispatchEvent(new CustomEvent('prism:quotaExceeded'));
    } else {
      throw err;
    }
  }
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

export const localDateStr = (d) => {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Exported: used by chart.js, main.js, ui.js — single source of truth.
export function getWeekStart(d = new Date()) {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}

// ─── Parameters ───────────────────────────────────────────────────────────────
// Schema: { id, name, regressionThresholds: { weekly, monthly, yearly } }

const DEFAULT_THRESHOLDS = { weekly: 3, monthly: 12, yearly: 52 };

export function getParameters() {
  let p = readJSON(LS_PARAMS, []);

  if (!p || p.length === 0) {
    p = [
      { id: 'p_sleep', name: 'Sleep',    regressionThresholds: { ...DEFAULT_THRESHOLDS } },
      { id: 'p_study', name: 'Study',    regressionThresholds: { ...DEFAULT_THRESHOLDS } },
      { id: 'p_ex',    name: 'Exercise', regressionThresholds: { ...DEFAULT_THRESHOLDS } },
    ];
    writeJSON(LS_PARAMS, p);
    return p;
  }

  // Migration: add regressionThresholds to parameters created before this schema
  let migrated = false;
  for (const param of p) {
    if (!param.regressionThresholds) {
      param.regressionThresholds = { ...DEFAULT_THRESHOLDS };
      migrated = true;
    }
  }
  if (migrated) writeJSON(LS_PARAMS, p);

  return p;
}

export function addParameter(name) {
  const p  = getParameters();
  const np = { id: uid(), name, regressionThresholds: { ...DEFAULT_THRESHOLDS } };
  p.push(np);
  writeJSON(LS_PARAMS, p);
  return np;
}

export function removeParameter(id) {
  writeJSON(LS_PARAMS, getParameters().filter(x => x.id !== id));
}

export function setParameterThresholds(paramId, { weekly, monthly, yearly }) {
  const params = getParameters();
  const idx    = params.findIndex(p => p.id === paramId);
  if (idx < 0) return;
  params[idx].regressionThresholds = {
    weekly:  Number(weekly)  || DEFAULT_THRESHOLDS.weekly,
    monthly: Number(monthly) || DEFAULT_THRESHOLDS.monthly,
    yearly:  Number(yearly)  || DEFAULT_THRESHOLDS.yearly,
  };
  writeJSON(LS_PARAMS, params);
}

export function resolveParamName(parameterId, fallbackName) {
  const found = getParameters().find(p => p.id === parameterId);
  return found ? found.name : (fallbackName || parameterId);
}

// ─── Entries ──────────────────────────────────────────────────────────────────
// Schema: { id, date, period, parameterId, parameterName,
//           rating, duration (minutes|null), comment, createdAt }

export function getEntries()     { return readJSON(LS_ENTRIES, []); }
export function saveEntries(arr) { writeJSON(LS_ENTRIES, arr); }

export function saveEntry({ date, period, parameterId, parameterName, rating, duration, comment }) {
  const e = {
    id:            uid(),
    date,
    period,
    parameterId,
    parameterName,
    rating:        Number(rating),
    // '' and null both mean "not recorded" — never store 0 as absence
    duration:      duration != null && duration !== '' ? Number(duration) : null,
    comment,
    createdAt:     new Date().toISOString(),
  };
  const entries = getEntries();
  entries.push(e);
  saveEntries(entries);
  return e;
}

export function deleteEntry(id) {
  saveEntries(getEntries().filter(e => e.id !== id));
}

// ─── Goals ────────────────────────────────────────────────────────────────────
// Schema: Array<{ id, parameterId, mode, interval, target }>
// mode:     'rating' | 'duration' | 'weighted'
// interval: 'weekly' | 'monthly' | 'yearly'
// target:   number (0–10 for rating/weighted, minutes for duration)

export function getGoals() {
  const raw = readJSON(LS_GOALS, []);
  // Migration: old schema was a plain object map — discard, incompatible
  if (!Array.isArray(raw)) {
    writeJSON(LS_GOALS, []);
    return [];
  }
  return raw;
}

// Upsert: replaces existing goal with same (parameterId, mode, interval)
export function setGoal({ parameterId, mode, interval, target }) {
  const goals = getGoals();
  const idx   = goals.findIndex(
    g => g.parameterId === parameterId && g.mode === mode && g.interval === interval
  );
  const goal = {
    id:          idx >= 0 ? goals[idx].id : uid(),
    parameterId,
    mode,
    interval,
    target:      Number(target),
  };
  if (idx >= 0) goals[idx] = goal;
  else          goals.push(goal);
  writeJSON(LS_GOALS, goals);
  return goal;
}

export function removeGoal(goalId) {
  writeJSON(LS_GOALS, getGoals().filter(g => g.id !== goalId));
}

// ─── Snapshots (internal) ─────────────────────────────────────────────────────
// Shared schema for all three intervals:
// { periodStart, periodEnd, takenAt, rows: [
//   { parameterId, parameterName,
//     avgRating, avgDuration, weightedScore, uniqueSessions,
//     goals: [{ goalId, mode, target, actual, met }] }
// ]}

function _saveSnapshot(lsKey, limit, interval, { periodStart, periodEnd, entries, goals }) {
  const pe = entries.filter(e => e.date >= periodStart && e.date <= periodEnd);
  const intervalGoals = goals.filter(g => g.interval === interval);

  const activeIds = new Set([
    ...pe.map(e => e.parameterId),
    ...intervalGoals.map(g => g.parameterId),
  ]);
  if (activeIds.size === 0) return;

  const rows = [];
  for (const paramId of activeIds) {
    const paramEntries = pe.filter(e => e.parameterId === paramId);
    const withDur      = paramEntries.filter(e => e.duration != null);
    const totalDur     = withDur.reduce((s, e) => s + e.duration, 0);
    const uniqueSessions = new Set(paramEntries.map(e => `${e.date}__${e.period}`)).size;

    const avgRating = paramEntries.length === 0 ? null
      : Number((paramEntries.reduce((s, e) => s + e.rating, 0) / paramEntries.length).toFixed(2));

    const avgDuration = withDur.length === 0 ? null
      : Number((withDur.reduce((s, e) => s + e.duration, 0) / withDur.length).toFixed(2));

    const weightedScore = withDur.length === 0 ? null
      : Number((withDur.reduce((s, e) => s + e.rating * e.duration, 0) / totalDur).toFixed(2));

    const goalResults = intervalGoals
      .filter(g => g.parameterId === paramId)
      .map(g => {
        const actual =
          g.mode === 'rating'   ? avgRating   :
          g.mode === 'duration' ? avgDuration :
          g.mode === 'weighted' ? weightedScore : null;
        return {
          goalId: g.id,
          mode:   g.mode,
          target: g.target,
          actual,
          met:    actual !== null ? actual >= g.target : null,
        };
      });

    rows.push({
      parameterId:   paramId,
      parameterName: resolveParamName(paramId, paramId),
      avgRating, avgDuration, weightedScore, uniqueSessions,
      goals: goalResults,
    });
  }

  const snapshots = readJSON(lsKey, []);
  const idx       = snapshots.findIndex(s => s.periodStart === periodStart);
  const record    = { periodStart, periodEnd, takenAt: new Date().toISOString(), rows };

  if (idx >= 0) snapshots[idx] = record;
  else          snapshots.push(record);

  snapshots.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  writeJSON(lsKey, snapshots.slice(0, limit));
}

// ─── Snapshots (public) ───────────────────────────────────────────────────────

export function saveWeekSnapshot({ weekStart, weekEnd, entries, goals }) {
  _saveSnapshot(LS_SNAPSHOTS_WEEKLY, 52, 'weekly', {
    periodStart: weekStart, periodEnd: weekEnd, entries, goals,
  });
}

export function saveMonthSnapshot({ monthStart, monthEnd, entries, goals }) {
  _saveSnapshot(LS_SNAPSHOTS_MONTHLY, 24, 'monthly', {
    periodStart: monthStart, periodEnd: monthEnd, entries, goals,
  });
}

export function saveYearSnapshot({ yearStart, yearEnd, entries, goals }) {
  _saveSnapshot(LS_SNAPSHOTS_YEARLY, 5, 'yearly', {
    periodStart: yearStart, periodEnd: yearEnd, entries, goals,
  });
}

export function getWeeklySnapshots()  { return readJSON(LS_SNAPSHOTS_WEEKLY,  []); }
export function getMonthlySnapshots() { return readJSON(LS_SNAPSHOTS_MONTHLY, []); }
export function getYearlySnapshots()  { return readJSON(LS_SNAPSHOTS_YEARLY,  []); }

// ─── Snapshot cursors ─────────────────────────────────────────────────────────

export function getLastSnapshotWeek()   { return localStorage.getItem(LS_CURSOR_WK) ?? null; }
export function setLastSnapshotWeek(v)  { localStorage.setItem(LS_CURSOR_WK, v); }
export function getLastSnapshotMonth()  { return localStorage.getItem(LS_CURSOR_MO) ?? null; }
export function setLastSnapshotMonth(v) { localStorage.setItem(LS_CURSOR_MO, v); }
export function getLastSnapshotYear()   { return localStorage.getItem(LS_CURSOR_YR) ?? null; }
export function setLastSnapshotYear(v)  { localStorage.setItem(LS_CURSOR_YR, v); }

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetStorage() {
  [
    LS_PARAMS, LS_ENTRIES, LS_GOALS,
    LS_SNAPSHOTS_WEEKLY, LS_SNAPSHOTS_MONTHLY, LS_SNAPSHOTS_YEARLY,
    LS_CURSOR_WK, LS_CURSOR_MO, LS_CURSOR_YR,
  ].forEach(k => localStorage.removeItem(k));
}