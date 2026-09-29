# Face Recognition Attendance System — Backend

Full FastAPI backend implementing the plan: enrollment, session capture,
detect → quality gate → embed → match → classify → duplicate guard →
roster cross-check, review/resolve/finalize, and audit logging.

This zip contains **only the backend** (mobile app scaffold is not
included — see the original implementation plan for that). You said
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

Then run migrations once the DB is up:

```bash
docker compose exec backend alembic upgrade head
```

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

## 5. Running tests

```bash
cd backend
pip install pytest
PYTHONPATH=. pytest tests/ -v
```

`tests/test_matcher.py` and `tests/test_quality.py` cover the
classification thresholds, duplicate-match guard, and quality-gate logic
with plain numpy arrays — they run without the `insightface` models
downloaded, so they're a fast way to sanity-check the matching logic in
isolation.

## 6. Key config knobs (`backend/.env`)

| Var | Meaning |
|---|---|
| `HIGH_MATCH_THRESHOLD` / `LOW_MATCH_THRESHOLD` | Cosine-similarity cutoffs for present / flagged / unmatched |
| `MIN_FACE_SIZE_PX` / `MIN_BLUR_SCORE` | Quality-gate cutoffs before a detected face is embedded |
| `ENABLE_TILED_DETECTION` / `TILE_SIZE` / `TILE_OVERLAP` | Tiled detection for large group photos (catches small back-row faces) |
| `USE_CELERY` | `false` = process session photos synchronously inline; `true` = queue to Celery worker |

## What's NOT included (per the plan, out of scope for "backend only")

- The Expo/React Native mobile app (Section 7 of the plan)
- S3/MinIO wiring for production image storage (currently local disk)
- Prometheus/Grafana monitoring
- Liveness detection weights (you fetch these yourself — see Section 1 above)

## API surface

```
POST   /auth/signup
POST   /auth/login

POST   /classes
POST   /classes/{id}/roster
GET    /classes/{id}/roster

POST   /students
POST   /students/{roll_no}/enroll        multipart, 4-6 photos
GET    /students/{roll_no}/embeddings

POST   /sessions                         multipart class photo
GET    /sessions/{id}/status
GET    /sessions/{id}/review
POST   /sessions/{id}/resolve
POST   /sessions/{id}/finalize
GET    /sessions/{id}/audit

GET    /health
```
