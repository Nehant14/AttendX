#!/usr/bin/env python3
"""
Contract check: every endpoint the mobile app calls must exist in the backend.

Parses mobile/services/api/*.ts for apiClient.get/post/postForm('<path>') calls
and compares (method + path template) against the FastAPI OpenAPI schema.

Run from the repo root, with the backend's Python deps installed:

    cd backend && python ../scripts/check-api-contract.py

Exit code 0 = aligned, 1 = the app calls something the backend doesn't have.
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/x")  # never connects

from app.main import app  # noqa: E402

METHODS = {"get": "GET", "post": "POST", "postForm": "POST"}
CALL = re.compile(r"apiClient\.(get|post|postForm)(?:<[^>]*>)?\(\s*([`'\"])(.+?)\2", re.S)

backend = set()
for path, ops in app.openapi()["paths"].items():
    for verb in ops:
        backend.add((verb.upper(), re.sub(r"\{[^}]+\}", "{}", path)))

calls = set()
for ts in sorted((ROOT / "mobile" / "services" / "api").glob("*.ts")):
    if ts.name in ("client.ts", "mock.ts"):
        continue
    for verb, _q, raw in CALL.findall(ts.read_text()):
        tmpl = re.sub(r"\$\{[^}]+\}", "{}", raw)
        calls.add((METHODS[verb], tmpl, ts.name))

missing = [(m, p, f) for m, p, f in sorted(calls) if (m, p) not in backend]
for m, p, f in sorted(calls):
    print(f"{'OK     ' if (m, p) in backend else 'MISSING'} {m:5} {p:32} ({f})")

if missing:
    print(f"\n{len(missing)} endpoint(s) called by the app do not exist on the backend.")
    sys.exit(1)
print(f"\nAll {len(calls)} endpoints called by the mobile app exist on the backend.")
