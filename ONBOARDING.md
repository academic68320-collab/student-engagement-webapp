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
├── index.html          — Login page (Google OAuth + dev bypass + link คู่มือ)
├── dashboard.html      — Admin/Executive dashboard
├── teacher.html        — Teacher page
├── guide.html          — คู่มือการใช้งาน (แยก 3 role: Admin / Executive / Teacher)
├── history.html        — ประวัติการติดตาม (teacher เท่านั้น)
├── ONBOARDING.md       — ไฟล์นี้
├── InterventionHistory.gs — Apps Script snippet (user copy ไปใส่ GAS)
├── assets/
│   ├── css/style.css   — Global styles (loader, toast, score-bar)
│   └── js/
│       ├── utils.js    — UTILS: escapeHtml, toast, showLoader/hideLoader,
│       │                  formatDate, riskBadge, recommend(), setAvatar(), apiError()
│       ├── auth.js     — AUTH: Google OAuth, session, requireAuth, logout
│       ├── api.v2.js   — API: get(action, params), post(action, body)
│       ├── config.js   — CONFIG: threshold + weight factors (localStorage)
│       ├── charts.js   — CHARTS: renderPie, renderTrend, renderGauge, renderBar
│       ├── dashboard.js — DASHBOARD object
│       ├── teacher.js  — TEACHER object
│       └── history.js  — HISTORY object (ประวัติ intervention)
```

**Google Apps Script files** (ผู้ใช้จัดการเอง — ไม่อยู่ใน repo):
```
WebApp.gs              — doGet / doPost router
DataSync.gs            — syncCoursesAndStudents, syncTeachers
Notification.gs        — sendRiskAlertEmails, _buildAlertEmail
DB.gs                  — DB.getAll, DB.findMany, DB.upsert (helper)
InterventionHistory.gs — getTeacherInterventions (เพิ่ม session 2026-05-08)
```

---

## 🔌 API

**URL ปัจจุบัน (2026-05-08):**
```
https://script.google.com/macros/s/AKfycbxuM1UQx6AWcHm2WG2VSR-RT7jnhNHWS-AfYnkPy6mVg7teuX4ZFGGua-BMhBdxzOxO/exec
```
> ⚠️ ทุกครั้งที่ deploy Apps Script ใหม่ URL จะเปลี่ยน → ต้องอัพเดตบรรทัดแรกใน `api.v2.js`

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
| `getTeacherInterventions` | `teacherEmail` | ประวัติ intervention (history page) |

**API Actions (POST):**
| action | body | ใช้ที่ไหน |
|---|---|---|
| `logIntervention` | `{studentId, teacherId, method, note, outcome}` | บันทึกการติดตาม |
| `sendAlerts` | `{studentIds: []}` | ส่ง email แจ้งเตือนครู |
| `manualSync` | — | sync Google Classroom |

**Apps Script pattern (WebApp.gs):**
```javascript
// ใช้ _json() ไม่ใช่ ok()
case 'getTeacherInterventions':
  _requireRole(email, ['teacher', 'admin']);
  return _json({ success: true, data: getTeacherInterventions(e.parameter.teacherEmail) });
```

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
engagementScore = (submissionRate × wSubmission) + (activityScore × wActivity) + (activeDays/30 × 100 × wActiveDays)

Default weights (config.js):
  wSubmission  = 50%
  wActivity    = 30%
  wActiveDays  = 20%

riskLevel:
  HIGH   = score < highMax   (default 40)
  MEDIUM = score < mediumMax (default 70)
  LOW    = score ≥ mediumMax
```
> Threshold + Weight ปรับได้จาก System Config UI (admin only) → บันทึกใน localStorage

---

## ✅ Features ที่ทำเสร็จแล้ว

### Login (`index.html`)
- [x] Google OAuth GSI — programmatic init + renderButton
- [x] Dev bypass (localhost only) — email + role dropdown
- [x] Hero landing (desktop): slideshow 5 features, stats row, particles
- [x] Dark gradient theme
- [x] Link ไปคู่มือการใช้งาน

### Dashboard (`dashboard.html` + `dashboard.js`)
- [x] Overview KPI cards (คลิกดูรายชื่อนักเรียน → modal)
- [x] Risk pie chart + Trend line chart
- [x] Top 10 วิชา bar chart
- [x] Avg Engagement Gauge (school-wide)
- [x] Course table: search, sort, pagination (25/page)
- [x] Course detail: KPI + student table + avg score gauge
- [x] Student detail: score breakdown, gauge, trend chart, per-course scores, intervention history
- [x] Recommendation Engine card (rule-based)
- [x] Risk modal (click KPI → รายชื่อนักเรียน)
- [x] Alert email modal (checkbox select → POST sendAlerts)
- [x] Export Excel + PDF
- [x] Admin buttons: Sync + Send Alert (admin only)
- [x] **⚙️ System Config UI** (admin only) — ตั้ง threshold + weight factors พร้อม slider+textbox
- [x] **Dark theme** — navy gradient + dark cards
- [x] **Browser back button** — History API pushState/popstate
- [x] **API error state** — retry button ถ้า API ไม่ตอบ
- [x] **Avatar fallback** — SVG initials เมื่อโหลดรูปไม่ได้
- [x] **Transparent loader** — blur backdrop overlay
- [x] **riskBadge CSS dot** — แทน emoji (projector safe)
- [x] Link ไปคู่มือ

### Teacher Page (`teacher.html` + `teacher.js`)
- [x] Course list (click เข้า student list)
- [x] Student list: search, risk filter, export Excel/PDF
- [x] KPI cards + risk modal
- [x] Avg Score Gauge ต่อวิชา
- [x] Intervention modal: method, note, outcome
- [x] **Recommendation pre-fill**
- [x] **Dark theme**
- [x] **Browser back button** — History API
- [x] **API error state** — retry button
- [x] Link ไปประวัติติดตาม + คู่มือ

### คู่มือ (`guide.html`)
- [x] Tab switching: Admin / Executive / Teacher
- [x] Admin: 8 sections (Overview, Course, Student, System Config, Export, Alert, Sync, FAQ)
- [x] Executive: 5 sections
- [x] Teacher: 6 sections (Course, Student, Intervention, History, Export, FAQ)
- [x] Dark theme + sticky sidebar (desktop)

### ประวัติการติดตาม (`history.html` + `history.js`)
- [x] Stats row (total, this month, pending, resolved)
- [x] Filter bar: วิชา + method + ช่วงเวลา
- [x] History card list (timeline)
- [x] Export Excel
- [x] เรียงล่าสุดก่อน
- [x] เรียก API `getTeacherInterventions`

### Google Apps Script
- [x] Classroom Sync รวม pending invites
- [x] Teacher email lookup: CourseTeachers → Courses.ownerId fallback
- [x] Email HTML template
- [x] `getTeacherInterventions` — join Interventions + Students + Courses + Enrollments

---

## 💡 Recommendation Engine Rules

```javascript
Rule 1: submissionRate < subUrgent%   → urgent  → method: 'call'    (โทรหาผู้ปกครอง)
Rule 2: submissionRate < subWarning%  → warning → method: 'meeting'
Rule 3: activeDays < daysUrgent       → urgent  → method: 'visit'   (เยี่ยมบ้าน)
Rule 4: activeDays < daysWarning      → warning → method: 'meeting'
Rule 5: score ลด 3 สัปดาห์ ≥ trendDrop → warning → method: 'email'
Rule 6: activityScore < actWarning%   → warning → method: 'meeting'
```
> ค่า default ปรับได้จาก System Config — บันทึกใน localStorage ผ่าน `config.js`

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
Loader:       backdrop-filter blur + semi-transparent overlay + card
```

---

## 🐛 Known Issues / ข้อควรระวัง

1. **API URL เปลี่ยนทุก deploy** — อัพเดตใน `D:\GCE\assets\js\api.v2.js` บรรทัดแรก
2. **CourseId type mismatch** — Apps Script เก็บเป็น Number, Classroom API return String → ใช้ `String(courseId)` เสมอ
3. **Pending invites** — ครู/นักเรียนที่ยังไม่ accept invite → ต้องใช้ `Invitations.list()` ด้วย
4. **Email emoji** — Gmail ไม่ render emoji ใน HTML email → ใช้ styled `<span>` แทน
5. **history.html** — ยังไม่ได้ verify end-to-end หลัง fix `ok()` → `_json()` ใน WebApp.gs

---

## 🔑 Dev Login (localhost)

```
Email: xxx@feu.ac.th หรือ xxx@feu.edu
Role:  admin / executive / teacher
```
ปุ่ม dev login แสดงเฉพาะ `localhost` หรือ `127.0.0.1`

---

*Last updated: 2026-05-11*
