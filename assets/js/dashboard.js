const DASHBOARD = {

  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    document.getElementById('userName').textContent    = UTILS.escapeHtml(user.name);
    document.getElementById('userAvatar').src          = user.picture;
    document.getElementById('lastUpdated').textContent =
      `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;

    await Promise.all([
      this.loadSummary(),
      this.loadHighRiskTable(),
      this.loadClassroomRanking(),
    ]);
  },

  async loadSummary() {
    const res = await API.get('getSummary');
    if (!res) return;

    const { total, high, medium, low, trend } = res.data;
    document.getElementById('totalStudents').textContent = total;
    document.getElementById('highRisk').textContent      = high;
    document.getElementById('mediumRisk').textContent    = medium;
    document.getElementById('lowRisk').textContent       = low;

    CHARTS.renderPie('riskPieChart', { high, medium, low });
    if (trend?.length) CHARTS.renderTrend('trendLineChart', trend);
  },

  async loadHighRiskTable() {
    const res = await API.get('getScores', { riskLevel: 'HIGH' });
    if (!res) return;

    const tbody = document.getElementById('highRiskTable');
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-green-500">✅ ไม่มีนักเรียนเสี่ยงสูงในขณะนี้</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr class="border-t border-gray-50 hover:bg-gray-50">
        <td class="px-6 py-4 font-medium">${UTILS.escapeHtml(s.fullName)}</td>
        <td class="px-6 py-4 text-gray-500">${UTILS.escapeHtml(s.classroom)}</td>
        <td class="px-6 py-4">
          <span class="font-bold text-red-600">${s.engagementScore}</span>
          <span class="text-gray-400 text-xs">/100</span>
        </td>
        <td class="px-6 py-4">${s.submissionRate}%</td>
        <td class="px-6 py-4">${s.activeDays} วัน</td>
        <td class="px-6 py-4">${UTILS.riskBadge('HIGH')}</td>
      </tr>
    `).join('');
  },

  async loadClassroomRanking() {
    const res = await API.get('getClassroomRanking');
    if (!res?.data?.length) return;

    CHARTS.renderBar('classroomBarChart', res.data);

    const tbody = document.getElementById('classroomTable');
    tbody.innerHTML = res.data.map((r, i) => `
      <tr class="border-t border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3 text-gray-400 font-medium">${i + 1}</td>
        <td class="px-4 py-3 font-medium">${UTILS.escapeHtml(r.classroom)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="score-bar w-24">
              <div class="score-bar-fill" style="width:${r.avgScore}%;background:${
                r.avgScore >= 70 ? '#10B981' : r.avgScore >= 40 ? '#F59E0B' : '#EF4444'
              }"></div>
            </div>
            <span class="font-bold">${r.avgScore}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-gray-500">${r.count} คน</td>
        <td class="px-4 py-3 text-red-500 font-medium">${r.highRisk} คน</td>
      </tr>
    `).join('');
  },

  async syncNow() {
    const btn = document.getElementById('syncBtn');
    btn.textContent = '⏳ กำลัง Sync...';
    btn.disabled    = true;

    const res = await API.post('manualSync', {});
    UTILS.toast(res ? '✅ Sync สำเร็จ' : '❌ Sync ไม่สำเร็จ', res ? 'success' : 'error');

    if (res) await this.init();

    btn.textContent = '🔄 Sync ข้อมูล';
    btn.disabled    = false;
  },
};

document.addEventListener('DOMContentLoaded', () => DASHBOARD.init());
