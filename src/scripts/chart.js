// src/scripts/chart.js
import { getEntries, getGoals, localDateStr } from "./storage.js";

const lastNDates = (n, end = new Date()) => {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    arr.push(localDateStr(d));
  }
  return arr;
};

export function computeWeeklyData(paramId) {
  const dates   = lastNDates(7);
  const entries = getEntries().filter(e => e.parameterId === paramId);

  const avgForPeriod = (date, period) => {
    const subset = entries.filter(x => x.date === date && (!period || x.period === period));
    if (subset.length === 0) return null;
    return Number((subset.reduce((s, x) => s + x.rating, 0) / subset.length).toFixed(2));
  };

  return {
    labels:    dates,
    morning:   dates.map(d => avgForPeriod(d, 'morning')),
    afternoon: dates.map(d => avgForPeriod(d, 'afternoon')),
    overall:   dates.map(d => avgForPeriod(d, null)),
  };
}

export function renderChart(paramId, paramName) {
  if (!paramId) return;

  const { labels, morning, afternoon, overall } = computeWeeklyData(paramId);
  const goal = getGoals()[paramId];
  const ctx  = document.getElementById('weeklyChart').getContext('2d');

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
      label:               'Overall avg',
      data:                overall,
      spanGaps:            true,
      fill:                false,
      tension:             0.3,
      borderWidth:         2,
      borderDash:          [5, 4],
      borderColor:         'rgb(154, 230, 180)',
      pointBackgroundColor:'rgb(154, 230, 180)',
    },
  ];

  // Linha de meta: dataset constante, desenhado apenas se goal existir
  if (goal?.targetWeeklyAvg != null) {
    datasets.push({
      label:       `Goal (${goal.targetWeeklyAvg})`,
      data:        Array(7).fill(goal.targetWeeklyAvg),
      borderWidth: 1.5,
      borderDash:  [8, 4],
      borderColor: 'rgba(245, 101, 101, 0.8)',
      pointRadius: 0,
      fill:        false,
      tension:     0,
    });
  }

  window.currentChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      scales: { y: { suggestedMin: 0, suggestedMax: 10 } },
      plugins: { legend: { display: true } },
    },
  });
}