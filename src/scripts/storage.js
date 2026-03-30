// src/scripts/storage.js
const LS_PARAMS           = 'prism:parameters';
const LS_ENTRIES          = 'prism:entries';
const LS_GOALS            = 'prism:goals';
const LS_SNAPSHOTS        = 'prism:weekly_snapshots';
const LS_LAST_SNAPSHOT_WK = 'prism:last_snapshot_week';

const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
};

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
      console.error('[Prism] localStorage quota exceeded. Entry not saved.');
      window.dispatchEvent(new CustomEvent('prism:quotaExceeded'));
    } else {
      throw err;
    }
  }
};

export const localDateStr = (d) => {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Parameters ---
export function getParameters() {
  let p = readJSON(LS_PARAMS, []);
  if (!p || p.length === 0) {
    p = [
      { id: 'p_sleep', name: 'Sleep' },
      { id: 'p_study', name: 'Study' },
      { id: 'p_ex',    name: 'Exercise' },
    ];
    writeJSON(LS_PARAMS, p);
  }
  return p;
}

export function addParameter(name) {
  const p  = getParameters();
  const np = { id: uid(), name };
  p.push(np);
  writeJSON(LS_PARAMS, p);
  return np;
}

export function removeParameter(id) {
  writeJSON(LS_PARAMS, getParameters().filter(x => x.id !== id));
}

export function resolveParamName(parameterId, fallbackName) {
  const found = getParameters().find(p => p.id === parameterId);
  return found ? found.name : (fallbackName || parameterId);
}

// --- Entries ---
export function getEntries()     { return readJSON(LS_ENTRIES, []); }
export function saveEntries(arr) { writeJSON(LS_ENTRIES, arr); }

export function saveEntry({ date, period, parameterId, parameterName, rating, comment }) {
  const e = {
    id: uid(),
    date,
    period,
    parameterId,
    parameterName,
    rating:    Number(rating),
    comment,
    createdAt: new Date().toISOString(),
  };
  const entries = getEntries();
  entries.push(e);
  saveEntries(entries);
  return e;
}

export function deleteEntry(id) {
  saveEntries(getEntries().filter(e => e.id !== id));
}

// --- Goals ---
export function getGoals() { return readJSON(LS_GOALS, {}); }

export function setGoal(parameterId, { targetWeeklyAvg, targetSessions }) {
  const goals = getGoals();
  goals[parameterId] = {
    targetWeeklyAvg: Number(targetWeeklyAvg),
    targetSessions:  Number(targetSessions),
  };
  writeJSON(LS_GOALS, goals);
}

export function removeGoal(parameterId) {
  const goals = getGoals();
  delete goals[parameterId];
  writeJSON(LS_GOALS, goals);
}

// --- Weekly Snapshots ---
// Schema: Array<{
//   weekStart: string,       // "YYYY-MM-DD" (Monday)
//   weekEnd:   string,       // "YYYY-MM-DD" (Sunday)
//   takenAt:   string,       // ISO timestamp do snapshot
//   rows: Array<{
//     parameterId, parameterName,
//     avgRating, uniqueSessions,
//     goalTargetWeeklyAvg, goalTargetSessions,
//     avgMet, sessionsMet        // null se não havia goal
//   }>
// }>
export function getSnapshots() { return readJSON(LS_SNAPSHOTS, []); }

export function saveWeekSnapshot({ weekStart, weekEnd, entries, goals }) {
  // Reúne todos os paramIds que tiveram entries OU tinham goals nessa semana
  const activeParamIds = new Set([
    ...entries
      .filter(e => e.date >= weekStart && e.date <= weekEnd)
      .map(e => e.parameterId),
    ...Object.keys(goals),
  ]);

  if (activeParamIds.size === 0) return; // semana vazia — não polui o histórico

  const rows = [];
  for (const paramId of activeParamIds) {
    const weekEntries    = entries.filter(
      e => e.parameterId === paramId && e.date >= weekStart && e.date <= weekEnd
    );
    const uniqueSessions = new Set(weekEntries.map(e => `${e.date}__${e.period}`)).size;
    const avg            = weekEntries.length === 0
      ? null
      : Number((weekEntries.reduce((s, e) => s + e.rating, 0) / weekEntries.length).toFixed(2));
    const goal           = goals[paramId] ?? null;

    rows.push({
      parameterId:         paramId,
      parameterName:       resolveParamName(paramId, paramId),
      avgRating:           avg,
      uniqueSessions,
      goalTargetWeeklyAvg: goal?.targetWeeklyAvg ?? null,
      goalTargetSessions:  goal?.targetSessions  ?? null,
      avgMet:              goal && avg !== null ? avg >= goal.targetWeeklyAvg : null,
      sessionsMet:         goal ? uniqueSessions >= goal.targetSessions       : null,
    });
  }

  const snapshots = getSnapshots();

  // Idempotente: substitui se já existir snapshot para essa semana
  const idx    = snapshots.findIndex(s => s.weekStart === weekStart);
  const record = { weekStart, weekEnd, takenAt: new Date().toISOString(), rows };
  if (idx >= 0) snapshots[idx] = record;
  else          snapshots.push(record);

  // Mantém apenas as últimas 52 semanas (1 ano)
  snapshots.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  writeJSON(LS_SNAPSHOTS, snapshots.slice(0, 52));
}

export function getLastSnapshotWeek() {
  return localStorage.getItem(LS_LAST_SNAPSHOT_WK) ?? null;
}

export function setLastSnapshotWeek(weekStart) {
  localStorage.setItem(LS_LAST_SNAPSHOT_WK, weekStart);
}

// --- Reset ---
export function resetStorage() {
  localStorage.removeItem(LS_PARAMS);
  localStorage.removeItem(LS_ENTRIES);
  localStorage.removeItem(LS_GOALS);
  localStorage.removeItem(LS_SNAPSHOTS);
  localStorage.removeItem(LS_LAST_SNAPSHOT_WK);
}