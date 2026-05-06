const CHARTS = {
  _instances: {},

  _destroy(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
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
          backgroundColor: ['#FCA5A5', '#FDE68A', '#6EE7B7'],
          borderColor:     ['#EF4444', '#F59E0B', '#10B981'],
          borderWidth:     2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
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
          borderColor:     '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          tension:         0.4,
          fill:            true,
        }],
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100 } },
      },
    });
  },

  renderGauge(canvasId, score) {
    this._destroy(canvasId);
    const ctx   = document.getElementById(canvasId).getContext('2d');
    const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data:            [score, 100 - score],
          backgroundColor: [color, '#F3F4F6'],
          borderWidth:     0,
        }],
      },
      options: {
        responsive:  false,
        cutout:      '75%',
        rotation:    -90,
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
            d.avgScore >= 70 ? '#6EE7B7' :
            d.avgScore >= 40 ? '#FDE68A' : '#FCA5A5'
          ),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 100 },
          x: { ticks: { font: { family: 'Sarabun' } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  },
};
