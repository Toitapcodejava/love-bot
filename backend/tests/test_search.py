import pytest
import os
os.environ.setdefault("DATABASE_URL", "postgresql://fake/fake")
os.environ.setdefault("ANTHROPIC_API_KEY", "fake")
os.environ.setdefault("VOYAGE_API_KEY", "fake")
os.environ.setdefault("APP_SHARED_KEY", "fake")
os.environ.setdefault("ADMIN_KEY", "fake")
os.environ.setdefault("SERPER_API_KEY", "fake")

from unittest.mock import patch, AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_execute_web_search_returns_formatted_string():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "organic": [
            {"title": "Doraemon tập 1", "snippet": "Nội dung hay", "link": "http://a.com"},
            {"title": "Doraemon tập 2", "snippet": "Tiếp nối", "link": "http://b.com"},
        ]
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("search.httpx.AsyncClient", return_value=mock_client):
        from search import execute_web_search
        result = await execute_web_search("doraemon manga", num_results=2)

    assert "Doraemon tập 1" in result
    assert "Nội dung hay" in result
    assert "http://a.com" in result


@pytest.mark.asyncio
async def test_execute_web_search_handles_error():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(side_effect=Exception("timeout"))

    with patch("search.httpx.AsyncClient", return_value=mock_client):
        from search import execute_web_search
        result = await execute_web_search("query")

    assert result == "Không tìm được kết quả."
