from datetime import datetime, timezone
from unittest.mock import patch

from app.models.meetup import Reminder


def test_list_reminders(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.reminders.list_my_reminders") as m:
            m.return_value = [Reminder(meetup_id="m1", user_id="u1",
                                        minutes_before=30, notify_at=datetime.now(timezone.utc))]
            r = client.get("/api/meetups/m1/reminders/me")
    assert r.status_code == 200
    assert r.json()[0]["minutes_before"] == 30


def test_upsert_reminder(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.reminders.upsert_reminder") as u:
            p.return_value = True
            u.return_value = Reminder(meetup_id="m1", user_id="u1",
                                       minutes_before=30, notify_at=datetime.now(timezone.utc))
            r = client.put("/api/meetups/m1/reminders/me", json={"minutes_before": 30})
    assert r.status_code == 200
    u.assert_called_with("u1", "m1", 30)


def test_delete_reminder(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.reminders.delete_reminder") as d:
            p.return_value = True
            r = client.delete("/api/meetups/m1/reminders/me/30")
    assert r.status_code == 204
    d.assert_called_with("u1", "m1", 30)
