export interface Profile { id: string; name: string; email: string; role: 'ADMIN' | 'STUDENT'; academic_first_name?: string | null; academic_last_name?: string | null }
export interface Course { id: string; name: string; class_count: number; archived_at: string | null; created_at: string }
export interface ClassItem { id: string; name: string; class_date: string; archived_at: string | null; session_id: string; session_status: string; present_count: number }
export interface AttendanceSession {
  id: string; class_id: string; class_name: string; course_id: string; course_name: string;
  effective_status: 'OPEN' | 'CLOSED' | 'EXPIRED' | 'CANCELLED'; status: string;
  started_at: string; expires_at: string; server_time: string; present_count: number;
  class_archived_at: string | null; course_archived_at: string | null;
}
export interface Qr { qrToken: string; qrUrl: string; validFrom: string; expiresAt: string; serverTime: string; rotationSeconds: number }
export interface Attempt { attemptId: string; attemptSecret: string; expiresAt: string; serverTime: string }
export interface Attendance {
  id: string; user_id: string; name: string; email: string; checked_in_at: string;
  status: 'PRESENT' | 'VOIDED'; source: 'QR' | 'MANUAL'; reason: string | null;
}
export interface Result { status: 'PRESENT' | 'ALREADY_PRESENT'; attendance: Attendance }
export interface Student { id: string; name: string; email: string }
