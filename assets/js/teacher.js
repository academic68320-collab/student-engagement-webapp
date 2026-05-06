const TEACHER = {
  allStudents: [],

  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    document.getElementById('teacherName').textContent = UTILS.escapeHtml(user.name);
    await this.loadStudents(user.email);
    this.bindSearch();
  },

  async loadStudents(teacherEmail) {
    const res = await API.get('getMyStudents', { teacherEmail });
    if (!res) return;
    this.allStudents = res.data;
    this.renderStudents(this.allStudents);
  },

  renderStudents(students) {
    const container = document.getElementById('studentList');
    if (students.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-400 py-8">ไม่พบนักเรียน</p>`;
      return;
    }

    const borderColor = { HIGH: 'border-red-200', MEDIUM: 'border-yellow-200', LOW: 'border-green-200' };

    container.innerHTML = students.map(s => `
      <div class="bg-white border ${borderColor[s.riskLevel] || 'border-gray-200'} rounded-xl p-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0">
            ${UTILS.escapeHtml(s.fullName?.charAt(0))}
          </div>
          <div class="min-w-0">
            <p class="font-medium text-gray-800 truncate">${UTILS.escapeHtml(s.fullName)}</p>
            <p class="text-xs text-gray-400 truncate">${UTILS.escapeHtml(s.email)}</p>
          </div>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <div class="text-center hidden sm:block">
            <p class="text-xs text-gray-400">Score</p>
            <p class="font-bold">${s.engagementScore ?? '—'}/100</p>
          </div>
          <div class="text-center hidden sm:block">
            <p class="text-xs text-gray-400">ส่งงาน</p>
            <p class="font-medium">${s.submissionRate ?? '—'}%</p>
          </div>
          ${UTILS.riskBadge(s.riskLevel)}
          <button onclick="TEACHER.openModal('${UTILS.escapeHtml(s.studentId)}')"
            class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap">
            ติดตาม
          </button>
        </div>
      </div>
    `).join('');
  },

  bindSearch() {
    const input  = document.getElementById('searchInput');
    const filter = document.getElementById('riskFilter');

    const apply = () => {
      const keyword   = input.value.toLowerCase();
      const riskLevel = filter.value;
      this.renderStudents(
        this.allStudents.filter(s =>
          (!keyword   || s.fullName?.toLowerCase().includes(keyword)) &&
          (!riskLevel || s.riskLevel === riskLevel)
        )
      );
    };

    input.addEventListener('input', apply);
    filter.addEventListener('change', apply);
  },

  openModal(studentId) {
    document.getElementById('modalStudentId').value    = studentId;
    document.getElementById('interventionNote').value  = '';
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
    const user      = AUTH.getSession();

    const res = await API.post('logIntervention', {
      studentId,
      teacherId: user.email,
      method,
      note,
      outcome,
    });

    this.closeModal();
    UTILS.toast(res ? '✅ บันทึกการติดตามเรียบร้อย' : '❌ บันทึกไม่สำเร็จ', res ? 'success' : 'error');
  },
};

document.addEventListener('DOMContentLoaded', () => TEACHER.init());
