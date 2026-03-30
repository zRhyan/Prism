// src/scripts/storage.js
const LS_PARAMS  = 'prism:parameters';
const LS_ENTRIES = 'prism:entries';
const LS_GOALS   = 'prism:goals';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const readJSON = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
const writeJSON = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));

// Exportada: fonte única de verdade para conversão de data local.
// ui.js e chart.js importam daqui — sem duplicação.
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

// Fix de desnormalização: resolve o nome atual do parâmetro em tempo de render.
// Se o parâmetro foi renomeado, reflete o nome novo.
// Se foi deletado, cai no fallback (nome armazenado na entry).
export function resolveParamName(parameterId, fallbackName) {
  const found = getParameters().find(p => p.id === parameterId);
  return found ? found.name : (fallbackName || parameterId);
}

// --- Entries ---
export function getEntries()      { return readJSON(LS_ENTRIES, []); }
export function saveEntries(arr)  { writeJSON(LS_ENTRIES, arr); }

export function saveEntry({ date, period, parameterId, parameterName, rating, comment }) {
  const e = {
    id: uid(),
    date,
    period,
    parameterId,
    parameterName, // mantido como fallback para parâmetros deletados
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
// Schema: { [parameterId]: { targetWeeklyAvg: number, targetSessions: number } }
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

// --- Reset ---
export function resetStorage() {
  localStorage.removeItem(LS_PARAMS);
  localStorage.removeItem(LS_ENTRIES);
  localStorage.removeItem(LS_GOALS);
}