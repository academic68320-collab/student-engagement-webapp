# 💻 Web App Coding Guide — Student Engagement Intelligence System
## Stack: HTML + Vanilla JS + Tailwind CDN / Google Apps Script API / GitHub Pages

---

## 📁 Project Structure

```
student-engagement-webapp/
│
├── index.html               ← Login Page (Google OAuth)
├── dashboard.html           ← Executive Dashboard
├── teacher.html             ← Teacher Dashboard
├── student.html             ← Student Dashboard (Optional)
│
├── assets/
│   ├── css/
│   │   └── style.css        ← Custom CSS (นอกเหนือ Tailwind)
│   └── js/
│       ├── auth.js          ← Google OAuth Login
│       ├── api.js           ← Fetch wrapper (เรียก Apps Script API)
│       ├── dashboard.js     ← Executive Dashboard logic
│       ├── teacher.js       ← Teacher Dashboard logic
│       ├── charts.js        ← Chart.js rendering
│       └── utils.js         ← Helper functions
│
├── backend/                 ← Google Apps Script (แยก deploy ต่างหาก)
│   ├── Code.gs
│   ├── Config.gs
│   ├── Database.gs
│   ├── DataSync.gs
│   ├── EngagementEngine.gs
│   ├── RiskDetection.gs
│   ├── Notification.gs
│   ├── TeacherAction.gs
│   ├── Scheduler.gs
│   └── WebApp.gs            ← REST API endpoint
│
└── README.md
```

---

## ⚙️ Setup & Deploy

### 1. Backend — Google Apps Script

```
1. ไปที่ script.google.com → New Project
2. Copy โค้ดจากโฟลเดอร์ backend/ ทั้งหมด
3. Deploy → New Deployment → Web App
   - Execute as: Me
   - Who has access: Anyone (สำหรับ Google OAuth แบบ domain)
4. Copy "Web App URL" ไว้ใส่ api.js
```

### 2. Frontend — GitHub Pages

```
1. สร้าง GitHub Repo ชื่อ student-engagement-webapp
2. Push โค้ดทั้งหมดขึ้น
3. Settings → Pages → Branch: main → Save
4. เว็บจะ live ที่ https://username.github.io/student-engagement-webapp
```

---

## 🔐 Google OAuth Setup

### 1. สร้าง OAuth Client ID

```
1. ไปที่ console.cloud.google.com
2. APIs & Services → Credentials
3. Create Credentials → OAuth Client ID
   - Application type: Web application
   - Authorized JavaScript origins: https://username.github.io
4. Copy Client ID ไว้ใส่ auth.js
```

---

## 📄 index.html — Login Page

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Student Engagement System — Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center font-sarabun">

  <div class="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">

    <!-- Logo -->
    <div class="mb-6">
      <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span class="text-white text-2xl">🎓</span>
      </div>
      <h1 class="text-2xl font-bold text-gray-800">Student Engagement</h1>
      <p class="text-gray-500 text-sm mt-1">Intelligence System</p>
    </div>

    <!-- Google Sign In Button -->
    <div id="g_id_onload"
      data-client_id="YOUR_GOOGLE_CLIENT_ID"
      data-callback="handleCredentialResponse"
      data-auto_prompt="false">
    </div>

    <div class="g_id_signin"
      data-type="standard"
      data-size="large"
      data-theme="outline"
      data-text="signin_with"
      data-shape="rectangular"
      data-logo_alignment="left"
      data-width="320">
    </div>

    <p class="text-xs text-gray-400 mt-6">
      เข้าสู่ระบบด้วย Google Account ของโรงเรียนเท่านั้น
    </p>
  </div>

  <script src="assets/js/auth.js"></script>
</body>
</html>
```

---

## 📄 assets/js/auth.js

```javascript
// ==========================================
// auth.js — Google OAuth Handler
// ==========================================

const AUTH = {
  // Decode JWT token จาก Google
  decodeJWT(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  },

  // บันทึก session ลง sessionStorage
  saveSession(userData) {
    sessionStorage.setItem('user', JSON.stringify(userData));
  },

  // ดึง session
  getSession() {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // ออกจากระบบ
  logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  },

  // ตรวจสอบว่า Login อยู่ไหม (เรียกใน page ที่ต้อง login)
  requireAuth() {
    const user = this.getSession();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },
};

// Callback จาก Google Sign-In
async function handleCredentialResponse(response) {
  const userData = AUTH.decodeJWT(response.credential);

  // ตรวจสอบ Domain (เฉพาะ email โรงเรียน)
  const allowedDomain = 'school.ac.th'; // เปลี่ยนเป็น domain โรงเรียน
  if (!userData.email.endsWith(`@${allowedDomain}`)) {
    alert('กรุณาใช้ Email ของโรงเรียนเท่านั้น');
    return;
  }

  // ดึง Role จาก Backend
  const role = await API.get('getUserRole', { email: userData.email });

  AUTH.saveSession({
    email:    userData.email,
    name:     userData.name,
    picture:  userData.picture,
    role:     role?.data || 'teacher',
    token:    response.credential,
  });

  // Redirect ตาม Role
  const redirectMap = {
    admin:     'dashboard.html',
    executive: 'dashboard.html',
    teacher:   'teacher.html',
  };

  window.location.href = redirectMap[role?.data] || 'teacher.html';
}
```

---

## 📄 assets/js/api.js

```javascript
// ==========================================
// api.js — Fetch Wrapper สำหรับ Apps Script API
// ==========================================

const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL'; // ใส่ URL จาก Apps Script Deploy

const API = {

  /**
   * GET request
   * @param {string} action
   * @param {Object} params
   */
  async get(action, params = {}) {
    const user = AUTH.getSession();
    const query = new URLSearchParams({
      action,
      email: user?.email || '',
      token: user?.token || '',
      ...params,
    });

    try {
      const res  = await fetch(`${API_URL}?${query}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error(`API Error [${action}]:`, err);
      return null;
    }
  },

  /**
   * POST request
   * @param {string} action
   * @param {Object} body
   */
  async post(action, body = {}) {
    const user = AUTH.getSession();

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script ต้องการ text/plain
        body:    JSON.stringify({
          action,
          email: user?.email || '',
          token: user?.token || '',
          ...body,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error(`API POST Error [${action}]:`, err);
      return null;
    }
  },
};
```

---

## 📄 dashboard.html — Executive Dashboard

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Student Engagement System</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-gray-50 font-sarabun">

  <!-- Navbar -->
  <nav class="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span class="text-white text-sm">🎓</span>
      </div>
      <span class="font-bold text-gray-800">Student Engagement System</span>
    </div>
    <div class="flex items-center gap-4">
      <img id="userAvatar" class="w-8 h-8 rounded-full" src="" alt="">
      <span id="userName" class="text-sm text-gray-600"></span>
      <button onclick="AUTH.logout()"
        class="text-sm text-red-500 hover:text-red-700">ออกจากระบบ</button>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-6 py-8">

    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">ภาพรวมโรงเรียน</h1>
      <p id="lastUpdated" class="text-sm text-gray-400 mt-1"></p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500">นักเรียนทั้งหมด</p>
        <p id="totalStudents" class="text-3xl font-bold text-gray-800 mt-2">—</p>
      </div>
      <div class="bg-red-50 rounded-xl p-6 shadow-sm border border-red-100">
        <p class="text-sm text-red-500">🔴 เสี่ยงสูง</p>
        <p id="highRisk" class="text-3xl font-bold text-red-600 mt-2">—</p>
      </div>
      <div class="bg-yellow-50 rounded-xl p-6 shadow-sm border border-yellow-100">
        <p class="text-sm text-yellow-600">🟡 เสี่ยงปานกลาง</p>
        <p id="mediumRisk" class="text-3xl font-bold text-yellow-600 mt-2">—</p>
      </div>
      <div class="bg-green-50 rounded-xl p-6 shadow-sm border border-green-100">
        <p class="text-sm text-green-600">🟢 ปกติ</p>
        <p id="lowRisk" class="text-3xl font-bold text-green-600 mt-2">—</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <h2 class="font-semibold text-gray-700 mb-4">สัดส่วนนักเรียนตามระดับความเสี่ยง</h2>
        <canvas id="riskPieChart" height="200"></canvas>
      </div>
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <h2 class="font-semibold text-gray-700 mb-4">แนวโน้ม Engagement Score (4 สัปดาห์)</h2>
        <canvas id="trendLineChart" height="200"></canvas>
      </div>
    </div>

    <!-- High Risk Table -->
    <div class="bg-white rounded-xl shadow-sm">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-700">นักเรียนเสี่ยงสูง (ต้องติดตามด่วน)</h2>
        <button onclick="DASHBOARD.syncNow()"
          class="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          🔄 Sync ข้อมูล
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">ชื่อ</th>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">ห้อง</th>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">Score</th>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">ส่งงาน</th>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">Active Days</th>
              <th class="text-left px-6 py-3 text-xs text-gray-500 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody id="highRiskTable">
            <tr><td colspan="6" class="text-center py-8 text-gray-400">กำลังโหลด...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <script src="assets/js/auth.js"></script>
  <script src="assets/js/api.js"></script>
  <script src="assets/js/charts.js"></script>
  <script src="assets/js/dashboard.js"></script>
</body>
</html>
```

---

## 📄 assets/js/dashboard.js

```javascript
// ==========================================
// dashboard.js — Executive Dashboard Logic
// ==========================================

const DASHBOARD = {

  async init() {
    // ตรวจสอบ Auth
    const user = AUTH.requireAuth();
    if (!user) return;

    // แสดงข้อมูล User
    document.getElementById('userName').textContent    = user.name;
    document.getElementById('userAvatar').src          = user.picture;
    document.getElementById('lastUpdated').textContent =
      `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;

    // โหลดข้อมูลทั้งหมด
    await Promise.all([
      this.loadSummary(),
      this.loadHighRiskTable(),
    ]);
  },

  async loadSummary() {
    const res = await API.get('getSummary');
    if (!res) return;

    const { total, high, medium, low, trend } = res.data;

    document.getElementById('totalStudents').textContent = total;
    document.getElementById('highRisk').textContent      = high;
    document.getElementById('mediumRisk').textContent    = medium;
    document.getElementById('lowRisk').textContent       = low;

    CHARTS.renderPie('riskPieChart', { high, medium, low });
    CHARTS.renderTrend('trendLineChart', trend);
  },

  async loadHighRiskTable() {
    const res = await API.get('getScores', { riskLevel: 'HIGH' });
    if (!res) return;

    const tbody = document.getElementById('highRiskTable');

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-green-500">
        ✅ ไม่มีนักเรียนเสี่ยงสูงในขณะนี้</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr class="border-t border-gray-50 hover:bg-gray-50">
        <td class="px-6 py-4 font-medium text-gray-800">${s.fullName}</td>
        <td class="px-6 py-4 text-gray-600">${s.classroom || '—'}</td>
        <td class="px-6 py-4">
          <span class="font-bold text-red-600">${s.engagementScore}</span>
          <span class="text-gray-400 text-xs">/100</span>
        </td>
        <td class="px-6 py-4 text-gray-600">${s.submissionRate}%</td>
        <td class="px-6 py-4 text-gray-600">${s.activeDays} วัน</td>
        <td class="px-6 py-4">
          <span class="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
            🔴 เสี่ยงสูง
          </span>
        </td>
      </tr>
    `).join('');
  },

  async syncNow() {
    const btn = document.querySelector('button[onclick="DASHBOARD.syncNow()"]');
    btn.textContent = '⏳ กำลัง Sync...';
    btn.disabled    = true;

    await API.post('manualSync', {});
    await this.init();

    btn.textContent = '🔄 Sync ข้อมูล';
    btn.disabled    = false;
  },
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => DASHBOARD.init());
```

---

## 📄 assets/js/charts.js

```javascript
// ==========================================
// charts.js — Chart.js Rendering
// ==========================================

const CHARTS = {

  renderPie(canvasId, { high, medium, low }) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['เสี่ยงสูง', 'เสี่ยงปานกลาง', 'ปกติ'],
        datasets: [{
          data:            [high, medium, low],
          backgroundColor: ['#FCA5A5', '#FDE68A', '#6EE7B7'],
          borderColor:     ['#EF4444', '#F59E0B', '#10B981'],
          borderWidth:     2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  },

  renderTrend(canvasId, trendData) {
    // trendData = [{ week: 'สัปดาห์ที่ 1', avgScore: 72 }, ...]
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels:   trendData.map(d => d.week),
        datasets: [{
          label:           'Avg Engagement Score',
          data:            trendData.map(d => d.avgScore),
          borderColor:     '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          tension:         0.4,
          fill:            true,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 100 },
        },
      },
    });
  },
};
```

---

## 📄 teacher.html — Teacher Dashboard

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teacher Dashboard — Student Engagement</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-gray-50 font-sarabun">

  <!-- Navbar (เหมือน dashboard.html) -->
  <nav class="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
    <span class="font-bold text-gray-800">🎓 Teacher Dashboard</span>
    <button onclick="AUTH.logout()" class="text-sm text-red-500">ออกจากระบบ</button>
  </nav>

  <div class="max-w-5xl mx-auto px-6 py-8">

    <!-- Search + Filter -->
    <div class="flex gap-4 mb-6">
      <input id="searchInput" type="text" placeholder="ค้นหานักเรียน..."
        class="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
      <select id="riskFilter"
        class="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none">
        <option value="">ทุกระดับความเสี่ยง</option>
        <option value="HIGH">🔴 เสี่ยงสูง</option>
        <option value="MEDIUM">🟡 เสี่ยงปานกลาง</option>
        <option value="LOW">🟢 ปกติ</option>
      </select>
    </div>

    <!-- Student Cards -->
    <div id="studentList" class="space-y-3">
      <p class="text-center text-gray-400 py-8">กำลังโหลด...</p>
    </div>

  </div>

  <!-- Intervention Modal -->
  <div id="interventionModal"
    class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-6 w-full max-w-md">
      <h3 class="font-bold text-gray-800 mb-4">📝 บันทึกการติดตาม</h3>
      <input type="hidden" id="modalStudentId">

      <div class="space-y-3">
        <div>
          <label class="text-sm text-gray-600">วิธีการติดตาม</label>
          <select id="interventionMethod"
            class="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
            <option value="call">โทรศัพท์</option>
            <option value="email">อีเมล</option>
            <option value="visit">เยี่ยมบ้าน</option>
            <option value="meeting">พูดคุยที่โรงเรียน</option>
            <option value="other">อื่นๆ</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600">บันทึกเพิ่มเติม</label>
          <textarea id="interventionNote" rows="3"
            class="w-full border rounded-lg px-3 py-2 mt-1 text-sm resize-none"
            placeholder="รายละเอียดการติดตาม..."></textarea>
        </div>
        <div>
          <label class="text-sm text-gray-600">ผลลัพธ์</label>
          <select id="interventionOutcome"
            class="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
            <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
            <option value="resolved">แก้ไขได้แล้ว</option>
            <option value="no_response">ไม่มีการตอบสนอง</option>
          </select>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button onclick="TEACHER.closeModal()"
          class="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          ยกเลิก
        </button>
        <button onclick="TEACHER.saveIntervention()"
          class="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
          บันทึก ✅
        </button>
      </div>
    </div>
  </div>

  <script src="assets/js/auth.js"></script>
  <script src="assets/js/api.js"></script>
  <script src="assets/js/teacher.js"></script>
</body>
</html>
```

---

## 📄 assets/js/teacher.js

```javascript
// ==========================================
// teacher.js — Teacher Dashboard Logic
// ==========================================

const TEACHER = {
  allStudents: [],

  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

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

    const riskColor = {
      HIGH:   'border-red-200 bg-red-50',
      MEDIUM: 'border-yellow-200 bg-yellow-50',
      LOW:    'border-green-200 bg-green-50',
    };

    const riskBadge = {
      HIGH:   '<span class="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">🔴 เสี่ยงสูง</span>',
      MEDIUM: '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">🟡 เสี่ยงปานกลาง</span>',
      LOW:    '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">🟢 ปกติ</span>',
    };

    container.innerHTML = students.map(s => `
      <div class="bg-white border ${riskColor[s.riskLevel] || ''} rounded-xl p-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
            ${s.fullName?.charAt(0) || '?'}
          </div>
          <div>
            <p class="font-medium text-gray-800">${s.fullName}</p>
            <p class="text-xs text-gray-400">${s.email}</p>
          </div>
        </div>
        <div class="flex items-center gap-6">
          <div class="text-center">
            <p class="text-xs text-gray-400">Score</p>
            <p class="font-bold text-gray-800">${s.engagementScore}/100</p>
          </div>
          <div class="text-center">
            <p class="text-xs text-gray-400">ส่งงาน</p>
            <p class="font-medium text-gray-700">${s.submissionRate}%</p>
          </div>
          ${riskBadge[s.riskLevel] || ''}
          <button onclick="TEACHER.openModal('${s.studentId}')"
            class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
            ติดตาม
          </button>
        </div>
      </div>
    `).join('');
  },

  bindSearch() {
    const input  = document.getElementById('searchInput');
    const filter = document.getElementById('riskFilter');

    const applyFilter = () => {
      const keyword   = input.value.toLowerCase();
      const riskLevel = filter.value;

      const filtered = this.allStudents.filter(s => {
        const matchName = s.fullName?.toLowerCase().includes(keyword);
        const matchRisk = riskLevel ? s.riskLevel === riskLevel : true;
        return matchName && matchRisk;
      });

      this.renderStudents(filtered);
    };

    input.addEventListener('input', applyFilter);
    filter.addEventListener('change', applyFilter);
  },

  openModal(studentId) {
    document.getElementById('modalStudentId').value = studentId;
    document.getElementById('interventionModal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('interventionModal').classList.add('hidden');
  },

  async saveIntervention() {
    const studentId = document.getElementById('modalStudentId').value;
    const method    = document.getElementById('interventionMethod').value;
    const note      = document.getElementById('interventionNote').value;
    const outcome   = document.getElementById('interventionOutcome').value;
    const user      = AUTH.getSession();

    await API.post('logIntervention', {
      studentId,
      teacherId: user.email,
      method,
      note,
      outcome,
    });

    this.closeModal();
    alert('✅ บันทึกการติดตามเรียบร้อยแล้ว');
  },
};

document.addEventListener('DOMContentLoaded', () => TEACHER.init());
```

---

## 📄 assets/css/style.css

```css
/* Custom CSS เพิ่มเติมจาก Tailwind */

.font-sarabun { font-family: 'Sarabun', sans-serif; }

/* Smooth page transition */
body { animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Score bar */
.score-bar {
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}
```

---

## 📄 backend/WebApp.gs — Admin/Teacher Role Routing

```javascript
// ==========================================
// WebApp.gs — อัปเดต API ให้รองรับ Role
// ==========================================

function doGet(e) {
  const action = e.parameter.action || '';
  const email  = e.parameter.email  || '';

  // ตรวจสอบสิทธิ์
  if (!isAuthorized(email)) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  try {
    let result;
    switch (action) {
      case 'getUserRole':
        result = getUserRole(email);
        break;
      case 'getSummary':
        requireRole(email, ['admin', 'executive']);
        result = getSummary();
        break;
      case 'getScores':
        requireRole(email, ['admin', 'executive']);
        result = getScoresByRisk(e.parameter.riskLevel);
        break;
      case 'getMyStudents':
        requireRole(email, ['teacher', 'admin']);
        result = getStudentsByTeacher(e.parameter.teacherEmail);
        break;
      default:
        result = { error: 'Unknown action' };
    }
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  const body   = JSON.parse(e.postData.contents);
  const action = body.action || '';
  const email  = body.email  || '';

  if (!isAuthorized(email)) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'logIntervention':
        TeacherAction.logIntervention(
          body.studentId, body.teacherId,
          body.method, body.note, body.outcome
        );
        return jsonResponse({ success: true });
      case 'manualSync':
        requireRole(email, ['admin', 'executive']);
        DataSync.syncAll();
        EngagementEngine.calculateAll();
        return jsonResponse({ success: true });
      default:
        return jsonResponse({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ==========================================
// Role Helpers
// ==========================================

function getUserRole(email) {
  const teacher = DB.findOne(CONFIG.SHEETS.TEACHERS, 'email', email);
  if (!teacher) return 'teacher'; // default
  return teacher.role || 'teacher';
}

function requireRole(email, allowedRoles) {
  const role = getUserRole(email);
  if (!allowedRoles.includes(role)) {
    throw new Error(`Permission denied. Required: ${allowedRoles.join('/')}`);
  }
}

function isAuthorized(email) {
  // เฉพาะ email ในโดเมนโรงเรียน
  return email.endsWith('@school.ac.th'); // เปลี่ยนเป็น domain จริง
}

// ==========================================
// Data Helpers — Admin ดึงทุกคน / Teacher ดึงเฉพาะห้องตัวเอง
// ==========================================

function getStudentsByTeacher(teacherEmail) {
  const role = getUserRole(teacherEmail);

  if (role === 'admin' || role === 'executive') {
    // Admin ดึงทุกคน
    return mergeStudentScores(DB.getAll(CONFIG.SHEETS.STUDENTS));
  }

  // Teacher ดึงเฉพาะนักเรียนในวิชาที่ตนสอน
  const myCourses = DB.getAll(CONFIG.SHEETS.COURSES)
    .filter(c => c.ownerId === teacherEmail)
    .map(c => c.courseId);

  const myStudentIds = DB.getAll(CONFIG.SHEETS.ENROLLMENTS)
    .filter(e => myCourses.includes(e.courseId))
    .map(e => e.studentId);

  const myStudents = DB.getAll(CONFIG.SHEETS.STUDENTS)
    .filter(s => myStudentIds.includes(s.studentId));

  return mergeStudentScores(myStudents);
}

function mergeStudentScores(students) {
  const scores = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  return students.map(s => {
    const score = scores.find(sc => sc.studentId === s.studentId) || {};
    return { ...s, ...score };
  });
}

function getSummary() {
  const scores = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  return {
    total:  scores.length,
    high:   scores.filter(s => s.riskLevel === 'HIGH').length,
    medium: scores.filter(s => s.riskLevel === 'MEDIUM').length,
    low:    scores.filter(s => s.riskLevel === 'LOW').length,
    trend:  getTrend(),
  };
}

function getTrend() {
  // คืนค่าเฉลี่ย Score ย้อนหลัง 4 สัปดาห์ (simplified)
  const scores = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  const avg    = scores.reduce((a, b) => a + Number(b.engagementScore || 0), 0) / (scores.length || 1);
  // ในระบบจริงควรเก็บ historical data แยก Sheet
  return [
    { week: '4 สัปดาห์ที่แล้ว', avgScore: Math.round(avg * 0.9) },
    { week: '3 สัปดาห์ที่แล้ว', avgScore: Math.round(avg * 0.93) },
    { week: '2 สัปดาห์ที่แล้ว', avgScore: Math.round(avg * 0.97) },
    { week: 'สัปดาห์นี้',        avgScore: Math.round(avg) },
  ];
}

function getScoresByRisk(riskLevel) {
  const scores   = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  const students = DB.getAll(CONFIG.SHEETS.STUDENTS);

  return scores
    .filter(s => !riskLevel || s.riskLevel === riskLevel)
    .map(s => {
      const student = students.find(st => st.studentId === s.studentId) || {};
      return { ...student, ...s };
    });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 🚀 Quick Start Checklist

```
BACKEND (Google Apps Script)
□ 1. สร้าง Apps Script Project
□ 2. เปิด Advanced Services (Classroom, Sheets, Gmail)
□ 3. วาง Code ทั้งหมดจาก backend/ folder
□ 4. แก้ CONFIG.gs (SPREADSHEET_ID, LINE_TOKEN, domain)
□ 5. รัน setup() ครั้งแรก
□ 6. Deploy เป็น Web App → Copy URL

FRONTEND (GitHub Pages)
□ 7. สร้าง GitHub Repo
□ 8. สร้าง OAuth Client ID ใน Google Cloud Console
□ 9. แก้ CLIENT_ID ใน index.html
□ 10. แก้ API_URL ใน api.js (ใส่ Apps Script URL)
□ 11. แก้ Domain ใน auth.js และ WebApp.gs
□ 12. Push ขึ้น GitHub → เปิด GitHub Pages
□ 13. ทดสอบ Login → Dashboard → Teacher View ✅
```

---

## ⚠️ ข้อควรระวัง

| ประเด็น | รายละเอียด |
|---|---|
| **CORS** | Apps Script Web App ต้องตั้ง Access: Anyone มิฉะนั้น fetch จะ Error |
| **Token Verify** | ควร verify Google JWT token ใน Apps Script จริงๆ ด้วย Google API |
| **Rate Limit** | Apps Script รับ request ได้ ~30/นาที ถ้าใช้งานหนักควร cache ใน Sheets |
| **HTTPS Only** | GitHub Pages ใช้ HTTPS อยู่แล้ว Google OAuth ต้องการ HTTPS |
| **Domain Filter** | ต้องเปลี่ยน `school.ac.th` เป็น domain จริงของโรงเรียน |
