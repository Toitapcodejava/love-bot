import pytest
import os
import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent.parent))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres.pnzezjiihjgtdfkuwngs:O0fQAvtj1xJliqdY@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres")
os.environ.setdefault("ANTHROPIC_API_KEY", "placeholder")
os.environ.setdefault("VOYAGE_API_KEY", "placeholder")
os.environ.setdefault("APP_SHARED_KEY", "placeholder")

from agent import compile_system_prompt, parse_tool_calls


def test_compile_system_includes_nickname_and_style():
    sys_prompt = compile_system_prompt(rag_memories=["mem A", "mem B"])
    assert "Kem" in sys_prompt
    assert "Tao đếm đến 3" in sys_prompt
    assert "mem A" in sys_prompt


def test_parse_tool_calls_extracts_change_theme():
    raw_blocks = [{"type": "tool_use", "name": "change_theme", "input": {"mode": "chaos"}, "id": "x"}]
    out = parse_tool_calls(raw_blocks)
    assert out == [{"name": "change_theme", "args": {"mode": "chaos"}, "id": "x"}]


def test_parse_tool_calls_handles_sdk_objects():
    class FakeTool:
        type = "tool_use"
        name = "trigger_haptic"
        input = {"pattern": "heavy"}
        id = "y"
    out = parse_tool_calls([FakeTool()])
    assert out == [{"name": "trigger_haptic", "args": {"pattern": "heavy"}, "id": "y"}]


def test_parse_tool_calls_skips_non_tool_blocks():
    raw_blocks = [{"type": "text", "text": "hello"}]
    out = parse_tool_calls(raw_blocks)
    assert out == []


def test_tools_list_includes_web_search():
    from agent import TOOLS
    names = [t["name"] for t in TOOLS]
    assert "web_search" in names

def test_web_search_tool_schema_has_required_query():
    from agent import TOOLS
    tool = next(t for t in TOOLS if t["name"] == "web_search")
    assert "query" in tool["input_schema"]["properties"]
    assert "query" in tool["input_schema"]["required"]
