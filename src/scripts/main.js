// src/scripts/main.js
import { setupUI } from './ui.js';
import {
  localDateStr,
  getEntries, getGoals,
  saveWeekSnapshot,
  getLastSnapshotWeek, setLastSnapshotWeek,
} from './storage.js';

// Duplicada aqui intencionalmente: main.js não deve depender de ui.js
// para uma função utilitária pura de data.
const getWeekStart = (d = new Date()) => {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return localDateStr(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  );
};

// Calcula os bounds da semana anterior a partir do weekStart atual.
const getPrevWeekBounds = (currentWeekStart) => {
  const [y, m, d] = currentWeekStart.split('-').map(Number);
  return {
    weekStart: localDateStr(new Date(y, m - 1, d - 7)),
    weekEnd:   localDateStr(new Date(y, m - 1, d - 1)),
  };
};

// Verifica se a semana virou desde o último snapshot.
// Retorna true se um novo snapshot foi tirado (sinaliza que a UI deve re-renderizar).
function maybeSnapshotPreviousWeek() {
  const currentWeekStart = getWeekStart();
  const lastSnapshotWeek = getLastSnapshotWeek();

  // Primeira execução: registra a semana atual como baseline, sem snapshot.
  if (lastSnapshotWeek === null) {
    setLastSnapshotWeek(currentWeekStart);
    return false;
  }

  // Semana ainda não virou.
  if (lastSnapshotWeek >= currentWeekStart) return false;

  // Semana virou: tira snapshot da semana anterior e avança o ponteiro.
  const { weekStart, weekEnd } = getPrevWeekBounds(currentWeekStart);
  saveWeekSnapshot({
    weekStart,
    weekEnd,
    entries: getEntries(),
    goals:   getGoals(),
  });
  setLastSnapshotWeek(currentWeekStart);
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  // Checa virada de semana antes de montar a UI.
  // Garante que o histórico está atualizado mesmo que o usuário
  // tenha ficado sem abrir o app por semanas.
  maybeSnapshotPreviousWeek();

  const { refresh } = setupUI();

  // Quando o usuário volta para a aba (de outro app, do celular em background, etc.),
  // re-verifica se a semana virou enquanto a aba estava inativa.
  // Se virou, tira o snapshot e força re-render completo da UI.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const snapshotTaken = maybeSnapshotPreviousWeek();
    if (snapshotTaken) refresh();
  });
});