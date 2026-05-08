const TEACHER = {
  _user:        null,
  _currentCourse: null,
  _allStudents: [],

  // ─── Init ────────────────────────────────────────────────────────────────
  async init() {
    this._user = AUTH.requireAuth();
    if (!this._user) return;
    UTILS.showLoader('กำลังโหลดรายวิชา...');
    document.getElementById('teacherName').textContent = UTILS.escapeHtml(this._user.name);
    await this.loadCourses();
    UTILS.hideLoader();
  },

  // ─── Navigation ──────────────────────────────────────────────────────────
  goTo(view) {
    document.getElementById('viewCourses').classList.add('hidden');
    document.getElementById('viewStudents').classList.add('hidden');
    document.getElementById('bcStudentWrap').classList.add('hidden');

    if (view === 'courses') {
      document.getElementById('viewCourses').classList.remove('hidden');
    } else if (view === 'students') {
      document.getElementById('viewStudents').classList.remove('hidden');
      document.getElementById('bcStudentWrap').classList.remove('hidden');
      document.getElementById('bcStudentWrap').classList.add('flex');
    }
  },

  // ─── VIEW 1: Course List ─────────────────────────────────────────────────
  async loadCourses() {
    const res = await API.get('getTeacherCourses', { teacherEmail: this._user.email });
    const container = document.getElementById('courseCards');

    if (!res || !res.data.length) {
      container.innerHTML = `<p class="text-center text-slate-500 py-8">ไม่พบวิชาที่รับผิดชอบ</p>`;
      return;
    }

    const borderAccent = { HIGH: 'border-l-red-500', MEDIUM: 'border-l-amber-500', LOW: 'border-l-emerald-500' };
    const scoreColor   = s => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';

    container.innerHTML = res.data.map(c => {
      const topRisk = c.high > 0 ? 'HIGH' : c.medium > 0 ? 'MEDIUM' : 'LOW';
      return `
        <div class="card border-l-4 ${borderAccent[topRisk]} rounded-xl p-5 shadow-lg shadow-black/20
          hover:border-blue-500/40 cursor-pointer transition-all active:brightness-110"
          onclick="TEACHER.openCourse(${JSON.stringify(c).replace(/"/g, '&quot;')})">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-200 truncate">${UTILS.escapeHtml(c.courseName)}</p>
              <p class="text-xs text-slate-500 mt-0.5">${UTILS.escapeHtml(c.section)}</p>
            </div>
            <div class="flex items-center gap-4 shrink-0 text-sm">
              <div class="text-center">
                <p class="text-xs text-slate-500">นักเรียน</p>
                <p class="font-bold text-slate-300">${c.count} คน</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-slate-500">Avg Score</p>
                <p class="font-bold ${scoreColor(c.avgScore)}">${c.avgScore}</p>
              </div>
              <div class="flex gap-1 text-xs">
                ${c.high   > 0 ? `<span class="px-2 py-1 bg-red-950/50 text-red-400 border border-red-800/40 rounded-full">🔴 ${c.high}</span>` : ''}
                ${c.medium > 0 ? `<span class="px-2 py-1 bg-amber-950/50 text-amber-400 border border-amber-800/40 rounded-full">🟡 ${c.medium}</span>` : ''}
                ${c.low    > 0 ? `<span class="px-2 py-1 bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 rounded-full">🟢 ${c.low}</span>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  // ─── VIEW 2: Student List ────────────────────────────────────────────────
  async openCourse(course) {
    this._currentCourse = course;
    this.goTo('students');

    document.getElementById('bcCourseName').textContent   = course.courseName;
    document.getElementById('courseTitle').textContent    = course.courseName;
    document.getElementById('courseSection').textContent  = course.section;
    document.getElementById('kpiTotal').textContent        = course.count;
    document.getElementById('kpiHigh').textContent         = course.high;
    document.getElementById('kpiMedium').textContent       = course.medium;
    document.getElementById('kpiLow').textContent          = course.low;
    document.getElementById('kpiScoreText').textContent    = course.avgScore ?? '—';
    CHARTS.renderGauge('kpiScoreGauge', course.avgScore ?? 0);
    document.getElementById('studentList').innerHTML =
      `<p class="text-center text-slate-500 py-8">กำลังโหลด...</p>`;

    UTILS.showLoader('กำลังโหลดรายชื่อนักเรียน...');
    const res = await API.get('getCourseStudents', { courseId: course.courseId });
    UTILS.hideLoader();
    if (!res) return;

    this._allStudents = res.data;
    this.renderStudents(this._allStudents);
    this.bindSearch();
  },

  renderStudents(students) {
    const container = document.getElementById('studentList');
    if (!students.length) {
      container.innerHTML = `<p class="text-center text-slate-500 py-8">ไม่พบนักเรียน</p>`;
      return;
    }

    const borderAccent = { HIGH: 'border-l-red-500', MEDIUM: 'border-l-amber-500', LOW: 'border-l-emerald-500' };
    const scoreColor   = r => r==='HIGH'?'text-red-400':r==='MEDIUM'?'text-amber-400':'text-emerald-400';

    container.innerHTML = students.map(s => `
      <div class="card border-l-4 ${borderAccent[s.riskLevel] || 'border-l-slate-600'} rounded-xl p-4 shadow-lg shadow-black/20">
        <!-- Row 1: Avatar + Name + Score -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 shrink-0">
            ${UTILS.escapeHtml(s.fullName?.charAt(0))}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 truncate">${UTILS.escapeHtml(s.fullName)}</p>
            <p class="text-xs text-slate-500 truncate">${UTILS.escapeHtml(s.email)}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-lg ${scoreColor(s.riskLevel)}">${s.engagementScore ?? '—'}</p>
            <p class="text-xs text-slate-500">score</p>
          </div>
        </div>
        <!-- Row 2: Stats + Badge + Button -->
        <div class="flex items-center gap-3 mt-3" style="padding-left:52px">
          <span class="text-xs text-slate-500">ส่งงาน <span class="font-medium text-slate-300">${s.submissionRate ?? '—'}%</span></span>
          <span class="text-slate-700">|</span>
          ${UTILS.riskBadge(s.riskLevel)}
          <button onclick="TEACHER.openModal('${UTILS.escapeHtml(s.studentId)}')"
            class="ml-auto text-sm gradient-bg text-white px-4 py-1.5 rounded-lg hover:opacity-90 active:opacity-80 whitespace-nowrap transition-opacity">
            ติดตาม
          </button>
        </div>
      </div>
    `).join('');
  },

  bindSearch() {
    const input  = document.getElementById('searchInput');
    const filter = document.getElementById('riskFilter');
    input.value  = '';
    filter.value = '';
    const apply = () => {
      const kw   = input.value.toLowerCase();
      const risk = filter.value;
      this.renderStudents(this._allStudents.filter(s =>
        (!kw   || s.fullName?.toLowerCase().includes(kw)) &&
        (!risk || s.riskLevel === risk)
      ));
    };
    input.oninput    = apply;
    filter.onchange  = apply;
  },

  // ─── Export ─────────────────────────────────────────────────────────────
  exportStudents(format) {
    const students = this._allStudents;
    const course   = this._currentCourse;
    if (!students?.length) { UTILS.toast('ไม่มีข้อมูลนักเรียน', 'error'); return; }

    const courseName = course?.courseName || 'รายงาน';
    const dateStr    = new Date().toLocaleDateString('th-TH');
    const safeFile   = courseName.replace(/[\/\\:*?"<>|]/g, '_');
    const riskLabel  = { HIGH: 'เสี่ยงสูง', MEDIUM: 'เสี่ยงปานกลาง', LOW: 'ปกติ' };
    const riskColor  = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' };

    const headers = ['ลำดับ', 'ชื่อ', 'อีเมล', 'Engagement Score', 'ส่งงาน (%)', 'ระดับความเสี่ยง'];
    const rows = students.map((s, i) => [
      i + 1,
      s.fullName || '',
      s.email || '',
      s.engagementScore ?? '',
      s.submissionRate ?? '',
      riskLabel[s.riskLevel] || s.riskLevel || '',
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch:6 },{ wch:30 },{ wch:35 },{ wch:18 },{ wch:12 },{ wch:16 }];
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
    <th style="width:105px">ระดับความเสี่ยง</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },

  // ─── Risk Modal ──────────────────────────────────────────────────────────
  showRiskModal(riskLevel) {
    if (!this._allStudents.length) return;

    const titles = { HIGH: '🔴 นักเรียนเสี่ยงสูง', MEDIUM: '🟡 นักเรียนเสี่ยงปานกลาง', LOW: '🟢 นักเรียนปกติ', '': '👥 นักเรียนทั้งหมด' };
    document.getElementById('teacherRiskTitle').textContent = titles[riskLevel] ?? 'นักเรียน';
    document.getElementById('teacherRiskSearch').value      = '';
    document.getElementById('teacherRiskModal').classList.remove('hidden');

    const filtered = riskLevel
      ? this._allStudents.filter(s => s.riskLevel === riskLevel)
      : this._allStudents;

    this._renderRiskList(filtered);

    document.getElementById('teacherRiskSearch').oninput = (e) => {
      const kw = e.target.value.toLowerCase();
      const base = riskLevel ? this._allStudents.filter(s => s.riskLevel === riskLevel) : this._allStudents;
      this._renderRiskList(base.filter(s => s.fullName?.toLowerCase().includes(kw)));
    };
  },

  _renderRiskList(students) {
    const borderColor = { HIGH: 'border-red-800/40', MEDIUM: 'border-amber-800/40', LOW: 'border-emerald-800/40' };
    const bgColor     = { HIGH: 'bg-red-950/30',     MEDIUM: 'bg-amber-950/30',     LOW: 'bg-emerald-950/30' };
    const scoreColor  = r => r==='HIGH'?'text-red-400':r==='MEDIUM'?'text-amber-400':'text-emerald-400';

    document.getElementById('teacherRiskList').innerHTML = students.length
      ? students.map(s => `
        <div class="flex items-center gap-3 p-3 rounded-xl border ${borderColor[s.riskLevel] || 'border-slate-700/50'}
          ${bgColor[s.riskLevel] || 'bg-slate-800/50'} mb-2">
          <div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 shrink-0">
            ${UTILS.escapeHtml(s.fullName?.charAt(0))}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 text-sm truncate">${UTILS.escapeHtml(s.fullName)}</p>
            <p class="text-xs text-slate-500 truncate">${UTILS.escapeHtml(s.email || '')}</p>
          </div>
          <div class="text-right shrink-0 mr-2">
            <p class="font-bold text-sm ${scoreColor(s.riskLevel)}">${s.engagementScore ?? '—'}</p>
            <p class="text-xs text-slate-600">score</p>
          </div>
          ${UTILS.riskBadge(s.riskLevel)}
          <button onclick="TEACHER.closeRiskModal(); TEACHER.openModal('${UTILS.escapeHtml(s.studentId)}')"
            class="text-xs gradient-bg text-white px-3 py-1.5 rounded-lg hover:opacity-90 shrink-0 transition-opacity">
            ติดตาม
          </button>
        </div>`).join('')
      : `<p class="text-center text-slate-500 py-10">ไม่พบนักเรียน</p>`;
  },

  closeRiskModal() {
    document.getElementById('teacherRiskModal').classList.add('hidden');
  },

  // ─── Intervention Modal ──────────────────────────────────────────────────
  openModal(studentId) {
    document.getElementById('modalStudentId').value = studentId;

    // Pre-fill from recommendation
    const student = this._allStudents.find(s => String(s.studentId) === String(studentId));
    const recs    = student ? UTILS.recommend(student) : [];
    const topRec  = recs.find(r => r.method);   // first actionable recommendation

    document.getElementById('interventionMethod').value  = topRec?.method  || 'call';
    document.getElementById('interventionNote').value    = topRec?.note    || '';
    document.getElementById('interventionOutcome').value = 'in_progress';

    // Show recommendation hints inside modal
    const hintBox = document.getElementById('recHintBox');
    if (hintBox) {
      if (recs.length && recs[0].level !== 'good') {
        const methodLabel = {
          call: 'โทรหาผู้ปกครอง', email: 'ส่ง Email',
          visit: 'เยี่ยมบ้าน', meeting: 'พูดคุยที่โรงเรียน',
        };
        const levelColor = { urgent: 'bg-red-950/40 border-red-700/40 text-red-400', warning: 'bg-amber-950/40 border-amber-700/40 text-amber-400' };
        hintBox.innerHTML = recs.filter(r => r.method).map(r => `
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg border ${levelColor[r.level] || levelColor.warning} text-xs">
            <span>${r.icon}</span>
            <span class="flex-1">${r.reason}</span>
            <span class="font-semibold">→ ${methodLabel[r.method] || r.method}</span>
          </div>`).join('');
        hintBox.classList.remove('hidden');
      } else {
        hintBox.classList.add('hidden');
      }
    }

    document.getElementById('interventionModal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('interventionModal').classList.add('hidden');
  },

  async saveIntervention() {
    const studentId = document.getElementById('modalStudentId').value;
    const method    = document.getElementById('interventionMethod').value;
    const note      = document.getElementById('interventionNote').value.trim();
    const outcome   = document.getElementById('interventionOutcome').value;

    const res = await API.post('logIntervention', {
      studentId,
      teacherId: this._user.email,
      method, note, outcome,
    });

    this.closeModal();
    UTILS.toast(res ? '✅ บันทึกการติดตามเรียบร้อย' : '❌ บันทึกไม่สำเร็จ', res ? 'success' : 'error');
  },
};
