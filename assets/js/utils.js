const UTILS = {

  _loaderEl: null,

  showLoader(text = 'กำลังโหลดข้อมูล...') {
    if (this._loaderEl) { this._loaderEl.querySelector('p').textContent = text; return; }
    const el = document.createElement('div');
    el.id = 'pageLoader';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center;
      background:rgba(8,15,30,0.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
      transition:opacity .3s ease;
    `;
    el.innerHTML = `
      <div style="
        background:rgba(15,23,42,0.92); border:1px solid rgba(51,65,85,0.6);
        border-radius:20px; padding:36px 48px; text-align:center;
        box-shadow:0 24px 64px rgba(0,0,0,0.5); min-width:220px;
      ">
        <div style="width:56px;height:56px;border:3px solid rgba(59,130,246,0.25);
          border-top-color:#3b82f6;border-radius:50%;animation:spin .75s linear infinite;
          margin:0 auto 20px"></div>
        <p style="color:#e2e8f0;font-family:Sarabun,sans-serif;font-size:15px;font-weight:600;margin:0 0 6px"></p>
        <p style="color:#475569;font-family:Sarabun,sans-serif;font-size:11px;margin:0">
          Student Engagement System</p>
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

  apiError(containerId, retryFn) {
    const el = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    if (!el) return;
    el.innerHTML = `
      <div style="text-align:center;padding:48px 24px">
        <div style="font-size:36px;margin-bottom:12px">⚠️</div>
        <p style="color:#f87171;font-weight:600;font-size:15px;margin:0 0 6px">เชื่อมต่อ API ไม่สำเร็จ</p>
        <p style="color:#475569;font-size:12px;margin:0 0 20px">ตรวจสอบการเชื่อมต่อหรือ Apps Script URL</p>
        ${retryFn ? `<button onclick="(${retryFn.toString()})()"
          style="background:#1d4ed8;color:#fff;border:none;padding:8px 20px;
          border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun,sans-serif">
          🔄 ลองใหม่
        </button>` : ''}
      </div>`;
  },

  setAvatar(imgEl, url, name) {
    if (!imgEl) return;
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="16" fill="#1d4ed8"/>
        <text x="16" y="21" text-anchor="middle" font-size="14" font-weight="600"
          font-family="Sarabun,sans-serif" fill="white">${initial}</text>
      </svg>`
    )}`;
    imgEl.onerror = () => { imgEl.src = fallbackSvg; imgEl.onerror = null; };
    imgEl.src = url || fallbackSvg;
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
    const cfg     = (typeof CONFIG !== 'undefined') ? CONFIG.get() : {};
    const subU    = cfg.subUrgent   ?? 30;
    const subW    = cfg.subWarning  ?? 60;
    const dayU    = cfg.daysUrgent  ?? 3;
    const dayW    = cfg.daysWarning ?? 8;
    const actW    = cfg.actWarning  ?? 20;
    const trend   = cfg.trendDrop   ?? 10;
    const lowMin  = cfg.mediumMax   ?? 70;

    const sub     = Number(student.submissionRate ?? 100);
    const act     = Number(student.activityScore  ?? 100);
    const days    = Number(student.activeDays     ?? 30);
    const score   = Number(student.engagementScore ?? 0);
    const history = student.history || [];
    const results = [];

    // ── Rule 1: Submission rate ─────────────────────────────────────────────
    if (sub < subU) {
      results.push({
        level: 'urgent', icon: '📵',
        reason: `ส่งงานเพียง ${sub}% — ต่ำกว่าเกณฑ์วิกฤต (${subU}%)`,
        method: 'call',
        note: `นักเรียนส่งงานเพียง ${sub}% ควรติดต่อผู้ปกครองโดยด่วน เพื่อหาสาเหตุที่ไม่ส่งงาน`,
      });
    } else if (sub < subW) {
      results.push({
        level: 'warning', icon: '📋',
        reason: `ส่งงาน ${sub}% — ต่ำกว่าเกณฑ์ (${subW}%)`,
        method: 'meeting',
        note: `นักเรียนส่งงาน ${sub}% ซึ่งต่ำกว่าเกณฑ์ แนะนำพูดคุยส่วนตัวเพื่อหาสาเหตุและให้กำลังใจ`,
      });
    }

    // ── Rule 2: Active days ─────────────────────────────────────────────────
    if (days < dayU) {
      results.push({
        level: 'urgent', icon: '🏫',
        reason: `เข้าเรียนเพียง ${days} วัน — เกือบขาดเรียนทั้งหมด (เกณฑ์ ${dayU} วัน)`,
        method: 'visit',
        note: `นักเรียนมี active days เพียง ${days} วัน แนะนำเยี่ยมบ้านหรือโทรหาผู้ปกครองทันที`,
      });
    } else if (days < dayW) {
      results.push({
        level: 'warning', icon: '📅',
        reason: `Active days ${days} วัน — เข้าเรียนไม่สม่ำเสมอ (เกณฑ์ ${dayW} วัน)`,
        method: 'meeting',
        note: `นักเรียนเข้าเรียนไม่สม่ำเสมอ (${days} วัน) แนะนำพูดคุยเพื่อสำรวจปัญหา`,
      });
    }

    // ── Rule 3: Declining trend 3+ weeks ──────────────────────────────────
    if (history.length >= 3) {
      const recent   = history.slice(-3).map(h => Number(h.engagementScore || 0));
      const dropping = recent[0] > recent[1] && recent[1] > recent[2];
      const drop     = recent[0] - recent[2];
      if (dropping && drop >= trend) {
        results.push({
          level: 'warning', icon: '📉',
          reason: `Score ลดติดต่อกัน 3 สัปดาห์ (ลด ${drop} คะแนน, เกณฑ์ ${trend})`,
          method: 'email',
          note: `Engagement score ลดลงต่อเนื่อง 3 สัปดาห์ จาก ${recent[0]} → ${recent[2]} แนะนำส่ง Email แจ้งผู้ปกครอง`,
        });
      }
    }

    // ── Rule 4: Low activity score ─────────────────────────────────────────
    if (act < actW && !results.some(r => r.method === 'meeting')) {
      results.push({
        level: 'warning', icon: '💤',
        reason: `Activity score ${act}% — แทบไม่ทำกิจกรรม (เกณฑ์ ${actW}%)`,
        method: 'meeting',
        note: `นักเรียนมี activity score เพียง ${act}% แนะนำพูดคุยส่วนตัวเพื่อสร้างแรงจูงใจ`,
      });
    }

    // ── Rule 5: All good ───────────────────────────────────────────────────
    if (!results.length) {
      results.push({
        level: 'good', icon: '✅',
        reason: score >= lowMin
          ? `Engagement score ${score} — อยู่ในเกณฑ์ดี ไม่จำเป็นต้องติดตามพิเศษ`
          : `ยังไม่มีสัญญาณเตือนที่ชัดเจน — ติดตามต่อเนื่องตามปกติ`,
        method: null,
        note: null,
      });
    }

    return results;
  },
};
