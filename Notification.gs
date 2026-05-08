// ═══════════════════════════════════════════════════════════════
//  Notification.gs  —  Email only (LINE removed)
// ═══════════════════════════════════════════════════════════════

const Notification = {

  notifyHighRisk(student, score, courseName) {
    const msg = `นักเรียน ${student.fullName} มี Engagement Score ${score}/100`;
    this._notifyTeachers(student, msg, score, courseName);
  },

  _notifyTeachers(student, message, score, courseName) {
    const enrollments = DB.findMany(CONFIG.SHEETS.ENROLLMENTS, 'studentId', student.studentId);
    const courseIds   = enrollments.map(e => e.courseId);
    const courses     = DB.getAll(CONFIG.SHEETS.COURSES).filter(c => courseIds.includes(c.courseId));

    const teacherEmails = [...new Set(courses.map(c => c.ownerId).filter(Boolean))];

    teacherEmails.forEach(email => {
      this._email(email, student, score, courseName || courses.map(c => c.courseName).join(', '));
    });
  },

  _email(toEmail, student, score, courseName) {
    try {
      const subject = `⚠️ แจ้งเตือนนักเรียนเสี่ยงสูง: ${student.fullName}`;
      const body    = _buildAlertEmail(student, score, courseName);
      GmailApp.sendEmail(toEmail, subject, '', { htmlBody: body });
      Logger.log(`Email sent → ${toEmail} (${student.fullName})`);
    } catch (err) {
      Logger.log(`Email error to ${toEmail}: ${err}`);
    }
  },
};

// ───────────────────────────────────────────────────────────────
//  Wrapper — เรียกจาก doPost 'sendAlerts'
// ───────────────────────────────────────────────────────────────
function sendRiskAlertEmails(studentIds) {
  const scores   = DB.getAll(CONFIG.SHEETS.ENGAGEMENT_SCORES);
  const students = DB.getAll('Students');  // sheet ชื่อ Students

  let highRisk = scores.filter(s => {
    const score = Number(s.engagementScore);
    const risk  = s.riskLevel || (score < 40 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'LOW');
    return risk === 'HIGH';
  });

  // filter เฉพาะที่เลือกจาก modal
  if (studentIds?.length) {
    highRisk = highRisk.filter(s => studentIds.map(String).includes(String(s.studentId)));
  }

  let sentCount = 0;
  highRisk.forEach(s => {
    const student = students.find(st => String(st.studentId) === String(s.studentId));
    if (!student) return;
    Notification.notifyHighRisk(student, s.engagementScore);
    sentCount++;
  });

  Logger.log(`sendRiskAlertEmails done — ${sentCount} emails sent`);
  return sentCount;
}

// ───────────────────────────────────────────────────────────────
//  HTML Email Template
// ───────────────────────────────────────────────────────────────
function _buildAlertEmail(student, score, courseName) {
  const color     = score < 40 ? '#ef4444' : '#f59e0b';
  const riskDot   = '<span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:50%;margin-right:6px;vertical-align:middle"></span>';
  const riskBadge = riskDot + '<span style="color:#ef4444;font-weight:600">เสี่ยงสูง</span>';
  const iconBulb  = '<span style="font-weight:700;color:#1d4ed8">&gt;</span>';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">

      <div style="background:#1e3a8a;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.15);
          border-radius:12px;line-height:48px;font-size:24px;margin-bottom:12px;color:#fff;font-weight:bold">S</div>
        <h1 style="color:#fff;font-size:18px;margin:0;font-weight:bold">Student Engagement Intelligence System</h1>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:8px 0 0">แจ้งเตือนนักเรียนที่ต้องได้รับการดูแล</p>
      </div>

      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e5e7eb">
        <p style="color:#374151;font-size:14px;margin:0 0 16px">
          ระบบตรวจพบนักเรียนที่มีระดับความเสี่ยงสูงในวิชาที่คุณรับผิดชอบ
          กรุณาดำเนินการติดตามโดยเร็ว
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f9fafb">
            <td style="padding:10px 14px;color:#6b7280;width:40%;border:1px solid #e5e7eb">ชื่อนักเรียน</td>
            <td style="padding:10px 14px;font-weight:600;color:#111827;border:1px solid #e5e7eb">${student.fullName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb">Email</td>
            <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb">${student.email || '-'}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb">ห้องเรียน</td>
            <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb">${student.classroom || '-'}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb">วิชา</td>
            <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb">${courseName || '-'}</td>
          </tr>
          <tr style="background:#fef2f2">
            <td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb">Engagement Score</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb">
              <span style="color:${color};font-weight:700;font-size:20px">${score}</span>
              <span style="color:#9ca3af"> /100 &nbsp;</span>
              ${riskBadge}
            </td>
          </tr>
        </table>
      </div>

      <div style="background:#eff6ff;border-radius:8px;padding:16px;border:1px solid #bfdbfe;margin-bottom:16px">
        <p style="color:#1d4ed8;font-size:13px;margin:0">
          ${iconBulb} <strong>ขั้นตอนถัดไป:</strong> เข้าสู่ระบบที่
          <a href="https://legendary-kulfi-47f1fa.netlify.app/teacher.html" style="color:#2563eb">Teacher Dashboard</a>
          เพื่อบันทึกการติดตามและดูรายละเอียดเพิ่มเติม
        </p>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
        อีเมลนี้ส่งโดยอัตโนมัติจาก Student Engagement Intelligence System<br>
        ${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')}
      </p>
    </div>`;
}
