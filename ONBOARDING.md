# Student Engagement Intelligence System — Project Onboarding

> แนบไฟล์นี้ตอนเริ่ม session ใหม่เพื่อให้ Claude รู้ context ทันที

---

## 🏫 ภาพรวมโปรเจกต์

ระบบติดตาม Engagement นักเรียนจาก **Google Classroom** สำหรับ Far Eastern University (FEU)  
วิเคราะห์ risk level อัตโนมัติ แจ้งเตือนครู และแนะนำ intervention

**Live URL:** `https://legendary-kulfi-47f1fa.netlify.app/`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML + Tailwind CSS CDN + Vanilla JS |
| Backend | Google Apps Script (Web App) |
| Database | Google Sheets (ทำหน้าที่เป็น DB) |
| Data Source | Google Classroom API |
| Auth | Google OAuth (GSI) |
| Charts | Chart.js |
| Export | SheetJS (xlsx) |
| Deploy | Netlify (static) |

---

## 📁 โครงสร้างไฟล์

```
D:\GCE\
├── index.html          — Login page (Google OAuth + dev bypass)
├── dashboard.html      — Admin/Executive dashboard
├── teacher.html        — Teacher page
├── ONBOARDING.md       — ไฟล์นี้
├── assets/
│   ├── css/style.css   — Global styles (loader, toast, score-bar)
│   └── js/
│       ├── utils.js    — UTILS: escapeHtml, toast, showLoader/hideLoader,
│       │                  formatDate, riskBadge, recommend()
│       ├── auth.js     — AUTH: Google OAuth, session, requireAuth, logout
│       ├── api.v2.js   — API: get(action, params), post(action, body)
│       ├── charts.js   — CHARTS: renderPie, renderTrend, renderGauge, renderBar
│       ├── dashboard.js — DASHBOARD object (ดูด้านล่าง)
│       └── teacher.js  — TEACHER object (ดูด้านล่าง)
```

**Google Apps Script files** (ผู้ใช้จัดการเอง — ไม่อยู่ใน repo):
```
WebApp.gs       — doGet / doPost router
DataSync.gs     — syncCoursesAndStudents, syncTeachers
Notification.gs — sendRiskAlertEmails, _buildAlertEmail
DB.gs           — DB.getAll, DB.findMany, DB.upsert (helper)
```

---

## 🔌 API

**URL ปัจจุบัน:**
```
https://script.google.com/macros/s/AKfycbyA9OZ4ru14QXRGSrKsnBzQw_0X7VsjbxzA89Ux0E2IARGRwqID3f1mKMR6fXnH_ELv/exec
```
> ⚠️ ทุกครั้งที่ deploy Apps Script ใหม่ URL จะเปลี่ยน → ต้องอัพเดตใน `api.v2.js`

**API Actions (GET):**
| action | params | ใช้ที่ไหน |
|---|---|---|
| `getSummary` | — | dashboard overview KPI |
| `getCourseList` | — | course table + bar chart |
| `getCourseStudents` | `courseId` | student list ในวิชา |
| `getStudentDetail` | `studentId` | student detail view |
| `getStudentCourses` | `studentId` | รายวิชาของนักเรียน |
| `getTeacherCourses` | `teacherEmail` | course list (teacher page) |
| `getScores` | `riskLevel?` | risk modal (dashboard) |
| `getAlertPreview` | — | preview นักเรียน HIGH risk ก่อนส่ง email |

**API Actions (POST):**
| action | body | ใช้ที่ไหน |
|---|---|---|
| `logIntervention` | `{studentId, teacherId, method, note, outcome}` | บันทึกการติดตาม |
| `sendAlerts` | `{studentIds: []}` | ส่ง email แจ้งเตือนครู |
| `manualSync` | — | sync Google Classroom |

---

## 🗄 Google Sheets Structure

| Sheet | Columns หลัก |
|---|---|
| Students | studentId, fullName, email, grade, classroom, status |
| Courses | courseId, courseName, section, ownerId (teacher email) |
| Enrollments | enrollmentId, courseId, studentId, enrolledAt |
| CourseTeachers | courseId, teacherEmail |
| Scores | studentId, courseId, engagementScore, submissionRate, activityScore, activeDays, riskLevel |
| Interventions | interventionId, studentId, teacherId, method, note, outcome, createdAt |
| ScoreHistory | studentId, week, engagementScore |

---

## 📐 Engagement Score Formula

```
engagementScore = (submissionRate × 0.5) + (activityScore × 0.3) + (activeDays/30 × 100 × 0.2)

riskLevel:
  HIGH   = score < 40
  MEDIUM = score 40–69
  LOW    = score ≥ 70
```

---

## ✅ Features ที่ทำเสร็จแล้ว

### Dashboard (`dashboard.html` + `dashboard.js`)
- [x] Overview KPI cards (คลิกดูรายชื่อนักเรียน → modal)
- [x] Risk pie chart + Trend line chart
- [x] Top 10 วิชา bar chart (tooltip แสดงชื่อเต็ม)
- [x] Avg Engagement Gauge (school-wide weighted average)
- [x] Course table: search, sort (clickable headers), pagination (25/page)
- [x] Course detail: KPI + student table + avg score gauge
- [x] Student detail: score breakdown, gauge, trend chart, per-course scores, intervention history
- [x] Recommendation Engine card (วิเคราะห์อัตโนมัติ)
- [x] Risk modal (click KPI → รายชื่อนักเรียน พร้อม search)
- [x] Alert email modal (checkbox select → POST sendAlerts)
- [x] Export Excel (SheetJS) + PDF (print window)
- [x] Admin buttons: Sync + Send Alert (แสดงเฉพาะ role admin)
- [x] **Dark theme** (match login page — navy gradient + dark cards)
- [x] **Responsive**: table → card list บน mobile

### Teacher Page (`teacher.html` + `teacher.js`)
- [x] Course list (click เข้า student list)
- [x] Student list: search, risk filter, export Excel/PDF
- [x] KPI cards (คลิกดูรายชื่อ → modal)
- [x] Avg Score Gauge ต่อวิชา
- [x] Risk modal (ไม่ต้อง API call — ใช้ `_allStudents` ที่โหลดแล้ว)
- [x] Intervention modal: method, note, outcome
- [x] **Recommendation pre-fill**: ระบบเลือก method + เติม note ให้อัตโนมัติ
- [x] **Dark theme** (match dashboard)
- [x] **Responsive**: card layout พร้อม touch-friendly

### Google Apps Script
- [x] Classroom Sync รวม **pending invites** (ครู + นักเรียนที่ยังไม่ accept)
- [x] Teacher email lookup: CourseTeachers → Courses.ownerId fallback
- [x] Email HTML template (ไม่ใช้ emoji — ใช้ styled HTML แทน)
- [x] `_getAlertPreview()` join ผ่าน Students sheet (ไม่ใช่ Users)

### Shared
- [x] `UTILS.recommend(student)` — rule-based engine, 5 rules
- [x] `UTILS.showLoader / hideLoader` — full-page gradient overlay
- [x] Chart.js dark theme (axis สี slate, gauge track สีเข้ม)

---

## 💡 Recommendation Engine Rules

```javascript
// ใน UTILS.recommend(student) — utils.js
Rule 1: submissionRate < 30%    → urgent  → method: 'call'    (โทรหาผู้ปกครอง)
Rule 2: submissionRate 30–60%   → warning → method: 'meeting' (พูดคุย)
Rule 3: activeDays < 3          → urgent  → method: 'visit'   (เยี่ยมบ้าน)
Rule 4: activeDays < 8          → warning → method: 'meeting'
Rule 5: score ลด 3 สัปดาห์ ≥10  → warning → method: 'email'
Rule 6: activityScore < 20%     → warning → method: 'meeting'
```

---

## 🎨 Design System

**Color Palette (Dark Theme):**
```css
Background:   #080f1e
Nav gradient: linear-gradient(135deg, #1e3a8a, #1d4ed8, #0369a1, #0e7490)
Cards:        rgba(15,23,42,0.75) border rgba(51,65,85,0.55)
Card RED:     rgba(127,29,29,0.25) border rgba(185,28,28,0.3)
Card YELLOW:  rgba(120,53,15,0.25) border rgba(180,83,9,0.3)
Card GREEN:   rgba(20,83,45,0.25)  border rgba(22,101,52,0.3)
Modal bg:     #0f172a
Text primary: text-slate-200
Text muted:   text-slate-400 / text-slate-500
Input:        .glow-input class (dark bg + blue focus ring)
```

**CSS Classes (style.css + inline `<style>`):**
- `.gradient-bg` — navbar/button gradient
- `.card` — dark card base
- `.card-red/yellow/green` — tinted risk cards
- `.glow-input` — dark input/select
- `.tbl-row:hover` — dark table row hover
- `.tbl-head th` — dark table header

---

## 📋 Pending Tasks

| Priority | Feature | รายละเอียด |
|---|---|---|
| Medium | ⚙️ System Config UI | หน้า admin ตั้ง threshold HIGH/MEDIUM/LOW + weight factors |
| Low | 🚀 Deploy | Push ไฟล์ล่าสุดขึ้น Netlify |

---

## 🐛 Known Issues / ข้อควรระวัง

1. **API URL เปลี่ยนทุก deploy** — อัพเดตใน `D:\GCE\assets\js\api.v2.js` บรรทัดแรก
2. **CourseId type mismatch** — Apps Script เก็บเป็น Number, Classroom API return String → ใช้ `String(courseId)` เสมอ
3. **Pending invites** — ครู/นักเรียนที่ยังไม่ accept invite จะไม่ปรากฏใน Classroom API `Members.list()` → ต้องใช้ `Invitations.list()` ด้วย
4. **Email emoji** — Gmail ไม่ render emoji ใน HTML email → ใช้ styled `<span>` แทน

---

## 🔑 Dev Login (localhost)

```
Email: xxx@feu.ac.th หรือ xxx@feu.edu
Role:  admin / executive / teacher
```
ปุ่ม dev login แสดงเฉพาะ `localhost` หรือ `127.0.0.1`

---

*Last updated: 2026-05-07*
