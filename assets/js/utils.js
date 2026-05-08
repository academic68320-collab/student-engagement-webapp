const UTILS = {

  _loaderEl: null,

  showLoader(text = 'กำลังโหลดข้อมูล...') {
    if (this._loaderEl) { this._loaderEl.querySelector('p').textContent = text; return; }
    const el = document.createElement('div');
    el.id = 'pageLoader';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 40%,#0369a1 70%,#0e7490 100%);
      transition:opacity .4s ease;
    `;
    el.innerHTML = `
      <div style="text-align:center">
        <div style="width:72px;height:72px;background:rgba(255,255,255,0.15);border-radius:20px;
          display:flex;align-items:center;justify-content:center;font-size:32px;
          margin:0 auto 20px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">🎓</div>
        <div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.2);
          border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px"></div>
        <p style="color:rgba(255,255,255,0.9);font-family:Sarabun,sans-serif;font-size:15px;font-weight:600"></p>
        <p style="color:rgba(255,255,255,0.45);font-family:Sarabun,sans-serif;font-size:12px;margin-top:6px">
          Student Engagement Intelligence System</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    el.querySelector('p').textContent = text;
    document.body.appendChild(el);
    this._loaderEl = el;
  },

  hideLoader() {
    if (!this._loaderEl) return;
    this._loaderEl.style.opacity = '0';
    setTimeout(() => { this._loaderEl?.remove(); this._loaderEl = null; }, 400);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  toast(message, type = 'success') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3B82F6' };
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.background = colors[type] || colors.info;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  },

  riskBadge(level) {
    const map = {
      HIGH:   '<span class="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">🔴 เสี่ยงสูง</span>',
      MEDIUM: '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">🟡 เสี่ยงปานกลาง</span>',
      LOW:    '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">🟢 ปกติ</span>',
    };
    return map[level] || '—';
  },

  // ─── Recommendation Engine ────────────────────────────────────────────────
  // Returns array of { level, icon, reason, method, note }
  // level: 'urgent' | 'warning' | 'good'
  recommend(student) {
    const sub     = Number(student.submissionRate ?? 100);
    const act     = Number(student.activityScore  ?? 100);
    const days    = Number(student.activeDays     ?? 30);
    const score   = Number(student.engagementScore ?? 0);
    const history = student.history || [];
    const results = [];

    // ── Rule 1: Submission rate ─────────────────────────────────────────────
    if (sub < 30) {
      results.push({
        level: 'urgent', icon: '📵',
        reason: `ส่งงานเพียง ${sub}% — ต่ำกว่าเกณฑ์วิกฤต`,
        method: 'call',
        note: `นักเรียนส่งงานเพียง ${sub}% ควรติดต่อผู้ปกครองโดยด่วน เพื่อหาสาเหตุที่ไม่ส่งงาน`,
      });
    } else if (sub < 60) {
      results.push({
        level: 'warning', icon: '📋',
        reason: `ส่งงาน ${sub}% — ต่ำกว่าเกณฑ์`,
        method: 'meeting',
        note: `นักเรียนส่งงาน ${sub}% ซึ่งต่ำกว่าเกณฑ์ แนะนำพูดคุยส่วนตัวเพื่อหาสาเหตุและให้กำลังใจ`,
      });
    }

    // ── Rule 2: Active days ─────────────────────────────────────────────────
    if (days < 3) {
      results.push({
        level: 'urgent', icon: '🏫',
        reason: `เข้าเรียนเพียง ${days} วัน — เกือบขาดเรียนทั้งหมด`,
        method: 'visit',
        note: `นักเรียนมี active days เพียง ${days} วัน แนะนำเยี่ยมบ้านหรือโทรหาผู้ปกครองทันที`,
      });
    } else if (days < 8) {
      results.push({
        level: 'warning', icon: '📅',
        reason: `Active days ${days} วัน — เข้าเรียนไม่สม่ำเสมอ`,
        method: 'meeting',
        note: `นักเรียนเข้าเรียนไม่สม่ำเสมอ (${days} วัน) แนะนำพูดคุยเพื่อสำรวจปัญหา`,
      });
    }

    // ── Rule 3: Declining trend 3+ weeks ──────────────────────────────────
    if (history.length >= 3) {
      const recent = history.slice(-3).map(h => Number(h.engagementScore || 0));
      const dropping = recent[0] > recent[1] && recent[1] > recent[2];
      const drop = recent[0] - recent[2];
      if (dropping && drop >= 10) {
        results.push({
          level: 'warning', icon: '📉',
          reason: `Score ลดติดต่อกัน 3 สัปดาห์ (ลด ${drop} คะแนน)`,
          method: 'email',
          note: `Engagement score ลดลงต่อเนื่อง 3 สัปดาห์ จาก ${recent[0]} → ${recent[2]} แนะนำส่ง Email แจ้งผู้ปกครอง`,
        });
      }
    }

    // ── Rule 4: Low activity score ─────────────────────────────────────────
    if (act < 20 && !results.some(r => r.method === 'meeting')) {
      results.push({
        level: 'warning', icon: '💤',
        reason: `Activity score ${act}% — แทบไม่ทำกิจกรรม`,
        method: 'meeting',
        note: `นักเรียนมี activity score เพียง ${act}% แนะนำพูดคุยส่วนตัวเพื่อสร้างแรงจูงใจ`,
      });
    }

    // ── Rule 5: All good ───────────────────────────────────────────────────
    if (!results.length) {
      results.push({
        level: 'good', icon: '✅',
        reason: score >= 70
          ? `Engagement score ${score} — อยู่ในเกณฑ์ดี ไม่จำเป็นต้องติดตามพิเศษ`
          : `ยังไม่มีสัญญาณเตือนที่ชัดเจน — ติดตามต่อเนื่องตามปกติ`,
        method: null,
        note: null,
      });
    }

    return results;
  },
};
