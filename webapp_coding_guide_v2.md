# Student Engagement Intelligence System — Coding Guide v2
## Stack: HTML + Vanilla JS + Tailwind CDN / Google Apps Script / GitHub Pages

---

## 📁 Project Structure

```
student-engagement-webapp/
│
├── index.html
├── dashboard.html
├── teacher.html
├── student.html              ← Optional
│
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── auth.js
│       ├── api.js
│       ├── charts.js
│       ├── dashboard.js
│       ├── teacher.js
│       └── utils.js
│
└── backend/                  ← Google Apps Script (deploy แยก)
    ├── Config.gs             ← [1] ตั้งค่าทั้งหมด
    ├── Database.gs           ← [2] Google Sheets CRUD
    ├── DataSync.gs           ← [3] ดึงข้อมูลจาก Google Classroom
    ├── EngagementEngine.gs   ← [4] คำนวณ Score
    ├── RiskDetection.gs      ← [5] ตรวจจับ Trigger Conditions
    ├── Notification.gs       ← [6] Email + LINE Notify
    ├── TeacherAction.gs      ← [7] Intervention Log
    ├── Scheduler.gs          ← [8] Cron + Setup
    └── WebApp.gs             ← [9] REST API endpoint
```

> **ลำดับการ deploy:** Config → Database → DataSync → EngagementEngine → RiskDetection → Notification → TeacherAction → Scheduler → WebApp  
> แต่ละไฟล์ขึ้นกับไฟล์ก่อนหน้า อย่า deploy บางส่วน

---

## ⚙️ Setup

### 1. สร้าง Google Sheets
- ไปที่ sheets.google.com → สร้าง Spreadsheet ใหม่
- Copy Spreadsheet ID จาก URL: `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### 2. สร้าง Apps Script Project
- ไปที่ script.google.com → New Project
- เพิ่ม Advanced Services: **Google Classroom API**, **Gmail API**
- วางโค้ดทั้งหมดจาก backend/

### 3. รัน `setup()` ครั้งแรก (สร้าง Sheets และ Triggers)

### 4. Deploy → New Deployment → Web App
- Execute as: Me
- Who has access: Anyone
- Copy **Web App URL**

### 5. สร้าง OAuth Client ID
- console.cloud.google.com → APIs & Services → Credentials
- Application type: Web application
- Authorized origins: `https://username.github.io`

---

# BACKEND

---

## [1] backend/Config.gs

```javascript
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
  LINE_TOKEN:     'YOUR_LINE_NOTIFY_TOKEN',
  SCHOOL_DOMAIN:  'school.ac.th',

  SHEETS: {
    STUDENTS:          'Students',
    TEACHERS:          'Teachers',
    COURSES:           'Courses',
    ENROLLMENTS:       'Enrollments',
    ASSIGNMENTS:       'Assignments',
    SUBMISSIONS:       'Submissions',
    ENGAGEMENT_SCORES: 'EngagementScores',
    SCORE_HISTORY:     'ScoreHistory',
    INTERVENTIONS:     'Interventions',
  },

  WEIGHTS: {
    SUBMISSION_RATE: 0.50,
    ACTIVITY_SCORE:  0.30,
    ACTIVE_DAYS:     0.20,
  },

  RISK: {
    HIGH_THRESHOLD:   40,
    MEDIUM_THRESHOLD: 70,
  },

  TRIGGERS: {
    MISSED_ASSIGNMENTS:  3,
    INACTIVE_DAYS:       7,
    SCORE_DROP:          20,
    SCORE_DROP_WEEKS:    2,
  },
};
```

---

## [2] backend/Database.gs

```javascript
const DB = {

  _sheet(name) {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(name) || ss.insertSheet(name);
  },

  getAll(sheetName) {
    const sheet = this._sheet(sheetName);
    const data  = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    return data.slice(1)
      .filter(row => row.some(cell => cell !== ''))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
  },

  findOne(sheetName, key, value) {
    return this.getAll(sheetName).find(row => row[key] === value) || null;
  },

  findMany(sheetName, key, value) {
    return this.getAll(sheetName).filter(row => row[key] === value);
  },

  appendRow(sheetName, obj) {
    const sheet   = this._sheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row     = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
    sheet.appendRow(row);
  },

  upsert(sheetName, keyField, obj) {
    const sheet = this._sheet(sheetName);
    const data  = sheet.getDataRange().getValues();
    if (data.length < 1) return;

    const headers = data[0];
    const keyCol  = headers.indexOf(keyField);
    if (keyCol === -1) return;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][keyCol]) === String(obj[keyField])) {
        const row = headers.map((h, j) => (obj[h] !== undefined ? obj[h] : data[i][j]));
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        return;
      }
    }
    this.appendRow(sheetName, obj);
  },

  setup() {
    const schemas = {
      [CONFIG.SHEETS.STUDENTS]:          ['studentId', 'fullName', 'email', 'grade', 'classroom', 'status'],
      [CONFIG.SHEETS.TEACHERS]:          ['teacherId', 'fullName', 'email', 'role'],
      [CONFIG.SHEETS.COURSES]:           ['courseId', 'courseName', 'ownerId', 'section', 'grade', 'classroom'],
      [CONFIG.SHEETS.ENROLLMENTS]:       ['enrollmentId', 'courseId', 'studentId', 'enrolledAt'],
      [CONFIG.SHEETS.ASSIGNMENTS]:       ['assignmentId', 'courseId', 'title', 'dueDate', 'maxPoints'],
      [CONFIG.SHEETS.SUBMISSIONS]:       ['submissionId', 'assignmentId', 'studentId', 'submittedAt', 'state', 'score'],
      [CONFIG.SHEETS.ENGAGEMENT_SCORES]: ['studentId', 'engagementScore', 'submissionRate', 'activityScore', 'activeDays', 'riskLevel', 'calculatedAt'],
      [CONFIG.SHEETS.SCORE_HISTORY]:     ['studentId', 'week', 'engagementScore', 'calculatedAt'],
      [CONFIG.SHEETS.INTERVENTIONS]:     ['interventionId', 'studentId', 'teacherId', 'method', 'note', 'outcome', 'createdAt'],
    };

    Object.entries(schemas).forEach(([name, headers]) => {
      const sheet = this._sheet(name);
      if (sheet.getLastRow() === 0) sheet.appendRow(headers);
    });

    Logger.log('Database setup complete');
  },
};
```

---

## [3] backend/DataSync.gs

```javascript
const DataSync = {

  syncAll() {
    this.syncCoursesAndStudents();
    this.syncAssignments();
    this.syncSubmissions();
    Logger.log('DataSync complete');
  },

  syncCoursesAndStudents() {
    const courses = Classroom.Courses.list({
      teacherId:    'me',
      courseStates: ['ACTIVE'],
      pageSize:     50,
    }).courses || [];

    courses.forEach(course => {
      DB.upsert(CONFIG.SHEETS.COURSES, 'courseId', {
        courseId:   course.id,
        courseName: course.name,
        ownerId:    course.ownerId,
        section:    course.section || '',
      });

      const students = Classroom.Courses.Students.list(course.id).students || [];
      students.forEach(enrollment => {
        const p = enrollment.profile;
        DB.upsert(CONFIG.SHEETS.STUDENTS, 'studentId', {
          studentId: p.id,
          fullName:  p.name.fullName,
          email:     p.emailAddress,
          status:    'active',
        });
        DB.upsert(CONFIG.SHEETS.ENROLLMENTS, 'enrollmentId', {
          enrollmentId: `${course.id}_${p.id}`,
          courseId:     course.id,
          studentId:    p.id,
          enrolledAt:   new Date().toISOString(),
        });
      });
    });
  },

  syncAssignments() {
    DB.getAll(CONFIG.SHEETS.COURSES).forEach(course => {
      try {
        const works = Classroom.Courses.CourseWork.list(
          course.courseId, { courseWorkStates: ['PUBLISHED'] }
        ).courseWork || [];

        works.forEach(work => {
          DB.upsert(CONFIG.SHEETS.ASSIGNMENTS, 'assignmentId', {
            assignmentId: work.id,
            courseId:     course.courseId,
            title:        work.title,
            dueDate:      work.dueDate
              ? `${work.dueDate.year}-${String(work.dueDate.month).padStart(2,'0')}-${String(work.dueDate.day).padStart(2,'0')}`
              : '',
            maxPoints: work.maxPoints || 0,
          });
        });
      } catch (e) {
        Logger.log(`syncAssignments [${course.courseId}]: ${e}`);
      }
    });
  },

  syncSubmissions() {
    DB.getAll(CONFIG.SHEETS.ASSIGNMENTS).forEach(assignment => {
      try {
        const subs = Classroom.Courses.CourseWork.StudentSubmissions.list(
          assignment.courseId,
          assignment.assignmentId,
        ).studentSubmissions || [];

        subs.forEach(sub => {
          DB.upsert(CONFIG.SHEETS.SUBMISSIONS, 'submissionId', {
            submissionId: sub.id,
            assignmentId: assignment.assignmentId,
            studentId:    sub.userId,
            submittedAt:  sub.updateTime || '',
            state:        sub.state,
            score:        sub.assignedGrade || 0,
          });
        });
      } catch (e) {
        Logger.log(`syncSubmissions [${assignment.assignmentId}]: ${e}`);
      }
    });
  },
};
```

---

## [4] backend/EngagementEngine.gs

```javascript
const EngagementEngine = {

  calculateAll() {
    const students    = DB.getAll(CONFIG.SHEETS.STUDENTS);
    const allSubs     = DB.getAll(CONFIG.SHEETS.SUBMISSIONS);
    const allAssigns  = DB.getAll(CONFIG.SHEETS.ASSIGNMENTS);
    const allEnrolls  = DB.getAll(CONFIG.SHEETS.ENROLLMENTS);
    const weekLabel   = this._weekLabel();

    // คำนวณค่าเฉลี่ย activity ทั้งระบบก่อน (ใช้ normalize)
    const avgActivity = this._globalAvgActivity(allSubs, students.length);

    students.forEach(student => {
      const score = this._calculate(student.studentId, allSubs, allAssigns, allEnrolls, avgActivity);

      DB.upsert(CONFIG.SHEETS.ENGAGEMENT_SCORES, 'studentId', {
        studentId:       student.studentId,
        engagementScore: score.engagementScore,
        submissionRate:  score.submissionRate,
        activityScore:   score.activityScore,
        activeDays:      score.activeDays,
        riskLevel:       score.riskLevel,
        calculatedAt:    new Date().toISOString(),
      });

      DB.appendRow(CONFIG.SHEETS.SCORE_HISTORY, {
        studentId:       student.studentId,
        week:            weekLabel,
        engagementScore: score.engagementScore,
        calculatedAt:    new Date().toISOString(),
      });
    });
  },

  _calculate(studentId, allSubs, allAssigns, allEnrolls, avgActivity) {
    const submissionRate = this._submissionRate(studentId, allSubs, allAssigns, allEnrolls);
    const activityScore  = this._activityScore(studentId, allSubs, avgActivity);
    const activeDays     = this._activeDays(studentId, allSubs);

    const w   = CONFIG.WEIGHTS;
    const raw = (submissionRate * w.SUBMISSION_RATE) +
                (activityScore  * w.ACTIVITY_SCORE)  +
                (activeDays     * w.ACTIVE_DAYS);

    const engagementScore = Math.round(Math.min(100, Math.max(0, raw)));

    return {
      engagementScore,
      submissionRate: Math.round(submissionRate),
      activityScore:  Math.round(activityScore),
      activeDays:     Math.round(activeDays * 30 / 100), // แปลงกลับเป็นจำนวนวัน
      riskLevel:      this._riskLevel(engagementScore),
    };
  },

  _submissionRate(studentId, allSubs, allAssigns, allEnrolls) {
    const myCourseIds   = allEnrolls.filter(e => e.studentId === studentId).map(e => e.courseId);
    const myAssignments = allAssigns.filter(a => myCourseIds.includes(a.courseId));
    if (myAssignments.length === 0) return 100;

    const submitted = new Set(
      allSubs
        .filter(s => s.studentId === studentId && ['TURNED_IN', 'RETURNED'].includes(s.state))
        .map(s => s.assignmentId)
    );

    const count = myAssignments.filter(a => submitted.has(a.assignmentId)).length;
    return (count / myAssignments.length) * 100;
  },

  _activityScore(studentId, allSubs, avgActivity) {
    const myActivity = allSubs.filter(s => s.studentId === studentId && s.submittedAt).length;
    if (avgActivity === 0) return 50;
    return Math.min(100, (myActivity / avgActivity) * 100);
  },

  _activeDays(studentId, allSubs) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const days = new Set(
      allSubs
        .filter(s => s.studentId === studentId && s.submittedAt && new Date(s.submittedAt) > cutoff)
        .map(s => new Date(s.submittedAt).toDateString())
    );
    return (days.size / 30) * 100; // normalize to 0-100
  },

  _globalAvgActivity(allSubs, studentCount) {
    if (studentCount === 0) return 1;
    return allSubs.filter(s => s.submittedAt).length / studentCount;
  },

  _riskLevel(score) {
    if (score < CONFIG.RISK.HIGH_THRESHOLD)   return 'HIGH';
    if (score < CONFIG.RISK.MEDIUM_THRESHOLD) return 'MEDIUM';
    return 'LOW';
  },

  _weekLabel() {
    const d     = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const week  = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  },
};
```

---

## [5] backend/RiskDetection.gs

```javascript
const RiskDetection = {

  checkAll() {
    const students = DB.getAll(CONFIG.SHEETS.STUDENTS);
    const alerts   = [];

    students.forEach(student => {
      const triggers = this.checkStudent(student.studentId);
      triggers.forEach(t => alerts.push({ student, ...t }));
    });

    return alerts;
  },

  checkStudent(studentId) {
    const triggers = [];

    if (this._missedAssignments(studentId)) {
      triggers.push({
        type:    'MISSED_ASSIGNMENTS',
        message: `ไม่ส่งงานติดต่อกัน ${CONFIG.TRIGGERS.MISSED_ASSIGNMENTS} ชิ้น`,
      });
    }
    if (this._inactiveTooLong(studentId)) {
      triggers.push({
        type:    'INACTIVE',
        message: `ไม่มี activity ใน Classroom เกิน ${CONFIG.TRIGGERS.INACTIVE_DAYS} วัน`,
      });
    }
    if (this._scoreDrop(studentId)) {
      triggers.push({
        type:    'SCORE_DROP',
        message: `Engagement Score ลดลงมากกว่า ${CONFIG.TRIGGERS.SCORE_DROP} คะแนน ใน ${CONFIG.TRIGGERS.SCORE_DROP_WEEKS} สัปดาห์`,
      });
    }

    return triggers;
  },

  _missedAssignments(studentId) {
    const enrollments = DB.findMany(CONFIG.SHEETS.ENROLLMENTS, 'studentId', studentId).map(e => e.courseId);
    const recent = DB.getAll(CONFIG.SHEETS.ASSIGNMENTS)
      .filter(a => enrollments.includes(a.courseId) && a.dueDate)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      .slice(0, CONFIG.TRIGGERS.MISSED_ASSIGNMENTS);

    if (recent.length < CONFIG.TRIGGERS.MISSED_ASSIGNMENTS) return false;

    const submitted = new Set(
      DB.findMany(CONFIG.SHEETS.SUBMISSIONS, 'studentId', studentId)
        .filter(s => ['TURNED_IN', 'RETURNED'].includes(s.state))
        .map(s => s.assignmentId)
    );

    return recent.every(a => !submitted.has(a.assignmentId));
  },

  _inactiveTooLong(studentId) {
    const submissions = DB.findMany(CONFIG.SHEETS.SUBMISSIONS, 'studentId', studentId)
      .filter(s => s.submittedAt)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    if (submissions.length === 0) return true;

    const daysSince = (Date.now() - new Date(submissions[0].submittedAt)) / 86400000;
    return daysSince > CONFIG.TRIGGERS.INACTIVE_DAYS;
  },

  _scoreDrop(studentId) {
    const history = DB.findMany(CONFIG.SHEETS.SCORE_HISTORY, 'studentId', studentId)
      .sort((a, b) => new Date(b.calculatedAt) - new Date(a.calculatedAt));

    const needed = CONFIG.TRIGGERS.SCORE_DROP_WEEKS + 1;
    if (history.length < needed) return false;

    const latest = Number(history[0].engagementScore);
    const past   = Number(history[CONFIG.TRIGGERS.SCORE_DROP_WEEKS].engagementScore);
    return (past - latest) > CONFIG.TRIGGERS.SCORE_DROP;
  },
};
```

---

## [6] backend/Notification.gs

```javascript
const Notification = {

  sendAlerts(alerts) {
    alerts.forEach(({ student, message }) => {
      this._notifyTeachers(student, message);
    });
  },

  notifyHighRisk(student, score) {
    const msg = `🔴 [เสี่ยงสูง] ${student.fullName}\nScore: ${score}/100\nกรุณาติดตามภายใน 48 ชั่วโมง`;
    this._notifyTeachers(student, msg);
  },

  _notifyTeachers(student, message) {
    const courseIds  = DB.findMany(CONFIG.SHEETS.ENROLLMENTS, 'studentId', student.studentId).map(e => e.courseId);
    const teacherEmails = [...new Set(
      DB.getAll(CONFIG.SHEETS.COURSES)
        .filter(c => courseIds.includes(c.courseId))
        .map(c => c.ownerId)
    )];

    teacherEmails.forEach(email => {
      this._email(email, student, message);
    });

    this._line(student, message);
  },

  _email(toEmail, student, message) {
    try {
      GmailApp.sendEmail(
        toEmail,
        `⚠️ แจ้งเตือนนักเรียนเสี่ยง: ${student.fullName}`,
        [
          message,
          '',
          `นักเรียน : ${student.fullName}`,
          `Email    : ${student.email}`,
          `ห้อง     : ${student.classroom || '-'}`,
          '',
          'กรุณาเข้าสู่ระบบเพื่อบันทึกการติดตาม',
        ].join('\n')
      );
    } catch (e) {
      Logger.log(`Email error to ${toEmail}: ${e}`);
    }
  },

  _line(student, message) {
    if (!CONFIG.LINE_TOKEN) return;
    try {
      UrlFetchApp.fetch('https://notify-api.line.me/api/notify', {
        method:  'post',
        headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}` },
        payload: { message: `\n${message}` },
      });
    } catch (e) {
      Logger.log(`LINE error: ${e}`);
    }
  },
};
```

---

## [7] backend/TeacherAction.gs

```javascript
const TeacherAction = {

  logIntervention(studentId, teacherId, method, note, outcome) {
    DB.appendRow(CONFIG.SHEETS.INTERVENTIONS, {
      interventionId: Utilities.getUuid(),
      studentId,
      teacherId,
      method,
      note,
      outcome,
      createdAt: new Date().toISOString(),
    });
  },

  getHistory(studentId) {
    return DB.findMany(CONFIG.SHEETS.INTERVENTIONS, 'studentId', studentId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
};
```

---

## [8] backend/Scheduler.gs

```javascript
function setup() {
  DB.setup();

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Sync ทุกคืน 02:00
  ScriptApp.newTrigger('dailySync')
    .timeBased().everyDays(1).atHour(2).create();

  // คำนวณ Score ทุกวันจันทร์ 03:00
  ScriptApp.newTrigger('weeklyScore')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();

  Logger.log('Triggers created');
}

function dailySync() {
  DataSync.syncAll();
  const alerts = RiskDetection.checkAll();
  if (alerts.length > 0) Notification.sendAlerts(alerts);
}

function weeklyScore() {
  EngagementEngine.calculateAll();
}
```

---

## [9] backend/WebApp.gs

```javascript
function doGet(e) {
  const action = e.parameter.action || '';
  const email  = e.parameter.email  || '';

  if (!_isAuthorized(email)) {
    return _json({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'getUserRole':
        return _json({ success: true, data: _getUserRole(email) });

      case 'getSummary':
        _requireRole(email, ['admin', 'executive']);
        return _json({ success: true, data: _getSummary() });

      case 'getScores':
        _requireRole(email, ['admin', 'executive']);
        return _json({ success: true, data: _getScoresByRisk(e.parameter.riskLevel) });

      case 'getClassroomRanking':
        _requireRole(email, ['admin', 'executive']);
        return _json({ success: true, data: _getClassroomRanking() });

      case 'getMyStudents':
        _requireRole(email, ['teacher', 'admin']);
        return _json({ success: true, data: _getStudentsByTeacher(e.parameter.teacherEmail) });

      case 'getInterventionHistory':
        _requireRole(email, ['teacher', 'admin', 'executive']);
        return _json({ success: true, data: TeacherAction.getHistory(e.parameter.studentId) });

      default:
        return _json({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    return _json({ success: false, error: err.message });
  }
}

function doPost(e) {
  const body   = JSON.parse(e.postData.contents);
  const action = body.action || '';
  const email  = body.email  || '';

  if (!_isAuthorized(email)) {
    return _json({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'logIntervention':
        _requireRole(email, ['teacher', 'admin']);
        TeacherAction.logIntervention(
          body.studentId, body.teacherId,
          body.method, body.note, body.outcome
        );
        return _json({ success: true });

      case 'manualSync':
        _requireRole(email, ['admin', 'executive']);
        DataSync.syncAll();
        EngagementEngine.calculateAll();
        return _json({ success: true });

      default:
        return _json({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    return _json({ success: false, error: err.message });
  }
}

// ─── Data Helpers ────────────────────────────────────────────────────────────

function _getSummary() {
  const scores = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  return {
    total:  scores.length,
    high:   scores.filter(s => s.riskLevel === 'HIGH').length,
    medium: scores.filter(s => s.riskLevel === 'MEDIUM').length,
    low:    scores.filter(s => s.riskLevel === 'LOW').length,
    trend:  _getTrend(),
  };
}

function _getTrend() {
  // ดึง 8 สัปดาห์ล่าสุดจาก ScoreHistory จริง
  const history = DB.getAll(CONFIG.SHEETS.SCORE_HISTORY);
  const byWeek  = {};

  history.forEach(row => {
    if (!byWeek[row.week]) byWeek[row.week] = [];
    byWeek[row.week].push(Number(row.engagementScore));
  });

  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, scores]) => ({
      week,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
}

function _getClassroomRanking() {
  const scores   = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  const students = DB.getAll(CONFIG.SHEETS.STUDENTS);
  const courses  = DB.getAll(CONFIG.SHEETS.COURSES);
  const enrolls  = DB.getAll(CONFIG.SHEETS.ENROLLMENTS);

  // Map studentId → classroom
  const studentClassroom = {};
  students.forEach(s => { studentClassroom[s.studentId] = s.classroom || 'ไม่ระบุ'; });

  // ถ้า student ไม่มี classroom ให้หาจาก course
  enrolls.forEach(e => {
    if (!studentClassroom[e.studentId] || studentClassroom[e.studentId] === 'ไม่ระบุ') {
      const course = courses.find(c => c.courseId === e.courseId);
      if (course && course.classroom) studentClassroom[e.studentId] = course.classroom;
    }
  });

  const byRoom = {};
  scores.forEach(s => {
    const room = studentClassroom[s.studentId] || 'ไม่ระบุ';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(Number(s.engagementScore));
  });

  return Object.entries(byRoom)
    .map(([classroom, scoresArr]) => ({
      classroom,
      avgScore:  Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length),
      count:     scoresArr.length,
      highRisk:  scoresArr.filter(v => v < CONFIG.RISK.HIGH_THRESHOLD).length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function _getScoresByRisk(riskLevel) {
  const scores   = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  const students = DB.getAll(CONFIG.SHEETS.STUDENTS);

  return scores
    .filter(s => !riskLevel || s.riskLevel === riskLevel)
    .map(s => {
      const student = students.find(st => st.studentId === s.studentId) || {};
      return { ...student, ...s };
    })
    .sort((a, b) => Number(a.engagementScore) - Number(b.engagementScore));
}

function _getStudentsByTeacher(teacherEmail) {
  const role = _getUserRole(teacherEmail);

  if (['admin', 'executive'].includes(role)) {
    return _mergeScores(DB.getAll(CONFIG.SHEETS.STUDENTS));
  }

  const myCourseIds = DB.getAll(CONFIG.SHEETS.COURSES)
    .filter(c => c.ownerId === teacherEmail)
    .map(c => c.courseId);

  const myStudentIds = new Set(
    DB.getAll(CONFIG.SHEETS.ENROLLMENTS)
      .filter(e => myCourseIds.includes(e.courseId))
      .map(e => e.studentId)
  );

  const myStudents = DB.getAll(CONFIG.SHEETS.STUDENTS)
    .filter(s => myStudentIds.has(s.studentId));

  return _mergeScores(myStudents);
}

function _mergeScores(students) {
  const scores = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  return students.map(s => {
    const score = scores.find(sc => sc.studentId === s.studentId) || {};
    return { ...s, ...score };
  });
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function _isAuthorized(email) {
  if (!email) return false;
  if (!email.endsWith(`@${CONFIG.SCHOOL_DOMAIN}`)) return false;
  // TODO: เพิ่ม JWT verification ด้วย tokeninfo endpoint ในโปรดักชัน
  return true;
}

function _getUserRole(email) {
  const teacher = DB.findOne(CONFIG.SHEETS.TEACHERS, 'email', email);
  return teacher?.role || 'teacher';
}

function _requireRole(email, allowedRoles) {
  const role = _getUserRole(email);
  if (!allowedRoles.includes(role)) {
    throw new Error(`Permission denied. Required: ${allowedRoles.join('/')}, got: ${role}`);
  }
}

function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

# FRONTEND

---

## assets/css/style.css

```css
.font-sarabun { font-family: 'Sarabun', sans-serif; }

body { animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

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

.score-bar { height: 6px; border-radius: 3px; background: #e5e7eb; overflow: hidden; }
.score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }

.toast {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  color: white;
  font-size: 0.875rem;
  animation: slideUp 0.3s ease;
  z-index: 9999;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(1rem); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## assets/js/utils.js

```javascript
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
```

---

## assets/js/auth.js

```javascript
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

async function handleCredentialResponse(response) {
  const userData = AUTH.decodeJWT(response.credential);

  const allowedDomain = 'school.ac.th'; // เปลี่ยนเป็น domain จริง
  if (!userData.email.endsWith(`@${allowedDomain}`)) {
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
```

---

## assets/js/api.js

```javascript
const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';

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
```

---

## assets/js/charts.js

```javascript
const CHARTS = {
  _instances: {},

  _destroy(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
  },

  renderPie(canvasId, { high, medium, low }) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   ['เสี่ยงสูง', 'เสี่ยงปานกลาง', 'ปกติ'],
        datasets: [{
          data:            [high, medium, low],
          backgroundColor: ['#FCA5A5', '#FDE68A', '#6EE7B7'],
          borderColor:     ['#EF4444', '#F59E0B', '#10B981'],
          borderWidth:     2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  },

  renderTrend(canvasId, trendData) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
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
        scales: { y: { min: 0, max: 100 } },
      },
    });
  },

  renderBar(canvasId, rankingData) {
    this._destroy(canvasId);
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels:   rankingData.map(d => d.classroom),
        datasets: [{
          label:           'Avg Engagement Score',
          data:            rankingData.map(d => d.avgScore),
          backgroundColor: rankingData.map(d =>
            d.avgScore >= 70 ? '#6EE7B7' :
            d.avgScore >= 40 ? '#FDE68A' : '#FCA5A5'
          ),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 100 },
          x: { ticks: { font: { family: 'Sarabun' } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  },
};
```

---

## assets/js/dashboard.js

```javascript
const DASHBOARD = {

  async init() {
    const user = AUTH.requireAuth();
    if (!user) return;

    document.getElementById('userName').textContent    = UTILS.escapeHtml(user.name);
    document.getElementById('userAvatar').src          = user.picture;
    document.getElementById('lastUpdated').textContent =
      `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;

    await Promise.all([
      this.loadSummary(),
      this.loadHighRiskTable(),
      this.loadClassroomRanking(),
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
    if (trend?.length) CHARTS.renderTrend('trendLineChart', trend);
  },

  async loadHighRiskTable() {
    const res = await API.get('getScores', { riskLevel: 'HIGH' });
    if (!res) return;

    const tbody = document.getElementById('highRiskTable');
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-green-500">✅ ไม่มีนักเรียนเสี่ยงสูงในขณะนี้</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr class="border-t border-gray-50 hover:bg-gray-50">
        <td class="px-6 py-4 font-medium">${UTILS.escapeHtml(s.fullName)}</td>
        <td class="px-6 py-4 text-gray-500">${UTILS.escapeHtml(s.classroom)}</td>
        <td class="px-6 py-4"><span class="font-bold text-red-600">${s.engagementScore}</span><span class="text-gray-400 text-xs">/100</span></td>
        <td class="px-6 py-4">${s.submissionRate}%</td>
        <td class="px-6 py-4">${s.activeDays} วัน</td>
        <td class="px-6 py-4">${UTILS.riskBadge('HIGH')}</td>
      </tr>
    `).join('');
  },

  async loadClassroomRanking() {
    const res = await API.get('getClassroomRanking');
    if (!res?.data?.length) return;

    CHARTS.renderBar('classroomBarChart', res.data);

    const tbody = document.getElementById('classroomTable');
    tbody.innerHTML = res.data.map((r, i) => `
      <tr class="border-t border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3 font-medium text-gray-400">${i + 1}</td>
        <td class="px-4 py-3 font-medium">${UTILS.escapeHtml(r.classroom)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="score-bar w-24">
              <div class="score-bar-fill" style="width:${r.avgScore}%;background:${r.avgScore >= 70 ? '#10B981' : r.avgScore >= 40 ? '#F59E0B' : '#EF4444'}"></div>
            </div>
            <span class="font-bold">${r.avgScore}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-gray-500">${r.count} คน</td>
        <td class="px-4 py-3 text-red-500 font-medium">${r.highRisk} คน</td>
      </tr>
    `).join('');
  },

  async syncNow() {
    const btn = document.getElementById('syncBtn');
    btn.textContent = '⏳ กำลัง Sync...';
    btn.disabled    = true;

    const res = await API.post('manualSync', {});
    if (res) {
      UTILS.toast('✅ Sync สำเร็จ');
      await this.init();
    } else {
      UTILS.toast('❌ Sync ไม่สำเร็จ กรุณาลองใหม่', 'error');
    }

    btn.textContent = '🔄 Sync ข้อมูล';
    btn.disabled    = false;
  },
};

document.addEventListener('DOMContentLoaded', () => DASHBOARD.init());
```

---

## assets/js/teacher.js

```javascript
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
          <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 shrink-0">
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
    document.getElementById('modalStudentId').value = studentId;
    document.getElementById('interventionNote').value = '';
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
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Student Engagement System — Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center font-sarabun">

  <div class="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
    <div class="mb-6">
      <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span class="text-white text-2xl">🎓</span>
      </div>
      <h1 class="text-2xl font-bold text-gray-800">Student Engagement</h1>
      <p class="text-gray-500 text-sm mt-1">Intelligence System</p>
    </div>

    <div id="g_id_onload"
      data-client_id="YOUR_GOOGLE_CLIENT_ID"
      data-callback="handleCredentialResponse"
      data-auto_prompt="false">
    </div>
    <div class="g_id_signin"
      data-type="standard" data-size="large"
      data-theme="outline" data-text="signin_with"
      data-shape="rectangular" data-logo_alignment="left" data-width="320">
    </div>

    <p class="text-xs text-gray-400 mt-6">เข้าสู่ระบบด้วย Google Account ของโรงเรียนเท่านั้น</p>
  </div>

  <script src="assets/js/utils.js"></script>
  <script src="assets/js/api.js"></script>
  <script src="assets/js/auth.js"></script>
</body>
</html>
```

---

## dashboard.html

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

  <nav class="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span class="text-white text-sm">🎓</span>
      </div>
      <span class="font-bold text-gray-800">Student Engagement System</span>
    </div>
    <div class="flex items-center gap-4">
      <img id="userAvatar" class="w-8 h-8 rounded-full" src="" alt="">
      <span id="userName" class="text-sm text-gray-600 hidden sm:block"></span>
      <button onclick="AUTH.logout()" class="text-sm text-red-500 hover:text-red-700">ออกจากระบบ</button>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-6 py-8">

    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">ภาพรวมโรงเรียน</h1>
        <p id="lastUpdated" class="text-sm text-gray-400 mt-1"></p>
      </div>
      <button id="syncBtn" onclick="DASHBOARD.syncNow()"
        class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
        🔄 Sync ข้อมูล
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500">นักเรียนทั้งหมด</p>
        <p id="totalStudents" class="text-3xl font-bold text-gray-800 mt-1">—</p>
      </div>
      <div class="bg-red-50 rounded-xl p-5 shadow-sm border border-red-100">
        <p class="text-sm text-red-500">🔴 เสี่ยงสูง</p>
        <p id="highRisk" class="text-3xl font-bold text-red-600 mt-1">—</p>
      </div>
      <div class="bg-yellow-50 rounded-xl p-5 shadow-sm border border-yellow-100">
        <p class="text-sm text-yellow-600">🟡 เสี่ยงปานกลาง</p>
        <p id="mediumRisk" class="text-3xl font-bold text-yellow-600 mt-1">—</p>
      </div>
      <div class="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
        <p class="text-sm text-green-600">🟢 ปกติ</p>
        <p id="lowRisk" class="text-3xl font-bold text-green-600 mt-1">—</p>
      </div>
    </div>

    <!-- Charts Row 1: Pie + Trend -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <h2 class="font-semibold text-gray-700 mb-4">สัดส่วนตามระดับความเสี่ยง</h2>
        <canvas id="riskPieChart" height="200"></canvas>
      </div>
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <h2 class="font-semibold text-gray-700 mb-4">แนวโน้ม Engagement Score</h2>
        <canvas id="trendLineChart" height="200"></canvas>
      </div>
    </div>

    <!-- Classroom Ranking -->
    <div class="bg-white rounded-xl shadow-sm mb-6">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">Ranking ห้องเรียน</h2>
      </div>
      <div class="p-6">
        <canvas id="classroomBarChart" height="120"></canvas>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">#</th>
              <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">ห้อง</th>
              <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Avg Score</th>
              <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">จำนวน</th>
              <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">เสี่ยงสูง</th>
            </tr>
          </thead>
          <tbody id="classroomTable">
            <tr><td colspan="5" class="text-center py-6 text-gray-400">กำลังโหลด...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- High Risk Table -->
    <div class="bg-white rounded-xl shadow-sm">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">นักเรียนเสี่ยงสูง (ต้องติดตามด่วน)</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
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

  <script src="assets/js/utils.js"></script>
  <script src="assets/js/auth.js"></script>
  <script src="assets/js/api.js"></script>
  <script src="assets/js/charts.js"></script>
  <script src="assets/js/dashboard.js"></script>
</body>
</html>
```

---

## teacher.html

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

  <nav class="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-lg">🎓</span>
      <span class="font-bold text-gray-800">Teacher Dashboard</span>
      <span class="text-gray-400 text-sm hidden sm:inline">—</span>
      <span id="teacherName" class="text-sm text-gray-500 hidden sm:inline"></span>
    </div>
    <button onclick="AUTH.logout()" class="text-sm text-red-500 hover:text-red-700">ออกจากระบบ</button>
  </nav>

  <div class="max-w-4xl mx-auto px-6 py-8">

    <!-- Search + Filter -->
    <div class="flex gap-3 mb-6">
      <input id="searchInput" type="text" placeholder="ค้นหาชื่อนักเรียน..."
        class="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
      <select id="riskFilter"
        class="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
        <option value="">ทุกระดับ</option>
        <option value="HIGH">🔴 เสี่ยงสูง</option>
        <option value="MEDIUM">🟡 เสี่ยงปานกลาง</option>
        <option value="LOW">🟢 ปกติ</option>
      </select>
    </div>

    <!-- Student List -->
    <div id="studentList" class="space-y-3">
      <p class="text-center text-gray-400 py-8">กำลังโหลด...</p>
    </div>
  </div>

  <!-- Intervention Modal -->
  <div id="interventionModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
    <div class="bg-white rounded-2xl p-6 w-full max-w-md">
      <h3 class="font-bold text-gray-800 mb-4">📝 บันทึกการติดตาม</h3>
      <input type="hidden" id="modalStudentId">

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-600">วิธีการติดตาม</label>
          <select id="interventionMethod" class="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none">
            <option value="call">📞 โทรศัพท์</option>
            <option value="email">📧 อีเมล</option>
            <option value="visit">🏠 เยี่ยมบ้าน</option>
            <option value="meeting">💬 พูดคุยที่โรงเรียน</option>
            <option value="other">อื่นๆ</option>
          </select>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-600">บันทึกเพิ่มเติม</label>
          <textarea id="interventionNote" rows="3"
            class="w-full border rounded-lg px-3 py-2 mt-1 text-sm resize-none focus:ring-2 focus:ring-blue-300 focus:outline-none"
            placeholder="รายละเอียดการติดตาม..."></textarea>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-600">ผลลัพธ์</label>
          <select id="interventionOutcome" class="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none">
            <option value="in_progress">⏳ อยู่ระหว่างดำเนินการ</option>
            <option value="resolved">✅ แก้ไขได้แล้ว</option>
            <option value="no_response">❌ ไม่มีการตอบสนอง</option>
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

  <script src="assets/js/utils.js"></script>
  <script src="assets/js/auth.js"></script>
  <script src="assets/js/api.js"></script>
  <script src="assets/js/teacher.js"></script>
</body>
</html>
```

---

# 🚀 Deployment Checklist

```
BACKEND (ทำก่อน — ตามลำดับ)
□ 1.  สร้าง Google Spreadsheet → copy SPREADSHEET_ID ใส่ Config.gs
□ 2.  สร้าง LINE Notify Token → ใส่ LINE_TOKEN ใน Config.gs
□ 3.  แก้ SCHOOL_DOMAIN ใน Config.gs เป็น domain จริง
□ 4.  สร้าง Apps Script Project → วางโค้ดทั้ง 9 ไฟล์
□ 5.  เปิด Advanced Services: Google Classroom API, Gmail API
□ 6.  รัน setup() → ตรวจสอบว่า Sheets ถูกสร้างครบ 9 sheets
□ 7.  รัน DataSync.syncAll() ครั้งแรก → ตรวจข้อมูลใน Sheets
□ 8.  รัน EngagementEngine.calculateAll() → ตรวจ EngagementScores
□ 9.  Deploy → Web App (Execute as: Me, Access: Anyone) → copy URL

FRONTEND (ทำหลัง backend พร้อม)
□ 10. แก้ API_URL ใน api.js ใส่ Apps Script URL จากข้อ 9
□ 11. สร้าง OAuth Client ID ใน Google Cloud Console
□ 12. แก้ YOUR_GOOGLE_CLIENT_ID ใน index.html
□ 13. แก้ allowedDomain ใน auth.js ให้ตรงกับ Config.gs
□ 14. Push ขึ้น GitHub → เปิด GitHub Pages
□ 15. เพิ่ม GitHub Pages URL เป็น Authorized origin ใน OAuth Client

ทดสอบ
□ 16. Login → ตรวจว่า redirect ถูก role
□ 17. Executive: KPI cards / Charts / Classroom Ranking / High Risk table
□ 18. Teacher: รายชื่อนักเรียน / ค้นหา-กรอง / บันทึกการติดตาม
□ 19. ตรวจ Interventions sheet ว่ามีข้อมูลหลัง saveIntervention
□ 20. รัน dailySync() manual → ตรวจว่า Notification ส่งได้
```

---

# ⚠️ Known Limitations & Next Steps

| ประเด็น | รายละเอียด | แก้ใน |
|---|---|---|
| **JWT ไม่ verify** | `_isAuthorized()` ตรวจแค่ email domain ยังไม่ call tokeninfo API | Phase 2 |
| **Apps Script rate limit** | ~30 req/นาที ถ้ามีผู้ใช้พร้อมกันมากอาจช้า | Phase 2 — เพิ่ม cache |
| **ScoreHistory เพิ่มทุก run** | ถ้ารัน weeklyScore หลายรอบต่อสัปดาห์จะมีข้อมูลซ้ำ | เพิ่ม upsert by studentId+week |
| **Classroom ≠ sheet column** | ถ้า Student ไม่มี classroom ใน sheet ต้องอาศัย course mapping | เพิ่ม UI ให้กรอกในหน้า Setup |
| **ยังไม่มี** Recommendation Engine | Module 2.1 ตาม spec | Phase 2 |
| **ยังไม่มี** Report Export PDF/Excel | Module 4 ตาม spec | Phase 2 |
| **ยังไม่มี** Student Dashboard | Optional ตาม spec | Phase 2 |
