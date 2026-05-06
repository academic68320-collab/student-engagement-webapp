const AUTH = {

  decodeJWT(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  },

  saveSession(userData) {
    sessionStorage.setItem('user', JSON.stringify(userData));
  },

  getSession() {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },

  logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  },

  requireAuth() {
    const user = this.getSession();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
  },
};

window.handleCredentialResponse = async function handleCredentialResponse(response) {
  const userData = AUTH.decodeJWT(response.credential);

  const allowedDomains = ['feu.ac.th', 'feu.edu'];
  if (!allowedDomains.some(d => userData.email.endsWith(`@${d}`))) {
    alert('กรุณาใช้ Email ของโรงเรียนเท่านั้น');
    return;
  }

  const role = await API.get('getUserRole', { email: userData.email });

  AUTH.saveSession({
    email:   userData.email,
    name:    userData.name,
    picture: userData.picture,
    role:    role?.data || 'teacher',
    token:   response.credential,
  });

  const redirectMap = {
    admin:     'dashboard.html',
    executive: 'dashboard.html',
    teacher:   'teacher.html',
  };
  window.location.href = redirectMap[role?.data] || 'teacher.html';
}
