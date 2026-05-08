const CONFIG = {

  _KEY: 'gce_config',

  _defaults: {
    // ─── Risk Thresholds ──────────────────────────────────────────────────
    highMax:    40,   // HIGH   if score < highMax
    mediumMax:  70,   // MEDIUM if highMax <= score < mediumMax; LOW if >= mediumMax

    // ─── Weight Factors (must sum to 100) ────────────────────────────────
    wSubmission: 50,  // % weight for submission rate
    wActivity:   30,  // % weight for activity score
    wActiveDays: 20,  // % weight for active days / 30 * 100

    // ─── Recommendation Rule Thresholds ───────────────────────────────────
    subUrgent:   30,  // submission rate % — urgent (call) if below
    subWarning:  60,  // submission rate % — warning (meeting) if below
    daysUrgent:  3,   // active days — urgent (visit) if below
    daysWarning: 8,   // active days — warning (meeting) if below
    actWarning:  20,  // activity score % — warning (meeting) if below
    trendDrop:   10,  // score drop over 3 weeks — warning (email) if >= this
  },

  get() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._KEY) || '{}');
      return { ...this._defaults, ...saved };
    } catch {
      return { ...this._defaults };
    }
  },

  save(cfg) {
    localStorage.setItem(this._KEY, JSON.stringify(cfg));
  },

  reset() {
    localStorage.removeItem(this._KEY);
  },
};
