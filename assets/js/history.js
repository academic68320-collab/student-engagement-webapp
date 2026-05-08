const HISTORY = {

  _all:     [],  // raw data from API
  _courses: [],  // for course filter dropdown

  _methodLabel:  { call:'📞 โทรศัพท์', email:'📧 อีเมล', visit:'🏠 เยี่ยมบ้าน', meeting:'💬 พูดคุย', other:'อื่นๆ' },
  _outcomeLabel: { in_progress:'⏳ กำลังดำเนินการ', resolved:'✅ แก้ไขแล้ว', no_response:'❌ ไม่มีการตอบสนอง' },
  _outcomeColor: { in_progress:'text-amber-400', resolved:'text-emerald-400', no_response:'text-red-400' },
  _outcomeBg:    { in_progress:'bg-amber-950/30 border-amber-800/40', resolved:'bg-emerald-950/30 border-emerald-800/40', no_response:'bg-red-950/30 border-red-800/40' },

  // ─── Init ────────────────────────────────────────────────────────────────
  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    document.getElementById('teacherName').textContent = UTILS.escapeHtml(user.name);
    UTILS.showLoader('กำลังโหลดประวัติการติดตาม...');

    await Promise.all([
      this._loadInterventions(user.email),
      this._loadCourses(user.email),
    ]);

    UTILS.hideLoader();
  },

  // ─── Load Data ───────────────────────────────────────────────────────────
  async _loadInterventions(email) {
    const res = await API.get('getTeacherInterventions', { teacherEmail: email });
    if (!res) {
      UTILS.apiError('historyError', () => HISTORY.init());
      document.getElementById('historyList').classList.add('hidden');
      document.getElementById('historyError').classList.remove('hidden');
      return;
    }

    this._all = res.data || [];
    this._updateStats(this._all);
    this._render(this._all);

    const sub = `พบ ${this._all.length} รายการ`;
    document.getElementById('headerSub').textContent = sub;
  },

  async _loadCourses(email) {
    const res = await API.get('getTeacherCourses', { teacherEmail: email });
    if (!res) return;

    this._courses = res.data || [];
    const sel = document.getElementById('filterCourse');
    this._courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value       = c.courseId;
      opt.textContent = c.courseName;
      sel.appendChild(opt);
    });
  },

  // ─── Stats ───────────────────────────────────────────────────────────────
  _updateStats(data) {
    document.getElementById('statTotal').textContent      = data.length;
    document.getElementById('statResolved').textContent   = data.filter(i => i.outcome === 'resolved').length;
    document.getElementById('statInProgress').textContent = data.filter(i => i.outcome === 'in_progress').length;
    document.getElementById('statNoResponse').textContent = data.filter(i => i.outcome === 'no_response').length;
  },

  // ─── Filter ──────────────────────────────────────────────────────────────
  applyFilter() {
    const course  = document.getElementById('filterCourse').value;
    const method  = document.getElementById('filterMethod').value;
    const outcome = document.getElementById('filterOutcome').value;
    const kw      = document.getElementById('filterSearch').value.toLowerCase();

    const filtered = this._all.filter(i =>
      (!course  || String(i.courseId) === String(course)) &&
      (!method  || i.method  === method) &&
      (!outcome || i.outcome === outcome) &&
      (!kw      || (i.fullName || '').toLowerCase().includes(kw))
    );

    this._updateStats(filtered);
    this._render(filtered);
    document.getElementById('resultCount').textContent =
      filtered.length !== this._all.length
        ? `แสดง ${filtered.length} จาก ${this._all.length} รายการ`
        : `ทั้งหมด ${this._all.length} รายการ`;
  },

  resetFilter() {
    document.getElementById('filterCourse').value  = '';
    document.getElementById('filterMethod').value  = '';
    document.getElementById('filterOutcome').value = '';
    document.getElementById('filterSearch').value  = '';
    this.applyFilter();
  },

  // ─── Render ──────────────────────────────────────────────────────────────
  _render(data) {
    const list  = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');

    if (!data.length) {
      list.innerHTML = '';
      list.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');

    list.innerHTML = data.map(i => {
      const initial    = (i.fullName || '?').charAt(0).toUpperCase();
      const dateStr    = UTILS.formatDate(i.createdAt);
      const methodLbl  = this._methodLabel[i.method]  || i.method  || '—';
      const outcomeLbl = this._outcomeLabel[i.outcome] || i.outcome || '—';
      const outcomeCol = this._outcomeColor[i.outcome] || 'text-slate-400';
      const outcomeBg  = this._outcomeBg[i.outcome]   || 'bg-slate-800/50 border-slate-700/50';

      return `
        <div class="card rounded-xl p-5 row-hover transition-colors">
          <div class="flex items-start gap-4">
            <!-- Avatar -->
            <div class="w-10 h-10 rounded-full gradient-bg flex items-center justify-center font-bold text-white shrink-0 shadow shadow-blue-900/40 text-sm">
              ${UTILS.escapeHtml(initial)}
            </div>
            <!-- Main -->
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <p class="font-semibold text-slate-200">${UTILS.escapeHtml(i.fullName || '—')}</p>
                <span class="text-slate-600 text-xs hidden sm:inline">•</span>
                <p class="text-xs text-slate-500 truncate">${UTILS.escapeHtml(i.courseName || '—')}</p>
              </div>
              ${i.note ? `<p class="text-sm text-slate-400 mt-1 leading-relaxed">${UTILS.escapeHtml(i.note)}</p>` : ''}
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <span class="text-xs px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-800/40 text-blue-300">
                  ${methodLbl}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full border ${outcomeBg} ${outcomeCol}">
                  ${outcomeLbl}
                </span>
              </div>
            </div>
            <!-- Date -->
            <div class="text-right shrink-0">
              <p class="text-xs text-slate-500">${dateStr}</p>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  // ─── Export ──────────────────────────────────────────────────────────────
  exportExcel() {
    const course  = document.getElementById('filterCourse').value;
    const method  = document.getElementById('filterMethod').value;
    const outcome = document.getElementById('filterOutcome').value;
    const kw      = document.getElementById('filterSearch').value.toLowerCase();

    const data = this._all.filter(i =>
      (!course  || String(i.courseId) === String(course)) &&
      (!method  || i.method  === method) &&
      (!outcome || i.outcome === outcome) &&
      (!kw      || (i.fullName || '').toLowerCase().includes(kw))
    );

    if (!data.length) { UTILS.toast('ไม่มีข้อมูลสำหรับ Export', 'error'); return; }

    const headers = ['วันที่', 'ชื่อนักเรียน', 'วิชา', 'วิธีการ', 'บันทึก', 'ผลลัพธ์'];
    const rows = data.map(i => [
      UTILS.formatDate(i.createdAt),
      i.fullName  || '',
      i.courseName || '',
      this._methodLabel[i.method]   || i.method  || '',
      i.note      || '',
      this._outcomeLabel[i.outcome] || i.outcome || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch:18 },{ wch:28 },{ wch:35 },{ wch:16 },{ wch:50 },{ wch:20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ประวัติการติดตาม');
    XLSX.writeFile(wb, `intervention_history_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
    UTILS.toast('✅ Export Excel สำเร็จ', 'success');
  },
};
