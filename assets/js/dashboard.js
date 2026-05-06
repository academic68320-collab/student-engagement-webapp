const DASHBOARD = {

  // ─── State ───────────────────────────────────────────────────────────────
  _currentView:   'overview',
  _currentCourse: null,
  _courseStudents: [],

  // ─── Init ────────────────────────────────────────────────────────────────
  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    document.getElementById('userName').textContent    = UTILS.escapeHtml(user.name);
    document.getElementById('userAvatar').src          = user.picture;
    document.getElementById('lastUpdated').textContent =
      `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;

    await Promise.all([
      this.loadSummary(),
      this.loadCourseList(),
    ]);
  },

  // ─── Navigation ──────────────────────────────────────────────────────────
  goTo(view, data = {}) {
    ['viewOverview', 'viewCourse', 'viewStudent'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.remove('hidden');
    this._currentView = view;
    this._updateBreadcrumb(view, data);
  },

  _updateBreadcrumb(view, data) {
    const courseWrap   = document.getElementById('breadcrumbCourseWrap');
    const studentWrap  = document.getElementById('breadcrumbStudentWrap');
    const courseName   = document.getElementById('breadcrumbCourse');
    const studentName  = document.getElementById('breadcrumbStudent');

    courseWrap.classList.add('hidden');
    studentWrap.classList.add('hidden');

    if (view === 'course') {
      courseName.textContent = data.courseName || '';
      courseWrap.classList.remove('hidden');
      courseWrap.classList.add('flex');
    }
    if (view === 'student') {
      courseName.textContent  = this._currentCourse?.courseName || '';
      studentName.textContent = data.fullName || '';
      courseWrap.classList.remove('hidden');
      courseWrap.classList.add('flex');
      studentWrap.classList.remove('hidden');
      studentWrap.classList.add('flex');
    }
  },

  // ─── VIEW 1: Overview ────────────────────────────────────────────────────
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

  async loadCourseList() {
    const res = await API.get('getCourseList');
    if (!res) return;

    const tbody = document.getElementById('courseTable');
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">ไม่พบข้อมูลวิชา</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(c => `
      <tr class="border-t border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
        onclick="DASHBOARD.openCourse(${JSON.stringify(c).replace(/"/g, '&quot;')})">
        <td class="px-6 py-4">
          <p class="font-medium text-gray-800">${UTILS.escapeHtml(c.courseName)}</p>
          <p class="text-xs text-gray-400">${UTILS.escapeHtml(c.section)}</p>
        </td>
        <td class="px-6 py-4 text-gray-600">${c.count} คน</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="score-bar w-20">
              <div class="score-bar-fill" style="width:${c.avgScore}%;background:${
                c.avgScore >= 70 ? '#10B981' : c.avgScore >= 40 ? '#F59E0B' : '#EF4444'
              }"></div>
            </div>
            <span class="font-bold text-sm">${c.avgScore}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-red-600 font-medium">${c.high}</td>
        <td class="px-6 py-4 text-yellow-600 font-medium">${c.medium}</td>
        <td class="px-6 py-4 text-green-600 font-medium">${c.low}</td>
      </tr>
    `).join('');
  },

  // ─── VIEW 2: Course Detail ────────────────────────────────────────────────
  async openCourse(course) {
    this._currentCourse = course;
    this.goTo('course', course);

    document.getElementById('courseTitle').textContent    = course.courseName;
    document.getElementById('courseSubtitle').textContent = `Section: ${course.section || '—'}  |  นักเรียน ${course.count} คน`;
    document.getElementById('courseTotal').textContent    = course.count;
    document.getElementById('courseHigh').textContent     = course.high;
    document.getElementById('courseMedium').textContent   = course.medium;
    document.getElementById('courseLow').textContent      = course.low;

    document.getElementById('courseStudentTable').innerHTML =
      `<tr><td colspan="5" class="text-center py-8 text-gray-400">กำลังโหลด...</td></tr>`;

    const res = await API.get('getCourseStudents', { courseId: course.courseId });
    if (!res) return;

    this._courseStudents = res.data;
    this._renderCourseStudents(this._courseStudents);
    this._bindCourseSearch();
  },

  _renderCourseStudents(students) {
    const tbody = document.getElementById('courseStudentTable');
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">ไม่พบนักเรียน</td></tr>`;
      return;
    }

    const rowBg = { HIGH: 'bg-red-50', MEDIUM: 'bg-yellow-50', LOW: '' };

    tbody.innerHTML = students.map(s => `
      <tr class="border-t border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors ${rowBg[s.riskLevel] || ''}"
        onclick="DASHBOARD.openStudent('${UTILS.escapeHtml(s.studentId)}', '${UTILS.escapeHtml(s.fullName)}')">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm shrink-0">
              ${UTILS.escapeHtml(s.fullName?.charAt(0))}
            </div>
            <div>
              <p class="font-medium text-gray-800">${UTILS.escapeHtml(s.fullName)}</p>
              <p class="text-xs text-gray-400">${UTILS.escapeHtml(s.email)}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="font-bold ${s.riskLevel === 'HIGH' ? 'text-red-600' : s.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}">
            ${s.engagementScore ?? '—'}
          </span>
          <span class="text-gray-400 text-xs">/100</span>
        </td>
        <td class="px-6 py-4 text-gray-600">${s.submissionRate ?? '—'}%</td>
        <td class="px-6 py-4 text-gray-600">${s.activeDays ?? '—'} วัน</td>
        <td class="px-6 py-4">${UTILS.riskBadge(s.riskLevel)}</td>
      </tr>
    `).join('');
  },

  _bindCourseSearch() {
    const input = document.getElementById('courseSearchInput');
    input.value = '';
    input.onInput = null;
    input.addEventListener('input', () => {
      const kw = input.value.toLowerCase();
      this._renderCourseStudents(
        this._courseStudents.filter(s => s.fullName?.toLowerCase().includes(kw))
      );
    });
  },

  // ─── VIEW 3: Student Detail ───────────────────────────────────────────────
  async openStudent(studentId, fullName) {
    this.goTo('student', { fullName });

    document.getElementById('studentAvatar').textContent   = fullName?.charAt(0) || '?';
    document.getElementById('studentName').textContent     = fullName;
    document.getElementById('studentEmail').textContent    = '';
    document.getElementById('studentClassroom').textContent = '';
    document.getElementById('studentScoreText').textContent = '…';

    const res = await API.get('getStudentDetail', { studentId });
    if (!res) return;

    const s = res.data;

    document.getElementById('studentName').textContent      = UTILS.escapeHtml(s.fullName);
    document.getElementById('studentEmail').textContent     = UTILS.escapeHtml(s.email);
    document.getElementById('studentClassroom').textContent = `ห้อง: ${UTILS.escapeHtml(s.classroom) || '—'}`;
    document.getElementById('studentRiskBadge').innerHTML   = UTILS.riskBadge(s.riskLevel);
    document.getElementById('studentScoreText').textContent = s.engagementScore ?? '—';

    // Score bars
    document.getElementById('studentSubRate').textContent  = `${s.submissionRate ?? 0}%`;
    document.getElementById('studentActScore').textContent = `${s.activityScore ?? 0}%`;
    document.getElementById('studentDays').textContent     = `${s.activeDays ?? 0} วัน`;

    document.getElementById('studentSubBar').style.width  = `${s.submissionRate ?? 0}%`;
    document.getElementById('studentActBar').style.width  = `${s.activityScore ?? 0}%`;
    document.getElementById('studentDaysBar').style.width = `${Math.min(100, (s.activeDays ?? 0) / 30 * 100)}%`;

    // Gauge
    CHARTS.renderGauge('studentScoreGauge', s.engagementScore ?? 0);

    // Trend
    if (s.history?.length) {
      CHARTS.renderTrend('studentTrendChart', s.history.map(h => ({
        week: h.week, avgScore: Number(h.engagementScore),
      })));
    }

    // Interventions
    const container = document.getElementById('interventionHistory');
    if (!s.interventions?.length) {
      container.innerHTML = `<p class="text-center text-gray-400 py-8">ยังไม่มีประวัติการติดตาม</p>`;
    } else {
      const methodLabel = { call:'📞 โทรศัพท์', email:'📧 อีเมล', visit:'🏠 เยี่ยมบ้าน', meeting:'💬 พูดคุย', other:'อื่นๆ' };
      const outcomeLabel = { in_progress:'⏳ กำลังดำเนินการ', resolved:'✅ แก้ไขแล้ว', no_response:'❌ ไม่มีการตอบสนอง' };
      container.innerHTML = `<div class="divide-y divide-gray-50">` +
        s.interventions.map(i => `
          <div class="px-6 py-4">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-sm">${methodLabel[i.method] || i.method}</span>
              <span class="text-xs text-gray-400">${UTILS.formatDate(i.createdAt)}</span>
            </div>
            <p class="text-sm text-gray-600">${UTILS.escapeHtml(i.note) || '—'}</p>
            <p class="text-xs mt-1">${outcomeLabel[i.outcome] || i.outcome}</p>
          </div>
        `).join('') + `</div>`;
    }
  },

  // ─── Sync ────────────────────────────────────────────────────────────────
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

