import { cacheStorage } from '@/services/storage/cache';
import { ClassOut, StudentOut, DetectedFaceOut } from '@/types/api';

export const MOCK_CREDENTIALS = { email: 'test@attendx.com', password: 'test1234' };

type Res = { status: number; data: any };
const ok = (data: any, status = 200): Res => ({ status, data });
const fail = (status: number, detail: string): Res => ({ status, data: { detail } });
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NAMES = ['Aarav Sharma', 'Diya Patel', 'Rohan Verma', 'Ananya Iyer', 'Kabir Singh', 'Meera Nair'];
const students: StudentOut[] = NAMES.map((name, i) => ({
  id: i + 1, roll_no: `CS24${101 + i}`, name, created_at: now(),
}));
const classes: ClassOut[] = [
  { id: 1, name: 'CS101 - Data Structures', professor_id: 1, created_at: now() },
];
const rosters: Record<number, number[]> = { 1: students.map((s) => s.id) };

interface MockSession {
  id: number; class_id: number; date: string; polls: number; finalized: boolean;
  faces: DetectedFaceOut[]; roster: number[];
}
const sessions: Record<number, MockSession> = {};
let nextClass = 2, nextStudent = 7, nextSession = 1, nextFace = 1;

const byId = (id: number) => students.find((s) => s.id === id)!;

function buildFaces(roster: number[]): DetectedFaceOut[] {
  const faces: DetectedFaceOut[] = roster.slice(0, -1).map((sid, i) => {
    const flagged = i === 1;
    return {
      id: nextFace++,
      bbox: { x: 40 + i * 90, y: 60 + (i % 2) * 80, width: 70, height: 70 },
      det_score: 0.98, quality_passed: true, quality_reject_reason: null,
      crop_path: `https://i.pravatar.cc/150?img=${i + 10}`,
      matched_student_id: sid, matched_student_name: byId(sid).name,
      match_score: flagged ? 0.52 : 0.91,
      classification: flagged ? 'flagged' : 'present',
    };
  });
  faces.push({
    id: nextFace++, bbox: { x: 400, y: 200, width: 70, height: 70 },
    det_score: 0.9, quality_passed: true, quality_reject_reason: null,
    crop_path: 'https://i.pravatar.cc/150?img=50',
    matched_student_id: null, matched_student_name: null, match_score: null,
    classification: 'unmatched',
  });
  return faces;
}

function notDetected(s: MockSession) {
  const seen = new Set(
    s.faces.filter((f) => f.classification !== 'unmatched' && f.matched_student_id)
      .map((f) => f.matched_student_id as number)
  );
  return s.roster.filter((id) => !seen.has(id)).map((id) => ({
    student_id: id, roll_no: byId(id).roll_no, name: byId(id).name,
  }));
}

function summary(s: MockSession) {
  const nd = notDetected(s).length;
  return {
    present: s.faces.filter((f) => f.classification === 'present').length,
    flagged: s.faces.filter((f) => f.classification === 'flagged').length,
    not_detected: nd,
    absent: nd,
  };
}

async function seedCache() {
  if ((await cacheStorage.getCachedClasses()).length === 0)
    for (const c of classes) await cacheStorage.saveCachedClass(c);
  if ((await cacheStorage.getCachedStudents()).length === 0)
    for (const s of students) await cacheStorage.saveCachedStudent(s);
}

function formField(body: any, name: string): string | undefined {
  try {
    return body?.getParts?.().find((p: any) => p.fieldName === name)?.string;
  } catch {
    return undefined;
  }
}

export async function mockRequest(method: string, endpoint: string, body: any): Promise<Res> {
  await sleep(300);
  const path = endpoint.split('?')[0];
  let json: any = {};
  if (typeof body === 'string') { try { json = JSON.parse(body); } catch {} }
  let m: RegExpMatchArray | null;

  if (path === '/health') return ok({ status: 'ok (mock)' });

  if (path === '/auth/login') {
    if (json.email !== MOCK_CREDENTIALS.email || json.password !== MOCK_CREDENTIALS.password)
      return fail(401, 'Incorrect email or password');
    await seedCache();
    return ok({ access_token: 'mock-token', token_type: 'bearer', professor_id: 1, name: 'Test Professor' });
  }
  if (path === '/auth/signup') {
    await seedCache();
    return ok({ access_token: 'mock-token', token_type: 'bearer', professor_id: 1, name: json.name || 'Test Professor' });
  }

  // --- list endpoints (mirror GET /classes, /students, /sessions on the backend) ---
  if (path === '/classes' && method === 'GET') return ok([...classes].reverse());
  if (path === '/students' && method === 'GET') return ok([...students].reverse());
  if (path === '/sessions' && method === 'GET') {
    const wanted = new URLSearchParams(endpoint.split('?')[1] || '').get('class_id');
    const list = Object.values(sessions)
      .filter((s) => !wanted || s.class_id === Number(wanted))
      .sort((a, b) => b.id - a.id)
      .map((s) => {
        const sm = summary(s);
        return {
          id: s.id,
          class_id: s.class_id,
          class_name: classes.find((c) => c.id === s.class_id)?.name ?? null,
          session_date: s.date,
          status: s.finalized ? 'finalized' : 'reviewed',
          present_count: sm.present,
          absent_count: s.finalized ? s.roster.length - sm.present : 0,
        };
      });
    return ok(list);
  }

  if (path === '/classes' && method === 'POST') {
    const c: ClassOut = { id: nextClass++, name: json.name, professor_id: 1, created_at: now() };
    classes.push(c); rosters[c.id] = [];
    return ok(c, 201);
  }
  if ((m = path.match(/^\/classes\/(\d+)\/roster$/))) {
    const id = Number(m[1]);
    if (method === 'POST') {
      rosters[id] = Array.from(new Set([...(rosters[id] || []), ...(json.student_ids || [])]));
      return ok(null, 204);
    }
    return ok((rosters[id] || []).map((sid) => {
      const s = byId(sid); return { id: s.id, roll_no: s.roll_no, name: s.name };
    }));
  }

  if (path === '/students' && method === 'POST') {
    if (students.some((s) => s.roll_no === json.roll_no)) return fail(409, 'Roll number already exists');
    const s: StudentOut = { id: nextStudent++, roll_no: json.roll_no, name: json.name, created_at: now() };
    students.push(s);
    return ok(s, 201);
  }
  if ((m = path.match(/^\/students\/([^/]+)\/enroll$/))) {
    const roll = decodeURIComponent(m[1]);
    const s = students.find((x) => x.roll_no === roll);
    if (!s) return fail(404, 'Student not found');
    const n = body?.getParts?.().length ?? 3;
    const results = Array.from({ length: n }, (_, i) => ({
      filename: `photo_${i + 1}.jpg`, accepted: true, reject_reason: null, quality_score: 0.9,
    }));
    return ok({ student_id: s.id, roll_no: roll, photos_submitted: n, photos_accepted: n, results });
  }
  if ((m = path.match(/^\/students\/([^/]+)\/embeddings$/))) {
    return ok([1, 2, 3].map((id) => ({ id, quality_score: 0.9, model_version: 'mock-v1', created_at: now() })));
  }

  if (path === '/sessions' && method === 'POST') {
    const class_id = Number(formField(body, 'class_id') || 1);
    const roster = rosters[class_id]?.length ? rosters[class_id] : students.map((s) => s.id);
    const s: MockSession = {
      id: nextSession++, class_id, date: formField(body, 'session_date') || now().split('T')[0],
      polls: 0, finalized: false, faces: buildFaces(roster), roster,
    };
    sessions[s.id] = s;
    return ok({ session_id: s.id, status: 'processing' }, 201);
  }
  if ((m = path.match(/^\/sessions\/(\d+)\/(status|review|resolve|finalize|audit)$/))) {
    const s = sessions[Number(m[1])];
    if (!s) return fail(404, 'Session not found');
    const action = m[2];

    if (action === 'status') {
      s.polls++;
      const status = s.finalized ? 'finalized' : s.polls < 3 ? 'processing' : 'reviewed';
      return ok({ session_id: s.id, status, error_detail: null });
    }
    if (action === 'review') {
      return ok({
        session_id: s.id, class_id: s.class_id, session_date: s.date,
        status: s.finalized ? 'finalized' : 'reviewed',
        photo_url: 'https://picsum.photos/seed/attendx/800/600',
        faces: s.faces, not_detected: notDetected(s), summary: summary(s),
      });
    }
    if (action === 'resolve') {
      const f = s.faces.find((x) => x.id === json.detected_face_id);
      if (!f) return fail(404, 'Face not found');
      if (json.action === 'confirm') {
        const sid = json.reassign_student_id ?? f.matched_student_id;
        f.matched_student_id = sid ?? null;
        f.matched_student_name = sid ? byId(sid).name : null;
        f.classification = sid ? 'present' : 'unmatched';
      } else {
        f.matched_student_id = null; f.matched_student_name = null; f.classification = 'unmatched';
      }
      return ok({ detected_face_id: f.id, classification: f.classification, matched_student_id: f.matched_student_id });
    }
    if (action === 'finalize') {
      s.finalized = true;
      const sm = summary(s);
      return ok({
        session_id: s.id, status: 'finalized', present_count: sm.present,
        absent_count: s.roster.length - sm.present, flagged_unresolved_count: sm.flagged,
      });
    }
    if (action === 'audit') {
      return ok([{ id: 1, action: 'session_created', actor: 'Test Professor', detail: null, created_at: now() }]);
    }
  }

  return fail(404, `Mock: no handler for ${method} ${path}`);
}