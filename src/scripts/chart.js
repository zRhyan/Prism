// src/scripts/charts.js
import { getEntries } from "./storage.js";

const formatDate = (d) => d.toISOString().slice(0, 10);
const lastNDates = (n, end = new Date()) => {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    arr.push(formatDate(d));
  }
  return arr;
};

export function computeWeeklyData(paramId) {
  const dates = lastNDates(7);
  const entries = getEntries().filter((e) => e.parameterId === paramId);
  const data = dates.map((d) => {
    const forDay = entries.filter((x) => x.date === d);
    if (forDay.length === 0) return null;
    const avg = forDay.reduce((s, x) => s + x.rating, 0) / forDay.length;
    return Number(avg.toFixed(2));
  });
  return { labels: dates, data };
}

export function renderChart(paramId, paramName) {
  const dataset = computeWeeklyData(paramId);
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if (window.currentChart) window.currentChart.destroy();

  window.currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: paramName || "Parameter",
          data: dataset.data,
          spanGaps: true,
          fill: false,
          tension: 0.3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      scales: { y: { suggestedMin: 0, suggestedMax: 10 } },
      plugins: { legend: { display: true } },
    },
  });
}
