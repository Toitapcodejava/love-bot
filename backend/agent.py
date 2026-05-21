import json
from anthropic import AsyncAnthropic
from config import settings, load_seed, load_style, load_prompt

_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

TOOLS = [
    {
        "name": "change_theme",
        "description": "Đổi theme app",
        "input_schema": {
            "type": "object",
            "properties": {"mode": {"type": "string", "enum": ["chaos", "dark", "calm", "red_alert"]}},
            "required": ["mode"],
        },
    },
    {
        "name": "trigger_haptic",
        "description": "Rung máy",
        "input_schema": {
            "type": "object",
            "properties": {"pattern": {"type": "string", "enum": ["heavy", "double", "long"]}},
            "required": ["pattern"],
        },
    },
    {
        "name": "suggest_song",
        "description": "Gợi nhạc theo mood",
        "input_schema": {
            "type": "object",
            "properties": {
                "mood": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["mood", "query"],
        },
    },
    {
        "name": "memory_save",
        "description": "Lưu memory dài hạn explicit",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string"},
                "tag": {"type": "string"},
            },
            "required": ["content", "tag"],
        },
    },
]


def compile_system_prompt(rag_memories: list[str]) -> str:
    seed = load_seed()
    style = load_style()
    base = load_prompt("persona_base")
    nickname = seed["user"]["nickname"]
    red = "\n".join(f"- {r}" for r in seed["red_lines"])
    seed_dump = json.dumps(seed, ensure_ascii=False, indent=2)
    rag_block = "\n".join(f"- {m}" for m in rag_memories) or "(chưa có)"
    return base.format(
        nickname=nickname,
        red_lines_compiled=red,
        seed_compiled=seed_dump,
        style_md=style,
        rag_memories=rag_block,
    )


def parse_tool_calls(blocks: list) -> list[dict]:
    out = []
    for b in blocks:
        if isinstance(b, dict):
            if b.get("type") == "tool_use":
                out.append({"name": b["name"], "args": b["input"], "id": b["id"]})
        else:
            if getattr(b, "type", None) == "tool_use":
                out.append({"name": b.name, "args": b.input, "id": b.id})
    return out


async def respond_stream(messages: list[dict], rag_memories: list[str]):
    system = compile_system_prompt(rag_memories)
    async with _client.messages.stream(
        model=settings.chat_model,
        max_tokens=512,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    ) as stream:
        async for chunk in stream:
            yield chunk
        final = await stream.get_final_message()
        yield {"final": final}
