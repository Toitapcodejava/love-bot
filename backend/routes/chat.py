import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from agent import respond_stream, parse_tool_calls
from memory import rag_top_k, recent_turns, save_turn, extract_and_save
from search import execute_web_search
from config import settings

router = APIRouter()

_classifier = AsyncAnthropic(api_key=settings.anthropic_api_key)

MOOD_SYSTEM = """You are a mood classifier. Given an assistant message, return JSON only.
Output format: {"mood": "<one of: neutral|annoyed|concerned|smug|warm|thinking>", "reaction_emoji": "<one emoji>"}
Rules:
- neutral: default, conversational
- annoyed: frustrated, sarcastic, impatient
- concerned: empathetic, worried about user
- smug: teasing, witty comeback
- warm: rare genuine care moment
- reaction_emoji: pick 1 emoji that fits the mood (💜 😒 😤 🥺 😏 ✨ 🙃 💙)
Return ONLY valid JSON, no explanation."""


async def classify_mood(ai_text: str) -> tuple[str, str]:
    try:
        msg = await _classifier.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            system=MOOD_SYSTEM,
            messages=[{"role": "user", "content": ai_text[:400]}],
        )
        data = json.loads(msg.content[0].text.strip())
        mood = data.get("mood", "neutral")
        emoji = data.get("reaction_emoji", "💜")
        if mood not in ("neutral", "annoyed", "concerned", "smug", "warm", "thinking"):
            mood = "neutral"
        return mood, emoji
    except Exception:
        return "neutral", "💜"


class ChatIn(BaseModel):
    message: str
    user_status: str | None = None


@router.post("/chat")
async def chat(payload: ChatIn, request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401, "unauthorized")
    user_msg = payload.message
    rag = await rag_top_k(user_msg)
    history = await recent_turns(10)
    history.append({"role": "user", "content": user_msg})
    user_turn_id = await save_turn("user", user_msg)
    pool = request.app.state.pool

    async def gen():
        ai_text = ""
        tool_calls = []
        mood_result: tuple[str, str] = ("neutral", "💜")
        current_messages = list(history)

        try:
            while True:
                async for chunk in respond_stream(current_messages, rag, payload.user_status):
                    if isinstance(chunk, dict) and "final" in chunk:
                        final = chunk["final"]
                        web_search_calls = []
                        frontend_tools = []

                        for b in final.content:
                            if getattr(b, "type", None) == "tool_use":
                                if b.name == "web_search":
                                    web_search_calls.append({"name": b.name, "args": b.input, "id": b.id})
                                else:
                                    frontend_tools.append({"name": b.name, "args": b.input, "id": b.id})
                                    tool_calls.append({"name": b.name, "args": b.input, "id": b.id})

                        if frontend_tools:
                            yield {"event": "tool", "data": json.dumps(frontend_tools, ensure_ascii=False)}

                        if web_search_calls:
                            yield {"event": "searching", "data": ""}
                            assistant_content = [
                                {"type": "tool_use", "id": c["id"], "name": c["name"], "input": c["args"]}
                                for c in web_search_calls
                            ]
                            current_messages = current_messages + [
                                {"role": "assistant", "content": assistant_content}
                            ]
                            tool_results = []
                            for c in web_search_calls:
                                search_result = await execute_web_search(
                                    c["args"]["query"],
                                    c["args"].get("num_results", 3),
                                )
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": c["id"],
                                    "content": search_result,
                                })
                            current_messages = current_messages + [
                                {"role": "user", "content": tool_results}
                            ]
                            break  # break inner for-loop, continue while-loop
                        else:
                            break
                    else:
                        if hasattr(chunk, "type") and chunk.type == "content_block_delta":
                            d = chunk.delta
                            if getattr(d, "type", None) == "text_delta":
                                ai_text += d.text
                                yield {"event": "text", "data": d.text}
                else:
                    break

            if ai_text:
                mood_result = await classify_mood(ai_text)
                mood_val, reaction_emoji = mood_result
                yield {"event": "mood", "data": json.dumps({"mood": mood_val, "reaction_emoji": reaction_emoji})}

            yield {"event": "done", "data": ""}
        finally:
            if ai_text:
                ai_turn_id = await save_turn("assistant", ai_text)
                asyncio.create_task(extract_and_save(user_msg, ai_text, ai_turn_id))
                try:
                    async with pool.acquire() as conn:
                        await conn.execute(
                            "INSERT INTO mood_snapshots (mood, trigger) VALUES ($1, $2)",
                            mood_result[0], "chat"
                        )
                except Exception:
                    pass

    return EventSourceResponse(gen())
