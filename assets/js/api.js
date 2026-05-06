const API_URL = 'https://script.google.com/macros/s/AKfycbwGV9aZAuumM7cKKZ9NQxeIV1VunjoV1ZxxWKZnu8TpDUsQ1hXEG3k5c8Yq1cUoGTXZ/exec';

const API = {

  async get(action, params = {}) {
    const user  = AUTH.getSession();
    const query = new URLSearchParams({
      action,
      email: user?.email || '',
      ...params,
    });

    try {
      const res  = await fetch(`${API_URL}?${query}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error(`[API GET] ${action}:`, err.message);
      return null;
    }
  },

  async post(action, body = {}) {
    const user = AUTH.getSession();
    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ action, email: user?.email || '', ...body }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error(`[API POST] ${action}:`, err.message);
      return null;
    }
  },
};
