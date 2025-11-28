# Posture Detection Backend (DB-free)

A zero-config Django + DRF backend that mirrors the production API shape for the posture coach app but replaces the database with in-memory Python dicts (with optional JSON persistence). Authentication uses bcrypt + JWT, posture sessions live entirely in RAM, and no raw frames/images are ever accepted.

## Quick start

```bash
cd posture_backend
python -m venv .venv && source .venv/bin/activate  # optional
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

Environment variables (optional):

| Variable | Default | Description |
| --- | --- | --- |
| `SECRET_KEY` | `dev-insecure-posture-key` | JWT signing key. |
| `PERSIST_JSON` | `false` | When `true`, writes in-memory dicts to `data_store.json` on every write + shutdown. |
| `DATA_STORE_FILE` | `<repo>/data_store.json` | Custom persistence path. |
| `JWT_EXPIRATION_DAYS` | `7` | Token lifetime. |
| `PORT` | `8000` | Used only for Docker entrypoint convenience. |

> ⚠️ Data lives in-memory unless `PERSIST_JSON=true`. Server restarts wipe state.

## Example curl flow

```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jess","email":"jess@example.com","password":"secret123"}'

# Login and grab JWT
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"jess@example.com","password":"secret123"}' | jq -r .token)

# Start a session (auth optional, but token attaches ownership)
SESSION_ID=$(curl -s -X POST http://localhost:8000/api/sessions/start/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"macbook-frontcam"}' | jq -r .session_id)

# Send an event with keypoints (server computes spine angle)
curl -X POST http://localhost:8000/api/sessions/$SESSION_ID/event/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "timestamp":"2024-01-01T12:00:00Z",
    "label":"Good",
    "keypoints":{
      "left_shoulder":{"x":0.4,"y":0.2,"confidence":0.93},
      "right_shoulder":{"x":0.6,"y":0.2,"confidence":0.9},
      "left_hip":{"x":0.45,"y":0.6,"confidence":0.88},
      "right_hip":{"x":0.55,"y":0.6,"confidence":0.86},
      "nose":{"x":0.5,"y":0.12,"confidence":0.82}
    }
  }'

# End the session
curl -X POST http://localhost:8000/api/sessions/$SESSION_ID/end/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"total_seconds":300,"good_seconds":240,"mild_seconds":40,"bad_seconds":20}'
```

### Rejected payload example

No raw frames are stored. Any payload containing `image`, `frame`, or massive base64 strings receives a 400:

```bash
curl -X POST http://localhost:8000/api/sessions/$SESSION_ID/event/ \
  -H 'Content-Type: application/json' \
  -d '{"timestamp":"2024-01-01T12:00:00Z","label":"Bad","image":"<base64...>"}'
# => 400 {"detail":"Raw image/frame data is not accepted. Send keypoints only."}
```

## Project layout

```
posture_backend/
├── manage.py              # loads optional .env and runs the site
├── posture_backend/
│   ├── settings.py        # DB-less settings, Channels, DRF config
│   ├── urls.py            # api/ routes
│   ├── asgi.py            # HTTP + websocket router with JWT auth
│   └── wsgi.py
└── api/
    ├── views.py           # DRF endpoints (auth, sessions, events, metrics)
    ├── serializers.py     # Validation for requests
    ├── auth_utils.py      # bcrypt/JWT helpers, DRF + websocket auth
    ├── in_memory_store.py # Dict stores + optional JSON persistence
    ├── angle_utils.py     # Spine/neck angle math
    ├── consumers.py       # Live websocket posture channel
    ├── routing.py         # Channels url patterns
    └── tests.py           # Signup/login/session regression tests
```

## Tests

```bash
cd posture_backend
python manage.py test api
```

## Docker (optional)

```bash
cd posture_backend
docker build -t posture-backend .
docker run -p 8000:8000 posture-backend
```

or

```bash
cd posture_backend
docker-compose up --build
```

## Privacy & security notes

- **No raw frames or base64 blobs** are accepted—only structured metadata/keypoints. Requests including frame/image data are rejected with 400.
- Passwords are hashed with bcrypt but stored only in-memory; this is appropriate for demos only. For production, move to a real database (e.g., PostgreSQL), reuse the same serializers/views, and swap `USERS` dict writes with ORM calls.
- JWTs include `user_id` and expire after `JWT_EXPIRATION_DAYS` (default 7).

## Migrating to a real DB later

1. Add a proper `User` model (or extend `AbstractBaseUser`).
2. Replace `api/in_memory_store.py` lookups with ORM queries.
3. Back sessions/events with tables (same field names) and drop the rate-limit lists in favor of Redis.
4. Disable `PERSIST_JSON` and re-enable migrations.

## WebSocket quick test

```
# After logging in, connect with token
wscat -c "ws://localhost:8000/ws/posture/?token=$TOKEN"
> {"type":"posture","session_id":"$SESSION_ID","label":"Bad","ts":"2024-01-01T12:01:00Z"}
< {"status":"ok", ...}
```

## Example device metrics payload

```bash
curl -X POST http://localhost:8000/api/device_metrics/ \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"macbook-frontcam","battery_level":88,"fps":24.5}'
```

No database, no migrations—run `python manage.py runserver` and start hitting `/api/...` endpoints immediately.
