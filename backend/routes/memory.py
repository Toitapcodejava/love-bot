from fastapi import APIRouter, Request, HTTPException
from db import get_pool
from config import settings

router = APIRouter()


def _auth(request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401)


@router.get("/memory")
async def list_memories(request: Request):
    _auth(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "select id, content, tag, pinned, created_at from memories order by pinned desc, created_at desc"
        )
    return [
        {"id": str(r["id"]), "content": r["content"], "tag": r["tag"], "pinned": r["pinned"]}
        for r in rows
    ]


@router.delete("/memory/{mid}")
async def delete_memory(mid: str, request: Request):
    _auth(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("delete from memories where id=$1 and pinned=false", mid)
    return {"ok": True}
