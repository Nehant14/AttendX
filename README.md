# AttendX — Face Recognition Attendance System

`backend/` is a FastAPI + Postgres/pgvector service (runs in Docker) and `mobile/`
is an Expo / React Native app for professors. This README covers running both
together; `mobile/README.md` covers the app itself.

## Quick start: backend in Docker, app on your phone

1. **Start the backend** (PC, from the repo root):
   ```bash
   docker compose up --build -d
   ```
   Migrations run automatically. The first boot downloads the face model
   (~300 MB) into a Docker volume; watch it with `docker compose logs -f backend`.
   Check `http://localhost:8000/health` returns `{"status":"ok"}`.

2. **Find your PC's LAN IP:** `node scripts/lan-ip.js` (prints e.g. `http://192.168.1.23:8000`).
   Open that URL + `/health` in your *phone's browser*. If it doesn't load, the
   app won't connect either. Fix this first (see Troubleshooting).

3. **Run the app on the phone**
   - *Android or iOS, development:* `cd mobile && npm install && npx expo start`, then scan the QR
     code with Expo Go. The app auto-detects your PC's IP.
   - *Android APK:* `cd mobile && npx eas-cli build -p android --profile preview`. Install the
     downloaded `.apk`, open **Settings** (gear icon, also reachable from the login screen),
     enter the URL from step 2, tap **Test Health**, then **Save URL**.
   - *iOS installable build:* needs a paid Apple Developer account
     (`eas build -p ios --profile preview` with registered devices) or sideloading via Xcode.
     An APK cannot be installed on iOS.

4. **Sign up** in the app, create a class and students, enroll 4-6 face photos per
   student, add them to the class roster, then take attendance.

### Troubleshooting connectivity
- **Phone and PC must be on the same Wi-Fi.** Campus/guest networks often isolate clients.
  Use a phone hotspot instead, or on Android: `adb reverse tcp:8000 tcp:8000` and use `http://localhost:8000`.
- **Firewall:** allow inbound TCP 8000. Windows (admin PowerShell):
  `netsh advfirewall firewall add rule name="AttendX API" dir=in action=allow protocol=TCP localport=8000`.
  Linux: `sudo ufw allow 8000/tcp`. macOS: allow Docker when prompted.
- **iOS:** if requests time out, enable *Settings > AttendX > Local Network*.
- **Your IP changed** (DHCP)? Re-run `node scripts/lan-ip.js` and update it in Settings.
- **First enrollment is slow:** the model is still loading; check the backend logs.
- Plain HTTP is used for LAN development. Use HTTPS (reverse proxy) before exposing this beyond your network.

### Checks
- Backend tests: `docker compose run --rm test`
- Mobile typecheck: `cd mobile && npm run typecheck`
- App/backend route alignment: `cd backend && python ../scripts/check-api-contract.py`

---

# Backend details

Full FastAPI backend implementing the plan: enrollment, session capture,
detect → quality gate → embed → match → classify → duplicate guard →
roster cross-check, review/resolve/finalize, and audit logging.

You said
you'll pull the AI models yourself, so `insightface` and
`Silent-Face-Anti-Spoofing` weights are **not bundled**; instructions to
fetch them are below.

## What's included

```
attendance-system/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint
│   │   ├── api/                     # auth, classes, students, sessions routers
│   │   ├── core/                    # config, security (JWT/password hashing)
│   │   ├── db/                      # SQLAlchemy models + async session
│   │   ├── ml/                      # detector, quality gate, embedder, matcher, liveness
│   │   ├── services/                # enrollment, attendance pipeline, audit
│   │   ├── workers/                 # Celery task for background processing
│   │   └── schemas/                 # Pydantic request/response models
│   ├── migrations/                  # Alembic, incl. initial schema migration
│   ├── tests/                       # unit tests (matcher + quality gate — no models needed)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── docker-compose.yml               # postgres+pgvector, redis, backend, celery worker
```

## 1. Get the AI models

This backend expects `insightface`'s `buffalo_l` model pack, which
`insightface` downloads automatically on first run (to `~/.insightface/models`)
the first time `FaceAnalysis(name="buffalo_l").prepare()` is called — no
manual download needed as long as the container/machine has internet
access on first boot.

If you want to pre-fetch it or use a different pack, see:
https://github.com/deepinsight/insightface/tree/master/python-package

For **liveness detection** (optional, Phase 7 — off by default), download
the ONNX-converted **Silent-Face-Anti-Spoofing** weights and place them at
`backend/models/silent_face_anti_spoofing.onnx` (path is configurable via
the `LIVENESS_MODEL_PATH` env var). Common sources:
https://github.com/minivision-ai/Silent-Face-Anti-Spoofing

## 2. Run with Docker Compose (recommended)

```bash
docker compose up --build
```

This starts:
- `db` — Postgres 16 with the `pgvector` extension pre-installed
- `redis` — broker/result backend for Celery
- `backend` — the FastAPI app on `http://localhost:8000`
- `worker` — a Celery worker for background session processing

Migrations are applied automatically when the `backend` container starts.

API docs (Swagger UI) will be live at `http://localhost:8000/docs`.

## 3. Run locally without Docker (dev)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Make sure Postgres (with pgvector) and Redis are running locally,
# or just point DATABASE_URL at a docker-compose'd db:
#   docker compose up db redis
alembic upgrade head
uvicorn app.main:app --reload
```

With `USE_CELERY=false` (the `.env.example` default), session photos are
processed synchronously in the request that creates them — handy for
local dev without a running Celery worker. Flip it to `true` once you
have `redis` + a `celery -A app.workers.tasks.celery_app worker` process
running.

## 4. Quick walkthrough (curl)

```bash
# 1. Create a professor account
curl -X POST localhost:8000/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Rao","email":"rao@example.com","password":"supersecret1"}'
# -> copy the access_token from the response

TOKEN="<paste token here>"

# 2. Create a class
curl -X POST localhost:8000/classes -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"CS101"}'

# 3. Create a student
curl -X POST localhost:8000/students -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"roll_no":"S001","name":"Aditi Sharma"}'

# 4. Enroll photos (4-6 clear face photos of the student)
curl -X POST localhost:8000/students/S001/enroll -H "Authorization: Bearer $TOKEN" \
  -F "files=@photo1.jpg" -F "files=@photo2.jpg" -F "files=@photo3.jpg" -F "files=@photo4.jpg"

# 5. Add student to class roster
curl -X POST localhost:8000/classes/1/roster -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"student_ids":[1]}'

# 6. Upload a class photo to create a session
curl -X POST localhost:8000/sessions -H "Authorization: Bearer $TOKEN" \
  -F "class_id=1" -F "photo=@classroom.jpg"
# -> {"session_id": 1, "status": "pending"} (or "reviewed" if USE_CELERY=false, since it's synchronous)

# 7. Poll status (only needed if USE_CELERY=true)
curl localhost:8000/sessions/1/status -H "Authorization: Bearer $TOKEN"

# 8. Review detected faces + draft attendance
curl localhost:8000/sessions/1/review -H "Authorization: Bearer $TOKEN"

# 9. Resolve a flagged face (confirm or reject/reassign)
curl -X POST localhost:8000/sessions/1/resolve -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"detected_face_id":3,"action":"confirm"}'

# 10. Finalize — any still-flagged/not_detected students are marked absent
curl -X POST localhost:8000/sessions/1/finalize -H "Authorization: Bearer $TOKEN"

# 11. Audit trail
curl localhost:8000/sessions/1/audit -H "Authorization: Bearer $TOKEN"
```

## 5. Running tests (Inside Docker)

The project includes a professional, comprehensive `pytest` test suite (80+ tests) covering:
- **Auth & Security**: Password hashing, JWT token validation, expiration, tampering, signup/login APIs, and dependency guards.
- **Classes & Roster**: Class creation, student roster management, idempotency, non-existent student validation, and multi-tenant isolation.
- **Students & Enrollment**: Student creation, duplicate roll_no prevention, upload size limits (>15MB), single/multi-photo quality gates, and 512-d vector embedding storage.
- **Database & Models**: ORM schemas, unique constraints, foreign keys, and vector column properties.
- **ML Pipeline & Quality**: Quality gate algorithms, classification thresholds (`PRESENT`, `FLAGGED`, `UNMATCHED`), cosine similarity, duplicate match guard, detector tiling, IoU/NMS merging, and anti-spoofing preprocessing.
- **Business Logic**: Roster vector loading, crop saving, full `process_session` workflow, error paths, and transaction rollbacks.
- **Sessions & End-to-End Workflow**: Photo upload, status polling, review JSON payload structure, face resolution (`confirm`, `reject` with reassign), session finalization, audit logs, and complete end-to-end lifecycle integration.
- **Celery & Storage**: Celery task execution, retry handling, static media routes (`/media`, `/media/crops`), and health check.

All tests run entirely inside Docker against a **dedicated PostgreSQL test database (`test_db`)** using `NullPool` engines and per-test table truncations for 100% test isolation.

### Commands to Run Tests:

#### Option A: Run inside active container (Fastest — <1 sec startup)
```bash
docker compose exec -e DATABASE_URL=postgresql+asyncpg://attendance:attendance@test_db:5432/attendance_test backend pytest -v
```

#### Option B: Run a specific test file
```bash
docker compose exec -e DATABASE_URL=postgresql+asyncpg://attendance:attendance@test_db:5432/attendance_test backend pytest tests/test_e2e_attendance_workflow.py -v
```

#### Option C: Run in a fresh, isolated container service
```bash
docker compose run --rm test
```

## 6. Key config knobs (`backend/.env`)

| Var | Meaning |
|---|---|
| `HIGH_MATCH_THRESHOLD` / `LOW_MATCH_THRESHOLD` | Cosine-similarity cutoffs for present / flagged / unmatched |
| `MIN_FACE_SIZE_PX` / `MIN_BLUR_SCORE` | Quality-gate cutoffs before a detected face is embedded |
| `ENABLE_TILED_DETECTION` / `TILE_SIZE` / `TILE_OVERLAP` | Tiled detection for large group photos (catches small back-row faces) |
| `PRELOAD_MODELS` | `true` = load the face model in the background at boot (set in docker-compose) |
| `USE_CELERY` | `false` = process session photos synchronously inline; `true` = queue to Celery worker |

## What's NOT included (per the plan, out of scope for "backend only")

- S3/MinIO wiring for production image storage (currently local disk)
- Prometheus/Grafana monitoring
- Liveness detection weights (you fetch these yourself — see Section 1 above)

## API surface

```
POST   /auth/signup
POST   /auth/login

GET    /classes
POST   /classes
POST   /classes/{id}/roster
GET    /classes/{id}/roster

GET    /students
POST   /students
POST   /students/{roll_no}/enroll        multipart, 4-6 photos
GET    /students/{roll_no}/embeddings

GET    /sessions?class_id=&limit=        history with present/absent counts
POST   /sessions                         multipart class photo
GET    /sessions/{id}/status
GET    /sessions/{id}/review
POST   /sessions/{id}/resolve
POST   /sessions/{id}/finalize
GET    /sessions/{id}/audit

GET    /health
```
