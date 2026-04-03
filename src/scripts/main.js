// src/scripts/main.js
import { setupUI } from './ui.js';
import {
  localDateStr, getWeekStart,
  getEntries, getGoals,
  saveWeekSnapshot, saveMonthSnapshot, saveYearSnapshot,
  getLastSnapshotWeek,  setLastSnapshotWeek,
  getLastSnapshotMonth, setLastSnapshotMonth,
  getLastSnapshotYear,  setLastSnapshotYear,
} from './storage.js';

// getWeekStart agora vem de storage — sem duplicata local

const getMonthStart = (d = new Date()) =>
  localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));

const getYearStart = (d = new Date()) =>
  `${d.getFullYear()}-01-01`;

// ─── Bounds helpers ────────────────────────────────────────────────────────────

const getPrevWeekBounds = (currentWeekStart) => {
  const [y, m, d] = currentWeekStart.split('-').map(Number);
  return {
    weekStart: localDateStr(new Date(y, m - 1, d - 7)),
    weekEnd:   localDateStr(new Date(y, m - 1, d - 1)),
  };
};

// currentMonthStart = "YYYY-MM-01"
// new Date(y, m-2, 1)  = first day of previous month (JS 0-indexed months handle underflow)
// new Date(y, m-1, 0)  = day 0 of current month = last day of previous month
const getPrevMonthBounds = (currentMonthStart) => {
  const [y, m] = currentMonthStart.split('-').map(Number);
  return {
    monthStart: localDateStr(new Date(y, m - 2, 1)),
    monthEnd:   localDateStr(new Date(y, m - 1, 0)),
  };
};

const getPrevYearBounds = (currentYearStart) => {
  const y = Number(currentYearStart.split('-')[0]);
  return {
    yearStart: `${y - 1}-01-01`,
    yearEnd:   `${y - 1}-12-31`,
  };
};

// ─── Snapshot checks ───────────────────────────────────────────────────────────

function maybeSnapshotPreviousWeek() {
  const current = getWeekStart();
  const last    = getLastSnapshotWeek();
  if (last === null)    { setLastSnapshotWeek(current); return false; }
  if (last >= current)    return false;
  const { weekStart, weekEnd } = getPrevWeekBounds(current);
  saveWeekSnapshot({ weekStart, weekEnd, entries: getEntries(), goals: getGoals() });
  setLastSnapshotWeek(current);
  return true;
}

function maybeSnapshotPreviousMonth() {
  const current = getMonthStart();
  const last    = getLastSnapshotMonth();
  if (last === null)    { setLastSnapshotMonth(current); return false; }
  if (last >= current)    return false;
  const { monthStart, monthEnd } = getPrevMonthBounds(current);
  saveMonthSnapshot({ monthStart, monthEnd, entries: getEntries(), goals: getGoals() });
  setLastSnapshotMonth(current);
  return true;
}

function maybeSnapshotPreviousYear() {
  const current = getYearStart();
  const last    = getLastSnapshotYear();
  if (last === null)    { setLastSnapshotYear(current); return false; }
  if (last >= current)    return false;
  const { yearStart, yearEnd } = getPrevYearBounds(current);
  saveYearSnapshot({ yearStart, yearEnd, entries: getEntries(), goals: getGoals() });
  setLastSnapshotYear(current);
  return true;
}

// Runs all three — assigns to separate variables so no short-circuit skips any check
function checkAllSnapshots() {
  const w = maybeSnapshotPreviousWeek();
  const m = maybeSnapshotPreviousMonth();
  const y = maybeSnapshotPreviousYear();
  return w || m || y;
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Snapshot check before UI mounts — catches gaps from weeks/months of inactivity
  checkAllSnapshots();

  const { refresh } = setupUI();

  // On tab resume: re-check in case week/month/year boundary crossed while hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (checkAllSnapshots()) refresh();
  });
});