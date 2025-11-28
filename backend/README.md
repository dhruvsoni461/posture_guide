# Posture Backend (In-memory Django)

Lightweight Django + DRF API that mimics a production posture-detection backend without requiring a database. State lives fully in Python dicts and can optionally persist to `data_store.json` via `PERSIST_JSON=true`.

## Quick start

```bash
python -m venv venv
. venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY="dev-secret"  # optional but recommended
python manage.py runserver 0.0.0.0:8000
```

- No migrations are required. `DATABASES` points at an in-memory placeholder so the server boots instantly.
- Data exists only in-process. To persist between restarts set `PERSIST_JSON=true` (writes to `data_store.json`).

## Environment variables

| Name | Description |
| ---- | ----------- |
| `SECRET_KEY` | JWT signing secret (defaults to `dev-secret-key-change-me`). |
| `DEBUG` | Toggle Django debug (default `true`). |
| `PERSIST_JSON` | When `true`, save/load the in-memory dicts to `data_store.json`. |
| `DATA_STORE_PATH` | Override file path for JSON persistence. |

## Example curl flow

```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ally","email":"ally@example.com","password":"secret123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ -H 'Content-Type: application/json' \
  -d '{"email":"ally@example.com","password":"secret123"}' | jq -r .token)

# Start session
SESSION=$(curl -s -X POST http://localhost:8000/api/sessions/start/ \
  -H "Authorization: Bearer $TOKEN" | jq -r .session_id)

# Send event with keypoints (server computes angles)
curl -X POST http://localhost:8000/api/sessions/$SESSION/event/ \
  -H 'Content-Type: application/json' \
  -d '{
        "label":"Good",
        "keypoints":{
          "left_shoulder":{"x":0.4,"y":0.3,"confidence":0.9},
          "right_shoulder":{"x":0.6,"y":0.3,"confidence":0.9},
          "left_hip":{"x":0.45,"y":0.6,"confidence":0.9},
          "right_hip":{"x":0.55,"y":0.6,"confidence":0.9},
          "nose":{"x":0.5,"y":0.2,"confidence":0.9}
        }
      }'

# End session
curl -X POST http://localhost:8000/api/sessions/$SESSION/end/ \
  -H 'Content-Type: application/json' \
  -d '{"total_seconds":120,"good_seconds":80,"mild_seconds":30,"bad_seconds":10}'
```

### Rejected payload example

```
curl -X POST http://localhost:8000/api/sessions/$SESSION/event/ \
  -H 'Content-Type: application/json' \
  -d '{"image":"BASE64..."}'
```

Response:

```
HTTP 400
{"detail":"Raw frame/image uploads are not allowed"}
```

## Angle computation

If `keypoints` are sent, the API:

1. Calculates mid-shoulder and mid-hip points.
2. Computes the spine angle relative to vertical (`0°` = upright) using `atan2`.
3. Estimates neck tilt using the nose offset from shoulder midpoint.
4. Validates angle range `[0, 90]` and rejects outliers.
5. If average keypoint confidence < `0.3`, the event stores `angle=null` and a low `score`.

## Authentication

- Users live in the `USERS` dict (`user_id` keys with bcrypt hashes).
- JWT contains `user_id`, signed with `SECRET_KEY`, and expires after 7 days.
- Protected endpoints require `Authorization: Bearer <token>`.

## Sessions & events

- `SESSIONS` include posture totals, pause flags, and event IDs.
- `POST /api/sessions/{id}/event/` accepts single JSON or list. More than 10 events/sec triggers `429`.
- Any payload containing `image`, `frame`, or very large strings is rejected to protect privacy.

## Calibrations & device metrics

- `POST /api/calibration/` stores user/device baselines.
- `POST /api/device_metrics/` records hints like `battery_level` or `fps` for observability.

## WebSocket streaming

Connect with a valid JWT token: `ws://localhost:8000/ws/posture/?token=<JWT>`. The server pushes live posture events (`live_posture` group) plus a short backlog.

## Testing

```bash
. venv/bin/activate
python manage.py test
```

The smoke test exercises signup → login → session → event path and verifies server-computed angles.

## Docker (optional)

```bash
docker compose up --build
```

`docker-compose.yml` runs a single web service (no DB/Redis). State remains in-memory inside the container.

## Privacy & production notes

- This prototype never accepts raw frames; only derived metrics (keypoints/angles) are processed.
- For production, swap the in-memory dicts with real Django models backed by Postgres, move JWT secrets to a vault, and replace the simple rate limiter with Redis.
- Migrating later: create Django models mirroring the dict schemas, update storage helpers to read/write via ORM, and remove `PERSIST_JSON`.
