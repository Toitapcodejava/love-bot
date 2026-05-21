from routes.push import should_send_push
from datetime import datetime, timedelta


def test_block_outside_hours():
    assert should_send_push(datetime(2026, 5, 21, 15, 0), None, 0) is False


def test_allow_late_night():
    assert should_send_push(datetime(2026, 5, 21, 1, 30), None, 0) is True


def test_block_recent_push():
    now = datetime(2026, 5, 21, 1, 30)
    assert should_send_push(now, now - timedelta(hours=2), 1) is False


def test_block_cap_reached():
    assert should_send_push(datetime(2026, 5, 21, 11, 30), None, 5) is False
