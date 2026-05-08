// ═══════════════════════════════════════════════════════════════
//  InterventionHistory.gs
//  เพิ่มไฟล์นี้ใน Google Apps Script project แล้ว deploy ใหม่
//
//  ต้องเพิ่มใน WebApp.gs ด้วย (ใน doGet switch-case):
//    case 'getTeacherInterventions':
//      return ok(getTeacherInterventions(params.teacherEmail));
// ═══════════════════════════════════════════════════════════════

function getTeacherInterventions(teacherEmail) {
  if (!teacherEmail) return [];

  // ── ดึงข้อมูล ────────────────────────────────────────────────
  const interventions = DB.findMany(
    CONFIG.SHEETS.INTERVENTIONS,
    r => r.teacherId === teacherEmail
  );
  if (!interventions.length) return [];

  const students   = DB.getAll(CONFIG.SHEETS.STUDENTS);
  const courses    = DB.getAll(CONFIG.SHEETS.COURSES);
  const enrollments = DB.getAll(CONFIG.SHEETS.ENROLLMENTS);

  // ── Build maps ───────────────────────────────────────────────
  const studentMap = {};
  students.forEach(s => { studentMap[String(s.studentId)] = s; });

  const courseMap = {};
  courses.forEach(c => { courseMap[String(c.courseId)] = c; });

  // studentId → [courseId, ...] (เฉพาะวิชาของครูคนนี้)
  const teacherCourseIds = new Set(
    courses
      .filter(c => c.ownerId === teacherEmail)
      .map(c => String(c.courseId))
  );

  const studentCourseMap = {};
  enrollments.forEach(e => {
    const sid = String(e.studentId);
    const cid = String(e.courseId);
    if (!studentCourseMap[sid]) studentCourseMap[sid] = [];
    studentCourseMap[sid].push(cid);
  });

  // ── Join และ sort ────────────────────────────────────────────
  const result = interventions.map(i => {
    const student    = studentMap[String(i.studentId)] || {};
    // หาวิชาแรกของนักเรียนที่ครูสอน
    const courseIds  = (studentCourseMap[String(i.studentId)] || [])
      .filter(cid => teacherCourseIds.has(cid));
    const course     = courseMap[courseIds[0]] || {};

    return {
      interventionId: i.interventionId,
      studentId:   i.studentId,
      fullName:    student.fullName  || i.studentId,
      email:       student.email     || '',
      courseId:    course.courseId   || '',
      courseName:  course.courseName || '',
      method:      i.method,
      note:        i.note,
      outcome:     i.outcome,
      createdAt:   i.createdAt,
    };
  });

  // เรียงล่าสุดก่อน
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return result;
}
