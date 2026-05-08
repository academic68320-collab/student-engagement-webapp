const DASHBOARD = {

  // ─── State ───────────────────────────────────────────────────────────────
  _currentView:   'overview',
  _currentCourse: null,
  _courseStudents: [],
  _allCourses:    [],
  _courseFilter:  { search: '', sortKey: 'avgScore', sortDir: 'desc', page: 1, pageSize: 25 },

  // ─── Init ────────────────────────────────────────────────────────────────
  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    UTILS.showLoader('กำลังโหลดข้อมูล Dashboard...');

    document.getElementById('userName').textContent = UTILS.escapeHtml(user.name);
    UTILS.setAvatar(document.getElementById('userAvatar'), user.picture, user.name);
    document.getElementById('lastUpdated').textContent =
      `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;

    // Admin buttons — admin only
    if (user.role === 'admin') {
      document.getElementById('adminBtns').classList.remove('hidden');
    }

    history.replaceState({ view: 'overview' }, '', location.href);
    window.addEventListener('popstate', e => DASHBOARD._onPopState(e));

    await Promise.all([
      this.loadSummary(),
      this.loadCourseList(),
    ]);

    UTILS.hideLoader();
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
    if (!res) {
      UTILS.apiError('kpiError', () => DASHBOARD.init());
      return;
    }

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
    if (!res) {
      UTILS.apiError('courseTable', () => DASHBOARD.loadCourseList());
      return;
    }

    this._allCourses = res.data;

    // Top 10 วิชา bar chart
    const top10 = [...res.data]
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10)
      .map(c => ({
        classroom: c.courseName.substr(7, 15) + (c.courseName.length > 22 ? '…' : ''),
        fullName:  c.courseName,
        avgScore:  c.avgScore,
      }));
    CHARTS.renderBar('classroomRankingChart', top10);

    // Overall avg score gauge (weighted by student count)
    if (this._allCourses.length) {
      const totalCount  = this._allCourses.reduce((s, c) => s + (c.count || 0), 0);
      const weightedSum = this._allCourses.reduce((s, c) => s + (c.avgScore || 0) * (c.count || 0), 0);
      const avgScore    = totalCount ? Math.round(weightedSum / totalCount) : 0;
      document.getElementById('overallScoreText').textContent = avgScore;
      CHARTS.renderGauge('overallScoreGauge', avgScore);
    }

    // Bind search
    const searchEl = document.getElementById('courseSearch');
    searchEl.value  = '';
    searchEl.oninput = () => {
      this._courseFilter.search = searchEl.value;
      this._courseFilter.page   = 1;
      this._renderCourseTable();
    };

    this._courseFilter.page = 1;
    this._renderCourseTable();
  },

  _renderCourseTable() {
    const { search, sortKey, sortDir, page, pageSize } = this._courseFilter;

    // Filter
    let data = this._allCourses.filter(c =>
      !search || c.courseName.toLowerCase().includes(search.toLowerCase())
    );

    // Sort
    data = [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const p     = Math.min(page, pages);
    const slice = data.slice((p - 1) * pageSize, p * pageSize);

    // Sort arrows
    ['courseName','count','avgScore','high','medium','low'].forEach(k => {
      const el = document.getElementById(`srt_${k}`);
      if (el) el.textContent = k === sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
    });

    // Render table rows (desktop)
    const tbody = document.getElementById('courseTable');
    tbody.innerHTML = !slice.length
      ? `<tr><td colspan="6" class="text-center py-8 text-slate-500">ไม่พบข้อมูลวิชา</td></tr>`
      : slice.map(c => `
        <tr class="border-t border-slate-700/30 tbl-row cursor-pointer transition-colors"
          onclick="DASHBOARD.openCourse(${JSON.stringify(c).replace(/"/g, '&quot;')})">
          <td class="px-6 py-4">
            <p class="font-medium text-slate-200">${UTILS.escapeHtml(c.courseName)}</p>
            <p class="text-xs text-slate-500">${UTILS.escapeHtml(c.section)}</p>
          </td>
          <td class="px-6 py-4 text-slate-400">${c.count} คน</td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <div class="score-bar w-20">
                <div class="score-bar-fill" style="width:${c.avgScore}%;background:${
                  c.avgScore >= 70 ? '#10b981' : c.avgScore >= 40 ? '#f59e0b' : '#ef4444'
                }"></div>
              </div>
              <span class="font-bold text-sm text-slate-200">${c.avgScore}</span>
            </div>
          </td>
          <td class="px-6 py-4 text-red-400 font-medium">${c.high}</td>
          <td class="px-6 py-4 text-amber-400 font-medium">${c.medium}</td>
          <td class="px-6 py-4 text-emerald-400 font-medium">${c.low}</td>
        </tr>`).join('');

    // Render mobile cards
    const mobileList = document.getElementById('courseMobileList');
    mobileList.innerHTML = !slice.length
      ? `<p class="text-center py-8 text-slate-500">ไม่พบข้อมูลวิชา</p>`
      : slice.map(c => {
          const scoreColor = c.avgScore >= 70 ? '#10b981' : c.avgScore >= 40 ? '#f59e0b' : '#ef4444';
          const topRisk = c.high > 0 ? 'HIGH' : c.medium > 0 ? 'MEDIUM' : 'LOW';
          const borderAccent = { HIGH: 'border-l-red-500', MEDIUM: 'border-l-amber-500', LOW: 'border-l-emerald-500' };
          return `
          <div class="px-4 py-3 border-l-2 ${borderAccent[topRisk]} cursor-pointer active:bg-slate-700/30 transition-colors"
            onclick="DASHBOARD.openCourse(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-slate-200 text-sm leading-snug">${UTILS.escapeHtml(c.courseName)}</p>
                <p class="text-xs text-slate-500 mt-0.5">${UTILS.escapeHtml(c.section)}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-bold text-base" style="color:${scoreColor}">${c.avgScore}</p>
                <p class="text-xs text-slate-500">avg score</p>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>👤 ${c.count} คน</span>
              ${c.high   > 0 ? `<span class="text-red-400">🔴 ${c.high}</span>` : ''}
              ${c.medium > 0 ? `<span class="text-amber-400">🟡 ${c.medium}</span>` : ''}
              ${c.low    > 0 ? `<span class="text-emerald-400">🟢 ${c.low}</span>` : ''}
              <span class="ml-auto text-slate-600">›</span>
            </div>
          </div>`;
        }).join('');

    // Pagination info
    const from = total ? (p - 1) * pageSize + 1 : 0;
    const to   = Math.min(p * pageSize, total);
    document.getElementById('coursePageInfo').textContent =
      `แสดง ${from}–${to} จาก ${total} รายการ`;

    // Page buttons
    const pageBtns = [];
    const btnClass = (active) =>
      `px-2.5 py-1 rounded border text-xs transition-colors ${active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'border-slate-600 hover:bg-slate-700 text-slate-400'}`;
    const disabledClass = 'px-2.5 py-1 rounded border text-xs border-slate-700 text-slate-600 cursor-not-allowed';

    pageBtns.push(`<button ${p <= 1 ? `disabled class="${disabledClass}"` : `onclick="DASHBOARD.goCoursePage(${p-1})" class="${btnClass(false)}"`}>‹</button>`);

    // Page range
    const range = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) range.push(i);
    } else {
      range.push(1);
      if (p > 3) range.push('…');
      for (let i = Math.max(2, p-1); i <= Math.min(pages-1, p+1); i++) range.push(i);
      if (p < pages - 2) range.push('…');
      range.push(pages);
    }
    range.forEach(pg => {
      if (pg === '…') {
        pageBtns.push(`<span class="px-1 text-xs text-gray-400">…</span>`);
      } else {
        pageBtns.push(`<button onclick="DASHBOARD.goCoursePage(${pg})" class="${btnClass(pg === p)}">${pg}</button>`);
      }
    });

    pageBtns.push(`<button ${p >= pages ? `disabled class="${disabledClass}"` : `onclick="DASHBOARD.goCoursePage(${p+1})" class="${btnClass(false)}"`}>›</button>`);

    document.getElementById('coursePageBtns').innerHTML = pageBtns.join('');
  },

  sortCourse(key) {
    if (this._courseFilter.sortKey === key) {
      this._courseFilter.sortDir = this._courseFilter.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._courseFilter.sortKey = key;
      this._courseFilter.sortDir = key === 'courseName' ? 'asc' : 'desc';
    }
    this._courseFilter.page = 1;
    this._renderCourseTable();
  },

  goCoursePage(page) {
    const pages = Math.max(1, Math.ceil(this._allCourses.length / this._courseFilter.pageSize));
    this._courseFilter.page = Math.max(1, Math.min(page, pages));
    this._renderCourseTable();
  },

  // ─── VIEW 2: Course Detail ────────────────────────────────────────────────
  async openCourse(course, fromHistory = false) {
    this._currentCourse = course;
    if (!fromHistory) history.pushState({ view: 'course', data: course }, '', location.href);
    this.goTo('course', course);

    document.getElementById('courseTitle').textContent    = course.courseName;
    document.getElementById('courseSubtitle').textContent = `Section: ${course.section || '—'}  |  นักเรียน ${course.count} คน`;
    document.getElementById('courseTotal').textContent    = course.count;
    document.getElementById('courseHigh').textContent     = course.high;
    document.getElementById('courseMedium').textContent   = course.medium;
    document.getElementById('courseLow').textContent      = course.low;
    document.getElementById('courseScoreText').textContent = course.avgScore ?? '—';
    CHARTS.renderGauge('courseScoreGauge', course.avgScore ?? 0);

    document.getElementById('courseStudentTable').innerHTML =
      `<tr><td colspan="5" class="text-center py-8 text-gray-400">กำลังโหลด...</td></tr>`;

    UTILS.showLoader('กำลังโหลดรายชื่อนักเรียน...');
    const res = await API.get('getCourseStudents', { courseId: course.courseId });
    UTILS.hideLoader();
    if (!res) return;

    this._courseStudents = res.data;
    this._renderCourseStudents(this._courseStudents);
    this._bindCourseSearch();
  },

  _renderCourseStudents(students) {
    const tbody    = document.getElementById('courseStudentTable');
    const mobileEl = document.getElementById('courseStudentMobileList');

    if (students.length === 0) {
      tbody.innerHTML    = `<tr><td colspan="5" class="text-center py-8 text-slate-500">ไม่พบนักเรียน</td></tr>`;
      mobileEl.innerHTML = `<p class="text-center py-8 text-slate-500">ไม่พบนักเรียน</p>`;
      return;
    }

    const scoreColor  = r => r === 'HIGH' ? 'text-red-400' : r === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400';
    const borderAccent = { HIGH: 'border-l-red-500', MEDIUM: 'border-l-amber-500', LOW: 'border-l-emerald-500' };
    const rowBg        = { HIGH: 'bg-red-950/20', MEDIUM: 'bg-amber-950/20', LOW: '' };

    // Desktop table
    tbody.innerHTML = students.map(s => `
      <tr class="border-t border-slate-700/30 tbl-row cursor-pointer transition-colors ${rowBg[s.riskLevel] || ''}"
        onclick="DASHBOARD.openStudent('${UTILS.escapeHtml(s.studentId)}', '${UTILS.escapeHtml(s.fullName)}')">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm shrink-0">
              ${UTILS.escapeHtml(s.fullName?.charAt(0))}
            </div>
            <div>
              <p class="font-medium text-slate-200">${UTILS.escapeHtml(s.fullName)}</p>
              <p class="text-xs text-slate-500">${UTILS.escapeHtml(s.email)}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="font-bold ${scoreColor(s.riskLevel)}">${s.engagementScore ?? '—'}</span>
          <span class="text-slate-600 text-xs">/100</span>
        </td>
        <td class="px-6 py-4 text-slate-400">${s.submissionRate ?? '—'}%</td>
        <td class="px-6 py-4 text-slate-400">${s.activeDays ?? '—'} วัน</td>
        <td class="px-6 py-4">${UTILS.riskBadge(s.riskLevel)}</td>
      </tr>`).join('');

    // Mobile card list
    mobileEl.innerHTML = students.map(s => `
      <div class="px-4 py-3 border-l-2 ${borderAccent[s.riskLevel] || 'border-l-slate-600'} cursor-pointer active:bg-slate-700/30 transition-colors"
        onclick="DASHBOARD.openStudent('${UTILS.escapeHtml(s.studentId)}', '${UTILS.escapeHtml(s.fullName)}')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm shrink-0">
            ${UTILS.escapeHtml(s.fullName?.charAt(0))}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 text-sm truncate">${UTILS.escapeHtml(s.fullName)}</p>
            <p class="text-xs text-slate-500 truncate">${UTILS.escapeHtml(s.email)}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-base ${scoreColor(s.riskLevel)}">${s.engagementScore ?? '—'}</p>
            <p class="text-xs text-slate-500">score</p>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-2 text-xs text-slate-500" style="padding-left:52px">
          <span>ส่งงาน <span class="text-slate-300">${s.submissionRate ?? '—'}%</span></span>
          <span>·</span>
          <span>${s.activeDays ?? '—'} วัน</span>
          <span class="ml-auto">${UTILS.riskBadge(s.riskLevel)}</span>
        </div>
      </div>`).join('');
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
  async openStudent(studentId, fullName, fromHistory = false) {
    if (!fromHistory) history.pushState({ view: 'student', data: { studentId, fullName } }, '', location.href);
    this.goTo('student', { fullName });

    document.getElementById('studentAvatar').textContent   = fullName?.charAt(0) || '?';
    document.getElementById('studentName').textContent     = fullName;
    document.getElementById('studentEmail').textContent    = '';
    document.getElementById('studentClassroom').textContent = '';
    document.getElementById('studentScoreText').textContent = '…';

    UTILS.showLoader('กำลังโหลดข้อมูลนักเรียน...');
    const res = await API.get('getStudentDetail', { studentId });
    UTILS.hideLoader();
    if (!res) {
      UTILS.apiError('studentError', () => DASHBOARD.openStudent(studentId, fullName, true));
      return;
    }

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

    // Recommendations
    this._renderRecommendations(UTILS.recommend(s));

    // Per-course scores
    const coursesRes = await API.get('getStudentCourses', { studentId });
    this._renderStudentCourses(coursesRes?.data || []);

    UTILS.hideLoader();

    // Interventions
    const container = document.getElementById('interventionHistory');
    if (!s.interventions?.length) {
      container.innerHTML = `<p class="text-center text-gray-400 py-8">ยังไม่มีประวัติการติดตาม</p>`;
    } else {
      const methodLabel = { call:'📞 โทรศัพท์', email:'📧 อีเมล', visit:'🏠 เยี่ยมบ้าน', meeting:'💬 พูดคุย', other:'อื่นๆ' };
      const outcomeLabel = { in_progress:'⏳ กำลังดำเนินการ', resolved:'✅ แก้ไขแล้ว', no_response:'❌ ไม่มีการตอบสนอง' };
      container.innerHTML = `<div class="divide-y divide-slate-700/30">` +
        s.interventions.map(i => `
          <div class="px-6 py-4">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-sm text-slate-200">${methodLabel[i.method] || i.method}</span>
              <span class="text-xs text-slate-500">${UTILS.formatDate(i.createdAt)}</span>
            </div>
            <p class="text-sm text-slate-400">${UTILS.escapeHtml(i.note) || '—'}</p>
            <p class="text-xs mt-1 text-slate-500">${outcomeLabel[i.outcome] || i.outcome}</p>
          </div>
        `).join('') + `</div>`;
    }
  },

  // ─── Recommendations ─────────────────────────────────────────────────────
  _renderRecommendations(recs) {
    const container = document.getElementById('studentRecommendations');
    if (!recs?.length) {
      container.innerHTML = `<p class="text-center text-gray-400 py-4">ไม่มีคำแนะนำ</p>`;
      return;
    }

    const style = {
      urgent:  'bg-red-950/40 border-red-700/40',
      warning: 'bg-amber-950/40 border-amber-700/40',
      good:    'bg-emerald-950/40 border-emerald-700/40',
    };
    const textStyle = {
      urgent:  'text-red-400',
      warning: 'text-amber-400',
      good:    'text-emerald-400',
    };
    const methodLabel = {
      call: 'โทรหาผู้ปกครอง', email: 'ส่ง Email แจ้งเตือน',
      visit: 'เยี่ยมบ้าน', meeting: 'พูดคุยที่โรงเรียน',
    };

    container.innerHTML = recs.map(r => `
      <div class="flex items-start gap-3 p-3 rounded-xl border ${style[r.level] || style.warning}">
        <span class="text-xl shrink-0 mt-0.5">${r.icon}</span>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm ${textStyle[r.level] || textStyle.warning}">${r.reason}</p>
          ${r.method ? `
            <p class="text-xs mt-1 ${textStyle[r.level] || textStyle.warning} opacity-80">
              แนะนำ: <span class="font-semibold">${methodLabel[r.method] || r.method}</span>
            </p>
            <p class="text-xs mt-0.5 text-slate-500">${r.note || ''}</p>
          ` : ''}
        </div>
        ${r.level === 'urgent' ? `
          <span class="shrink-0 text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">ด่วน</span>
        ` : ''}
      </div>`).join('');
  },

  // ─── Student Course List ─────────────────────────────────────────────────
  _renderStudentCourses(courses) {
    const container = document.getElementById('studentCourseList');
    if (!courses.length) {
      container.innerHTML = `<p class="text-center text-gray-400 py-6">ไม่พบข้อมูลรายวิชา</p>`;
      return;
    }
    container.innerHTML = `<div class="divide-y divide-slate-700/30">` +
      courses.map(c => `
        <div class="px-6 py-4 flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 text-sm truncate">${UTILS.escapeHtml(c.courseName)}</p>
            <p class="text-xs text-slate-500 mt-0.5">${UTILS.escapeHtml(c.section)}</p>
          </div>
          <div class="flex items-center gap-4 shrink-0 text-sm">
            <div class="text-center w-16">
              <p class="text-xs text-slate-500">Score</p>
              <p class="font-bold ${c.riskLevel==='HIGH'?'text-red-400':c.riskLevel==='MEDIUM'?'text-amber-400':'text-emerald-400'}">${c.engagementScore}</p>
            </div>
            <div class="text-center w-16">
              <p class="text-xs text-slate-500">ส่งงาน</p>
              <p class="font-medium text-slate-300">${c.submittedCount}/${c.totalAssignments} <span class="text-slate-500">(${c.submissionRate}%)</span></p>
            </div>
            ${UTILS.riskBadge(c.riskLevel)}
          </div>
        </div>
      `).join('') + `</div>`;
  },

  // ─── Risk Modal ──────────────────────────────────────────────────────────
  _riskStudents: [],

  async showRiskModal(riskLevel) {
    const titles = { HIGH: '🔴 นักเรียนเสี่ยงสูง', MEDIUM: '🟡 นักเรียนเสี่ยงปานกลาง', LOW: '🟢 นักเรียนปกติ', '': '👥 นักเรียนทั้งหมด' };
    document.getElementById('riskModalTitle').textContent  = titles[riskLevel] ?? 'นักเรียน';
    document.getElementById('riskModalSearch').value       = '';
    document.getElementById('riskModalList').innerHTML     =
      `<p class="text-center text-gray-400 py-10">กำลังโหลด...</p>`;
    document.getElementById('riskModal').classList.remove('hidden');

    const res = await API.get('getScores', riskLevel ? { riskLevel } : {});
    if (!res?.data?.length) {
      document.getElementById('riskModalList').innerHTML =
        `<p class="text-center text-gray-400 py-10">ไม่พบข้อมูล</p>`;
      return;
    }

    this._riskStudents = res.data;
    this._renderRiskList(res.data);

    // bind search
    document.getElementById('riskModalSearch').oninput = (e) => {
      const kw = e.target.value.toLowerCase();
      this._renderRiskList(this._riskStudents.filter(s =>
        s.fullName?.toLowerCase().includes(kw)
      ));
    };
  },

  _renderRiskList(students) {
    const borderColor = { HIGH: 'border-red-800/40', MEDIUM: 'border-amber-800/40', LOW: 'border-emerald-800/40' };
    const bgColor     = { HIGH: 'bg-red-950/30',     MEDIUM: 'bg-amber-950/30',     LOW: 'bg-emerald-950/30' };
    document.getElementById('riskModalList').innerHTML = students.length
      ? students.map(s => `
        <div onclick="DASHBOARD.closeRiskModal(); DASHBOARD.openStudent('${UTILS.escapeHtml(s.studentId)}','${UTILS.escapeHtml(s.fullName)}')"
          class="flex items-center gap-3 p-3 rounded-xl border ${borderColor[s.riskLevel] || 'border-slate-700/50'}
          ${bgColor[s.riskLevel] || 'bg-slate-800/50'} mb-2 cursor-pointer hover:brightness-110 transition-all">
          <div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 shrink-0">
            ${UTILS.escapeHtml(s.fullName?.charAt(0))}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 text-sm truncate">${UTILS.escapeHtml(s.fullName)}</p>
            <p class="text-xs text-slate-500">${UTILS.escapeHtml(s.email || '')}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-sm ${s.riskLevel==='HIGH'?'text-red-400':s.riskLevel==='MEDIUM'?'text-amber-400':'text-emerald-400'}">${s.engagementScore ?? '—'}</p>
            <p class="text-xs text-slate-600">score</p>
          </div>
          ${UTILS.riskBadge(s.riskLevel)}
        </div>`).join('')
      : `<p class="text-center text-slate-500 py-10">ไม่พบนักเรียน</p>`;
  },

  closeRiskModal() {
    document.getElementById('riskModal').classList.add('hidden');
  },

  // ─── Send Alert Emails ───────────────────────────────────────────────────
  _alertStudents: [],

  async sendAlerts() {
    // เปิด modal แล้วดึงข้อมูลก่อน
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertStudentList').innerHTML =
      `<p class="text-center text-gray-400 py-10">กำลังโหลดรายชื่อ...</p>`;
    document.getElementById('alertSelectAll').checked       = false;
    document.getElementById('alertSelectedCount').textContent = 'เลือก 0 คน';
    document.getElementById('alertSendBtn').textContent     = '📧 ส่ง Email';

    const res = await API.get('getAlertPreview');
    if (!res) {
      document.getElementById('alertStudentList').innerHTML =
        `<p class="text-center text-red-400 py-10">❌ เรียก API ไม่สำเร็จ — ดู Console (F12) เพื่อดู error</p>`;
      return;
    }
    if (!res.data?.length) {
      document.getElementById('alertStudentList').innerHTML =
        `<p class="text-center text-gray-400 py-10">✅ ไม่มีนักเรียนเสี่ยงสูงในขณะนี้</p>`;
      return;
    }

    this._alertStudents = res.data;
    this._renderAlertList(res.data);
  },

  _renderAlertList(students) {
    document.getElementById('alertStudentList').innerHTML = students.map(s => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-700/30 last:border-0">
        <input type="checkbox" class="alert-cb w-4 h-4 accent-blue-500 cursor-pointer shrink-0"
          data-id="${UTILS.escapeHtml(s.studentId)}" onchange="DASHBOARD._updateAlertCount()" checked>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-slate-200 text-sm truncate">${UTILS.escapeHtml(s.fullName)}</p>
          ${s.courseName && s.courseName !== 'undefined'
            ? `<p class="text-xs text-slate-500 truncate">${UTILS.escapeHtml(s.courseName)}</p>`
            : ''}
        </div>
        <span class="font-bold text-red-400 text-sm shrink-0">${s.engagementScore ?? '—'}</span>
        <span class="px-2 py-0.5 bg-red-950/50 text-red-400 border border-red-800/40 rounded-full text-xs shrink-0">🔴 เสี่ยงสูง</span>
      </div>`).join('');

    document.getElementById('alertSelectAll').checked = true;
    this._updateAlertCount();
  },

  _updateAlertCount() {
    const all     = document.querySelectorAll('.alert-cb');
    const checked = document.querySelectorAll('.alert-cb:checked');
    document.getElementById('alertSelectedCount').textContent = `เลือก ${checked.length} คน`;
    document.getElementById('alertSendBtn').textContent       = `📧 ส่ง Email (${checked.length} คน)`;
    const selectAll = document.getElementById('alertSelectAll');
    selectAll.checked       = checked.length === all.length && all.length > 0;
    selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.alert-cb').forEach(cb => cb.checked = checked);
    this._updateAlertCount();
  },

  closeAlertModal() {
    document.getElementById('alertModal').classList.add('hidden');
  },

  async confirmSendAlerts() {
    const selected = [...document.querySelectorAll('.alert-cb:checked')].map(cb => cb.dataset.id);
    if (!selected.length) {
      UTILS.toast('กรุณาเลือกนักเรียนอย่างน้อย 1 คน', 'error');
      return;
    }

    this.closeAlertModal();
    UTILS.showLoader(`กำลังส่ง Email สำหรับ ${selected.length} คน...`);
    const res = await API.post('sendAlerts', { studentIds: selected });
    UTILS.hideLoader();

    UTILS.toast(
      res ? `✅ ส่ง Email สำเร็จ ${res.data?.sent ?? 0} ฉบับ` : '❌ ส่ง Email ไม่สำเร็จ',
      res ? 'success' : 'error'
    );
  },

  // ─── Export ─────────────────────────────────────────────────────────────
  exportStudents(format) {
    const students = this._courseStudents;
    const course   = this._currentCourse;
    if (!students?.length) { UTILS.toast('ไม่มีข้อมูลนักเรียน', 'error'); return; }

    const courseName  = course?.courseName || 'รายงาน';
    const dateStr     = new Date().toLocaleDateString('th-TH');
    const safeFile    = courseName.replace(/[\/\\:*?"<>|]/g, '_');
    const riskLabel   = { HIGH: 'เสี่ยงสูง', MEDIUM: 'เสี่ยงปานกลาง', LOW: 'ปกติ' };
    const riskColor   = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' };

    const headers = ['ลำดับ', 'ชื่อ', 'อีเมล', 'Engagement Score', 'ส่งงาน (%)', 'Active Days', 'ระดับความเสี่ยง'];
    const rows = students.map((s, i) => [
      i + 1,
      s.fullName || '',
      s.email || '',
      s.engagementScore ?? '',
      s.submissionRate ?? '',
      s.activeDays ?? '',
      riskLabel[s.riskLevel] || s.riskLevel || '',
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch:6 },{ wch:30 },{ wch:35 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน');
      XLSX.writeFile(wb, `${safeFile}_${dateStr}.xlsx`);
      UTILS.toast('✅ ดาวน์โหลด Excel สำเร็จ', 'success');
      return;
    }

    // PDF via print window
    const tableRows = students.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${UTILS.escapeHtml(s.fullName || '')}</td>
        <td>${UTILS.escapeHtml(s.email || '')}</td>
        <td style="text-align:center;font-weight:bold;color:${riskColor[s.riskLevel] || '#333'}">${s.engagementScore ?? '—'}</td>
        <td style="text-align:center">${s.submissionRate ?? '—'}%</td>
        <td style="text-align:center">${s.activeDays ?? '—'} วัน</td>
        <td style="text-align:center;color:${riskColor[s.riskLevel] || '#333'}">${riskLabel[s.riskLevel] || s.riskLevel || ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<title>${UTILS.escapeHtml(courseName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{font-family:'Sarabun',sans-serif;font-size:12px;color:#333;padding:20px}
  h2{font-size:15px;margin:0 0 2px}
  p{font-size:11px;color:#666;margin:0 0 14px}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;text-align:left;padding:7px 9px;font-size:11px;font-weight:600;border:1px solid #e5e7eb}
  td{padding:5px 9px;border:1px solid #e5e7eb;font-size:11px}
  tr:nth-child(even){background:#f9fafb}
  @media print{body{padding:0}}
</style></head><body>
<h2>${UTILS.escapeHtml(courseName)}</h2>
<p>Section: ${UTILS.escapeHtml(course?.section || '—')} &nbsp;|&nbsp; ส่งออกเมื่อ: ${dateStr} &nbsp;|&nbsp; จำนวน: ${students.length} คน</p>
<table>
  <thead><tr>
    <th style="width:40px">ลำดับ</th><th>ชื่อ</th><th>อีเมล</th>
    <th style="width:75px">Score</th><th style="width:75px">ส่งงาน</th>
    <th style="width:85px">Active Days</th><th style="width:105px">ระดับความเสี่ยง</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },

  // ─── Browser Back/Forward ────────────────────────────────────────────────
  _onPopState(e) {
    const { view, data } = e.state || { view: 'overview', data: {} };
    if (view === 'course' && data?.courseId) {
      this.openCourse(data, true);
    } else if (view === 'student' && data?.studentId) {
      this.openStudent(data.studentId, data.fullName, true);
    } else {
      this.goTo('overview');
    }
  },

  // ─── System Config ───────────────────────────────────────────────────────
  openConfig() {
    const cfg = CONFIG.get();

    // Risk thresholds
    document.getElementById('cfg_highMax').value   = cfg.highMax;
    document.getElementById('cfg_mediumMax').value = cfg.mediumMax;
    document.getElementById('cfg_lowDisplay').textContent = cfg.mediumMax + '+';

    // Weights
    document.getElementById('cfg_wSubmission').value      = cfg.wSubmission;
    document.getElementById('cfg_wSubmission_txt').value  = cfg.wSubmission;
    document.getElementById('cfg_wActivity').value        = cfg.wActivity;
    document.getElementById('cfg_wActivity_txt').value    = cfg.wActivity;
    document.getElementById('cfg_wActiveDays').value      = cfg.wActiveDays;
    document.getElementById('cfg_wActiveDays_txt').value  = cfg.wActiveDays;
    this._onWeightChange();

    // Recommendation thresholds
    document.getElementById('cfg_subUrgent').value   = cfg.subUrgent;
    document.getElementById('cfg_subWarning').value  = cfg.subWarning;
    document.getElementById('cfg_daysUrgent').value  = cfg.daysUrgent;
    document.getElementById('cfg_daysWarning').value = cfg.daysWarning;
    document.getElementById('cfg_actWarning').value  = cfg.actWarning;
    document.getElementById('cfg_trendDrop').value   = cfg.trendDrop;

    document.getElementById('configModal').classList.remove('hidden');
  },

  closeConfig() {
    document.getElementById('configModal').classList.add('hidden');
  },

  _onWeightChange(source, field) {
    if (source && field) {
      const slider = document.getElementById(`cfg_${field}`);
      const txt    = document.getElementById(`cfg_${field}_txt`);
      if (source === 'slider') txt.value   = slider.value;
      else                     slider.value = txt.value;
    }

    const w1  = Number(document.getElementById('cfg_wSubmission').value);
    const w2  = Number(document.getElementById('cfg_wActivity').value);
    const w3  = Number(document.getElementById('cfg_wActiveDays').value);
    const sum = w1 + w2 + w3;

    const sumEl = document.getElementById('cfg_weightSum');
    sumEl.textContent = `รวม ${sum}%`;
    sumEl.className = sum === 100
      ? 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
      : 'text-xs font-bold px-2 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-800/40';

    const mediumMax = Number(document.getElementById('cfg_mediumMax').value);
    if (!isNaN(mediumMax)) document.getElementById('cfg_lowDisplay').textContent = mediumMax + '+';
  },

  saveConfig() {
    const highMax   = Number(document.getElementById('cfg_highMax').value);
    const mediumMax = Number(document.getElementById('cfg_mediumMax').value);
    const w1 = Number(document.getElementById('cfg_wSubmission').value);
    const w2 = Number(document.getElementById('cfg_wActivity').value);
    const w3 = Number(document.getElementById('cfg_wActiveDays').value);

    if (highMax >= mediumMax) {
      UTILS.toast('เกณฑ์เสี่ยงสูงต้องน้อยกว่าเกณฑ์เสี่ยงปานกลาง', 'error'); return;
    }
    if (w1 + w2 + w3 !== 100) {
      UTILS.toast('น้ำหนักรวมต้องเท่ากับ 100%', 'error'); return;
    }

    CONFIG.save({
      highMax,
      mediumMax,
      wSubmission: w1,
      wActivity:   w2,
      wActiveDays: w3,
      subUrgent:   Number(document.getElementById('cfg_subUrgent').value),
      subWarning:  Number(document.getElementById('cfg_subWarning').value),
      daysUrgent:  Number(document.getElementById('cfg_daysUrgent').value),
      daysWarning: Number(document.getElementById('cfg_daysWarning').value),
      actWarning:  Number(document.getElementById('cfg_actWarning').value),
      trendDrop:   Number(document.getElementById('cfg_trendDrop').value),
    });

    UTILS.toast('✅ บันทึกการตั้งค่าสำเร็จ', 'success');
    this.closeConfig();
  },

  resetConfig() {
    if (!confirm('รีเซ็ตกลับเป็นค่าเริ่มต้น?')) return;
    CONFIG.reset();
    UTILS.toast('รีเซ็ตค่าเริ่มต้นแล้ว', 'info');
    this.openConfig();
  },

  // ─── Sync ────────────────────────────────────────────────────────────────
  async syncNow() {
    const btn = document.getElementById('syncBtn');
    btn.textContent = '⏳ กำลัง Sync...';
    btn.disabled    = true;

    UTILS.showLoader('กำลัง Sync ข้อมูล...');
    const res = await API.post('manualSync', {});
    UTILS.hideLoader();

    UTILS.toast(res ? '✅ Sync สำเร็จ' : '❌ Sync ไม่สำเร็จ', res ? 'success' : 'error');
    if (res) await this.init();

    btn.textContent = '🔄 Sync ข้อมูล';
    btn.disabled    = false;
  },
};

