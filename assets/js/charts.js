const CHARTS = {
  _instances: {},

  _destroy(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
  },

  // Shared dark-theme axis defaults
  _darkAxis(extra = {}) {
    return {
      grid:   { color: 'rgba(51,65,85,0.45)' },
      ticks:  { color: '#94a3b8', font: { family: 'Sarabun', size: 11 } },
      border: { color: 'rgba(51,65,85,0.45)' },
      ...extra,
    };
  },

  renderPie(canvasId, { high, medium, low }) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   ['เสี่ยงสูง', 'เสี่ยงปานกลาง', 'ปกติ'],
        datasets: [{
          data:            [high, medium, low],
          backgroundColor: ['rgba(239,68,68,0.75)', 'rgba(245,158,11,0.75)', 'rgba(16,185,129,0.75)'],
          borderColor:     ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth:     2,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels:   { color: '#94a3b8', font: { family: 'Sarabun', size: 13 }, padding: 16 },
          },
        },
      },
    });
  },

  renderTrend(canvasId, trendData) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   trendData.map(d => d.week),
        datasets: [{
          label:           'Avg Engagement Score',
          data:            trendData.map(d => d.avgScore),
          borderColor:     '#60a5fa',
          backgroundColor: 'rgba(59,130,246,0.12)',
          pointBackgroundColor: '#60a5fa',
          pointBorderColor:    '#1e3a8a',
          pointRadius:     4,
          tension:         0.4,
          fill:            true,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Sarabun' } } },
        },
        scales: {
          y: { ...this._darkAxis(), min: 0, max: 100 },
          x: this._darkAxis(),
        },
      },
    });
  },

  renderGauge(canvasId, score) {
    this._destroy(canvasId);
    const ctx   = document.getElementById(canvasId).getContext('2d');
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data:            [score, 100 - score],
          backgroundColor: [color, 'rgba(30,41,59,0.8)'],
          borderWidth:     0,
        }],
      },
      options: {
        responsive:    false,
        cutout:        '75%',
        rotation:      -90,
        circumference: 180,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  },

  renderBar(canvasId, rankingData) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels:   rankingData.map(d => d.classroom),
        datasets: [{
          label:           'Avg Engagement Score',
          data:            rankingData.map(d => d.avgScore),
          backgroundColor: rankingData.map(d =>
            d.avgScore >= 70 ? 'rgba(16,185,129,0.7)'  :
            d.avgScore >= 40 ? 'rgba(245,158,11,0.7)'  : 'rgba(239,68,68,0.7)'
          ),
          borderColor: rankingData.map(d =>
            d.avgScore >= 70 ? '#10b981' :
            d.avgScore >= 40 ? '#f59e0b' : '#ef4444'
          ),
          borderWidth:  1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => rankingData[items[0].dataIndex].fullName
                                ?? rankingData[items[0].dataIndex].classroom,
            },
          },
        },
        scales: {
          y: { ...this._darkAxis(), min: 0, max: 100 },
          x: this._darkAxis(),
        },
      },
    });
  },
};
