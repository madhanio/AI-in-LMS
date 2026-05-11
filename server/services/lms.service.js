import dotenv from 'dotenv';
dotenv.config();

/**
 * UPGRADE 6 — LMS SERVICE
 * Mock data layer. Swap to real API by setting LMS_API_URL in .env.
 * Schema is stable — real API just replaces the mock return values.
 */
export class LmsService {
  /**
   * EXAM MODE CHECK
   * Reads EXAM_MODE_START and EXAM_MODE_END from .env (ISO 8601 datetime strings).
   * Returns true if the current time falls within the exam window.
   * Example .env:
   *   EXAM_MODE_START=2026-05-20T09:00:00
   *   EXAM_MODE_END=2026-05-20T13:00:00
   */
  isExamModeActive() {
    const start = process.env.EXAM_MODE_START;
    const end   = process.env.EXAM_MODE_END;
    if (!start || !end) return false;

    const now       = new Date();
    const startDate = new Date(start);
    const endDate   = new Date(end);

    return now >= startDate && now <= endDate;
  }

  /**
   * GET ATTENDANCE
   * Returns mock attendance records for a given roll number.
   * Schema: { subject: string, conducted: number, attended: number, percentage: number }[]
   */
  getMockAttendance(rollNumber = '') {
    // TODO: Replace with: const res = await fetch(`${process.env.LMS_API_URL}/attendance/${rollNumber}`);
    return [
      { subject: 'Computer Networks',          conducted: 45, attended: 40, percentage: 88.9 },
      { subject: 'Data Structures',            conducted: 42, attended: 35, percentage: 83.3 },
      { subject: 'Operating Systems',          conducted: 40, attended: 36, percentage: 90.0 },
      { subject: 'Software Engineering',       conducted: 38, attended: 30, percentage: 78.9 },
      { subject: 'Mathematics III',            conducted: 44, attended: 38, percentage: 86.4 },
    ];
  }

  /**
   * GET TIMETABLE
   * Returns mock weekly timetable for a given section.
   * Schema: { day: string, slots: { time: string, subject: string, room: string }[] }[]
   */
  getMockTimetable(section = 'A') {
    // TODO: Replace with: const res = await fetch(`${process.env.LMS_API_URL}/timetable?section=${section}`);
    return [
      {
        day: 'Monday',
        slots: [
          { time: '09:00–10:00', subject: 'Computer Networks',    room: 'LH-301' },
          { time: '10:00–11:00', subject: 'Data Structures',      room: 'LH-301' },
          { time: '11:15–12:15', subject: 'Operating Systems',    room: 'LH-302' },
          { time: '14:00–15:00', subject: 'Mathematics III',      room: 'LH-201' },
        ]
      },
      {
        day: 'Tuesday',
        slots: [
          { time: '09:00–10:00', subject: 'Software Engineering', room: 'LH-302' },
          { time: '10:00–11:00', subject: 'Computer Networks',    room: 'LH-303' },
          { time: '11:15–13:15', subject: 'Data Structures Lab',  room: 'Lab-1'  },
        ]
      },
      {
        day: 'Wednesday',
        slots: [
          { time: '09:00–10:00', subject: 'Operating Systems',    room: 'LH-301' },
          { time: '10:00–11:00', subject: 'Mathematics III',      room: 'LH-301' },
          { time: '11:15–13:15', subject: 'Networks Lab',         room: 'Lab-2'  },
        ]
      },
      {
        day: 'Thursday',
        slots: [
          { time: '09:00–10:00', subject: 'Data Structures',      room: 'LH-302' },
          { time: '10:00–11:00', subject: 'Software Engineering',  room: 'LH-302' },
          { time: '14:00–15:00', subject: 'Computer Networks',    room: 'LH-201' },
        ]
      },
      {
        day: 'Friday',
        slots: [
          { time: '09:00–10:00', subject: 'Mathematics III',      room: 'LH-301' },
          { time: '10:00–11:00', subject: 'Operating Systems',    room: 'LH-302' },
          { time: '11:15–12:15', subject: 'Software Engineering', room: 'LH-303' },
        ]
      },
    ];
  }

  /**
   * GET UPCOMING DEADLINES
   * Returns mock assignment/submission deadlines.
   * Schema: { title: string, subject: string, due_date: string, type: 'assignment'|'submission'|'quiz' }[]
   */
  getMockDeadlines() {
    // TODO: Replace with: const res = await fetch(`${process.env.LMS_API_URL}/deadlines`);
    const today = new Date();
    const addDays = (d) => new Date(today.getTime() + d * 86400000).toISOString().split('T')[0];

    return [
      { title: 'CN Assignment 2',           subject: 'Computer Networks',    due_date: addDays(3),  type: 'assignment' },
      { title: 'DS Lab Record Submission',  subject: 'Data Structures',      due_date: addDays(5),  type: 'submission' },
      { title: 'OS Quiz 3',                 subject: 'Operating Systems',    due_date: addDays(7),  type: 'quiz'       },
      { title: 'SE Mini Project Report',    subject: 'Software Engineering', due_date: addDays(10), type: 'submission' },
      { title: 'Maths Assignment 1',        subject: 'Mathematics III',      due_date: addDays(12), type: 'assignment' },
    ];
  }

  /**
   * GET EXAM SCHEDULE
   * Returns mock exam schedule.
   * Schema: { subject: string, date: string, time: string, venue: string }[]
   */
  getMockExamSchedule() {
    // TODO: Replace with: const res = await fetch(`${process.env.LMS_API_URL}/exams`);
    const today = new Date();
    const addDays = (d) => new Date(today.getTime() + d * 86400000).toISOString().split('T')[0];

    return [
      { subject: 'Computer Networks',    date: addDays(20), time: '09:00–12:00', venue: 'Exam Hall A' },
      { subject: 'Data Structures',      date: addDays(22), time: '09:00–12:00', venue: 'Exam Hall B' },
      { subject: 'Operating Systems',    date: addDays(24), time: '14:00–17:00', venue: 'Exam Hall A' },
      { subject: 'Software Engineering', date: addDays(26), time: '09:00–12:00', venue: 'Exam Hall C' },
      { subject: 'Mathematics III',      date: addDays(28), time: '14:00–17:00', venue: 'Exam Hall B' },
    ];
  }
}

export const lmsService = new LmsService();
