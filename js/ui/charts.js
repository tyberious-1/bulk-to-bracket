// Mana curve and type breakdown charts.
//
// Chart is a global from the CDN script tag in index.html, so both renderers
// no-op when it failed to load. Previous instances are destroyed before a
// redraw, otherwise Chart.js refuses to reuse the canvas.
//
// Depends on: deck-stats.js

let manaCurveChartInstance = null;
let typeBreakdownChartInstance = null;

function renderManaCurve(deck) {
  const canvas = document.getElementById("manaCurveChart");
  if (!canvas || typeof Chart === "undefined") return;

  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const card of deck || []) {
    const typeLine = String(card.type || card.type_line || "").toLowerCase();
    if (typeLine.includes("land")) continue;
    const mv = Number(card.cmc) || Number(card.mana_value) || 0;
    const index = Math.min(Math.floor(mv), 7);
    buckets[index] += 1;
  }

  if (manaCurveChartInstance) manaCurveChartInstance.destroy();

  manaCurveChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["0", "1", "2", "3", "4", "5", "6", "7+"],
      datasets: [{ label: "Cards", data: buckets, borderRadius: 8, maxBarThickness: 36 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      plugins: { legend: { display: false } },
      layout: { padding: 8 },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { beginAtZero: true, ticks: { precision: 0, color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });
}

function renderTypeBreakdown(deck) {
  const canvas = document.getElementById("typeBreakdownChart");
  if (!canvas || typeof Chart === "undefined") return;

  const counts = countByType(deck);
  const labels = Object.keys(counts).filter((key) => counts[key] > 0);
  const data = labels.map((key) => counts[key]);

  if (typeBreakdownChartInstance) typeBreakdownChartInstance.destroy();

  typeBreakdownChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, color: "#cbd5e1" }
        }
      },
      cutout: "62%",
      layout: { padding: 8 }
    }
  });
}
