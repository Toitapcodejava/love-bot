import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from agent import respond_stream, parse_tool_calls
from memory import rag_top_k, recent_turns, save_turn, extract_and_save
from config import settings

router = APIRouter()


class ChatIn(BaseModel):
    message: str


@router.post("/chat")
async def chat(payload: ChatIn, request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401, "unauthorized")
    user_msg = payload.message
    rag = await rag_top_k(user_msg)
    history = await recent_turns(10)
    history.append({"role": "user", "content": user_msg})
    user_turn_id = await save_turn("user", user_msg)

    async def gen():
        ai_text = ""
        tool_calls = []
        try:
            async for chunk in respond_stream(history, rag):
                if isinstance(chunk, dict) and "final" in chunk:
                    final = chunk["final"]
                    for b in final.content:
                        if getattr(b, "type", None) == "tool_use":
                            tool_calls.append({"name": b.name, "args": b.input, "id": b.id})
                    if tool_calls:
                        yield {"event": "tool", "data": json.dumps(tool_calls, ensure_ascii=False)}
                else:
                    if hasattr(chunk, "type") and chunk.type == "content_block_delta":
                        d = chunk.delta
                        if getattr(d, "type", None) == "text_delta":
                            ai_text += d.text
                            yield {"event": "text", "data": d.text}
            yield {"event": "done", "data": ""}
        finally:
            if ai_text:
                ai_turn_id = await save_turn("assistant", ai_text)
                asyncio.create_task(extract_and_save(user_msg, ai_text, ai_turn_id))

    return EventSourceResponse(gen())
