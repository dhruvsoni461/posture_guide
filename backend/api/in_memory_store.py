import atexit
import json
import threading
from pathlib import Path
from typing import Dict, Any
from django.conf import settings

DATA_LOCK = threading.Lock()

USERS: Dict[str, Dict[str, Any]] = {}
SESSIONS: Dict[str, Dict[str, Any]] = {}
EVENTS: Dict[str, Dict[str, Any]] = {}
CALIBRATIONS: Dict[str, Dict[str, Any]] = {}
DEVICE_METRICS = []
LIVE_POSTURE_FEED = []

DATA_FILE = Path(settings.DATA_STORE_PATH)


def _load_from_disk():
    if not settings.PERSIST_JSON or not DATA_FILE.exists():
        return
    try:
        raw = json.loads(DATA_FILE.read_text())
    except json.JSONDecodeError:
        return

    USERS.update(raw.get('USERS', {}))
    SESSIONS.update(raw.get('SESSIONS', {}))
    EVENTS.update(raw.get('EVENTS', {}))
    CALIBRATIONS.update(raw.get('CALIBRATIONS', {}))
    DEVICE_METRICS.extend(raw.get('DEVICE_METRICS', []))


def snapshot():
    return {
        'USERS': USERS,
        'SESSIONS': SESSIONS,
        'EVENTS': EVENTS,
        'CALIBRATIONS': CALIBRATIONS,
        'DEVICE_METRICS': DEVICE_METRICS,
    }


def persist():
    if not settings.PERSIST_JSON:
        return
    with DATA_LOCK:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        DATA_FILE.write_text(json.dumps(snapshot(), indent=2))


def save_store():
    persist()


_load_from_disk()
atexit.register(persist)

