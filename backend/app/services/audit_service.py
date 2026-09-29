"""
Thin helper for writing to the audit_log table. Every state-changing
action on a session (processed, resolved, finalized) should call this.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog


async def log_action(
    db: AsyncSession,
    *,
    session_id: int | None,
    action: str,
    actor: str,
    detail: dict | None = None,
) -> None:
    entry = AuditLog(session_id=session_id, action=action, actor=actor, detail=detail)
    db.add(entry)
    await db.flush()


async def get_session_audit_log(db: AsyncSession, session_id: int) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog).where(AuditLog.session_id == session_id).order_by(AuditLog.created_at)
    )
    return list(result.scalars().all())
