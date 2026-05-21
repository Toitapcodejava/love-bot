import pytest
import os
import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent.parent))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres.pnzezjiihjgtdfkuwngs:O0fQAvtj1xJliqdY@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres")
os.environ.setdefault("ANTHROPIC_API_KEY", "placeholder")
os.environ.setdefault("VOYAGE_API_KEY", "placeholder")
os.environ.setdefault("APP_SHARED_KEY", "placeholder")

from memory import _parse_extraction


def test_parse_extraction_valid_json():
    raw = '[{"content":"thề block nó","tag":"self"}]'
    assert _parse_extraction(raw) == [{"content": "thề block nó", "tag": "self"}]


def test_parse_extraction_empty_array():
    assert _parse_extraction("[]") == []


def test_parse_extraction_garbage_returns_empty():
    assert _parse_extraction("không có gì đáng nhớ") == []


def test_parse_extraction_strips_surrounding_text():
    raw = 'Here is the result: [{"content":"đã xóa số","tag":"event"}] done.'
    result = _parse_extraction(raw)
    assert result == [{"content": "đã xóa số", "tag": "event"}]


def test_parse_extraction_missing_required_fields():
    raw = '[{"content":"something"}]'  # missing "tag"
    assert _parse_extraction(raw) == []
