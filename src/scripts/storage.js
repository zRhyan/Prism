// src/scripts/storage.js
const LS_PARAMS = 'prism:parameters';
const LS_ENTRIES = 'prism:entries';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const readJSON = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));

export function getParameters() {
  let p = readJSON(LS_PARAMS, []);
  if (!p || p.length === 0) {
    // AQUI ESTÁ A MÁGICA: Definimos o padrão para o seu Radar de Alta Performance
    p = [
      { id: 'p_latency', name: 'Latência de Início (min)' },
      { id: 'p_screentime', name: 'Screentime Matinal (min)' },
      { id: 'p_sleep_delta', name: 'Delta Sono (min)' }, // Ex: +30 (acordou tarde), -10 (cedo)
    ];
    writeJSON(LS_PARAMS, p);
  }
  return p;
}

export function addParameter(name) {
  const p = getParameters();
  const np = { id: uid(), name };
  p.push(np);
  writeJSON(LS_PARAMS, p);
  return np;
}

export function removeParameter(id) {
  let p = getParameters().filter((x) => x.id !== id);
  writeJSON(LS_PARAMS, p);
}

export function getEntries() {
  return readJSON(LS_ENTRIES, []);
}
export function saveEntries(arr) {
  writeJSON(LS_ENTRIES, arr);
}
export function saveEntry({ date, period, parameterId, parameterName, rating, comment }) {
  const e = {
    id: uid(),
    date,
    period,
    parameterId,
    parameterName,
    rating: Number(rating),
    comment,
    createdAt: new Date().toISOString(),
  };
  const entries = getEntries();
  entries.push(e);
  saveEntries(entries);
  return e;
}
export function deleteEntry(id) {
  let entries = getEntries().filter((e) => e.id !== id);
  saveEntries(entries);
}

// For resetting storage
export function resetStorage() {
  localStorage.removeItem('prism:parameters');
  localStorage.removeItem('prism:entries');
}