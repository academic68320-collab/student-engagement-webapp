const UTILS = {

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
};
