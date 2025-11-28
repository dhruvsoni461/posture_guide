from collections import defaultdict, deque
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Dict, List

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status, exceptions
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_utils import hash_password, verify_password, generate_token, get_token_from_request
from .angle_utils import compute_angles
from .in_memory_store import (
    USERS,
    SESSIONS,
    EVENTS,
    CALIBRATIONS,
    DEVICE_METRICS,
    LIVE_POSTURE_FEED,
    save_store,
)

RATE_LIMITER = defaultdict(lambda: deque(maxlen=20))
FORBIDDEN_KEYS = {'image', 'frame'}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def find_user_by_email(email: str):
    for user in USERS.values():
        if user['email'] == email:
            return user
    return None


def ensure_no_raw_frames(payload: Any):
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key.lower() in FORBIDDEN_KEYS:
                raise exceptions.ValidationError('Raw frame/image uploads are not allowed')
            ensure_no_raw_frames(value)
    elif isinstance(payload, list):
        for item in payload:
            ensure_no_raw_frames(item)
    elif isinstance(payload, str) and len(payload) > 5000:
        raise exceptions.ValidationError('Payload too large - did you try to send raw frames?')


def require_auth(request):
    _, payload = get_token_from_request(request)
    user = USERS.get(payload['user_id'])
    if not user:
        raise exceptions.AuthenticationFailed('User no longer exists')
    return user


def get_session_or_404(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise exceptions.NotFound('Session not found')
    return session


def record_live_event(event):
    LIVE_POSTURE_FEED.append(event)
    del LIVE_POSTURE_FEED[:-20]
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            'live_posture',
            {'type': 'posture_event', 'event': event},
        )


class SignupView(APIView):
    def post(self, request):
        ensure_no_raw_frames(request.data)
        name = request.data.get('name')
        email = (request.data.get('email') or '').lower().strip()
        password = request.data.get('password')
        if not all([name, email, password]):
            raise exceptions.ValidationError('name, email, password are required')
        if find_user_by_email(email):
            raise exceptions.ValidationError('Email already registered')
        user_id = str(uuid4())
        USERS[user_id] = {
            'id': user_id,
            'name': name,
            'email': email,
            'password_hash': hash_password(password),
            'created_at': now_iso(),
            'settings': request.data.get('settings', {}),
        }
        save_store()
        return Response({'id': user_id, 'email': email}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    def post(self, request):
        ensure_no_raw_frames(request.data)
        email = (request.data.get('email') or '').lower().strip()
        password = request.data.get('password') or ''
        user = find_user_by_email(email)
        if not user or not verify_password(password, user['password_hash']):
            raise exceptions.AuthenticationFailed('Invalid credentials')
        token = generate_token(user['id'])
        return Response({'token': token})


class ProfileView(APIView):
    def get(self, request):
        user = require_auth(request)
        return Response({
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'created_at': user['created_at'],
            'settings': user.get('settings', {}),
        })


class SessionStartView(APIView):
    def post(self, request):
        user = None
        if 'Authorization' in request.headers:
            try:
                user = require_auth(request)
            except exceptions.AuthenticationFailed:
                user = None
        ensure_no_raw_frames(request.data)
        session_id = str(uuid4())
        session = {
            'id': session_id,
            'user_id': user['id'] if user else None,
            'device_id': request.data.get('device_id'),
            'started_at': now_iso(),
            'ended_at': None,
            'total_seconds': 0,
            'good_seconds': 0,
            'mild_seconds': 0,
            'bad_seconds': 0,
            'is_paused': False,
            'events': [],
        }
        SESSIONS[session_id] = session
        save_store()
        return Response({'session_id': session_id}, status=status.HTTP_201_CREATED)


def _validate_event_payload(event_data: Dict[str, Any]) -> Dict[str, Any]:
    ensure_no_raw_frames(event_data)
    base = {
        'id': str(uuid4()),
        'timestamp': event_data.get('timestamp') or now_iso(),
        'label': event_data.get('label', 'unknown'),
        'score': event_data.get('score'),
        'angle': event_data.get('angle'),
        'metadata': event_data.get('metadata', {}),
    }

    keypoints = event_data.get('keypoints')
    if keypoints:
        angles = compute_angles(keypoints)
        base.update(angles)
        base['keypoints'] = keypoints
    else:
        angle = base.get('angle')
        if angle is not None and not 0 <= float(angle) <= 90:
            raise exceptions.ValidationError('Angle must be between 0 and 90 degrees')
    return base


def _enforce_rate_limit(session_id: str, events_count: int):
    window = RATE_LIMITER[session_id]
    now = datetime.now(timezone.utc).timestamp()
    while window and now - window[0] > 1:
        window.popleft()
    if len(window) + events_count > 10:
        raise Throttled(detail='Too many events per second', wait=1)
    for _ in range(events_count):
        window.append(now)


class SessionEventView(APIView):
    def post(self, request, session_id):
        session = get_session_or_404(session_id)
        if session['is_paused']:
            raise exceptions.ValidationError('Session is paused. Resume before sending events.')
        payload = request.data
        if isinstance(payload, list):
            events_payload = payload
        else:
            events_payload = [payload]
        _enforce_rate_limit(session_id, len(events_payload))
        created = []
        for event_data in events_payload:
            event = _validate_event_payload(event_data)
            EVENTS[event['id']] = {**event, 'session_id': session_id}
            session['events'].append(event['id'])
            created.append(event['id'])
            record_live_event({'session_id': session_id, **event})
        save_store()
        return Response({'stored_events': len(created)}, status=status.HTTP_201_CREATED)


class SessionPauseView(APIView):
    def post(self, request, session_id):
        session = get_session_or_404(session_id)
        session['is_paused'] = True
        save_store()
        return Response({'session_id': session_id, 'is_paused': True})


class SessionResumeView(APIView):
    def post(self, request, session_id):
        session = get_session_or_404(session_id)
        session['is_paused'] = False
        save_store()
        return Response({'session_id': session_id, 'is_paused': False})


class SessionEndView(APIView):
    def post(self, request, session_id):
        session = get_session_or_404(session_id)
        ensure_no_raw_frames(request.data)
        session['ended_at'] = now_iso()
        session['total_seconds'] = request.data.get('total_seconds') or len(session['events'])
        session['good_seconds'] = request.data.get('good_seconds', 0)
        session['mild_seconds'] = request.data.get('mild_seconds', 0)
        session['bad_seconds'] = request.data.get('bad_seconds', 0)
        save_store()
        return Response({'session_id': session_id, 'ended': True})


class MySessionsView(APIView):
    def get(self, request):
        user = require_auth(request)
        user_sessions = [s for s in SESSIONS.values() if s.get('user_id') == user['id']]
        return Response(user_sessions)


class SessionEventsView(APIView):
    def get(self, request, session_id):
        session = get_session_or_404(session_id)
        events = [EVENTS[eid] for eid in session['events']]
        return Response(events)


class CalibrationView(APIView):
    def get(self, request):
        user = require_auth(request)
        calibs = [c for c in CALIBRATIONS.values() if c['user_id'] == user['id']]
        return Response(calibs)

    def post(self, request):
        user = require_auth(request)
        ensure_no_raw_frames(request.data)
        calibration_id = str(uuid4())
        CALIBRATIONS[calibration_id] = {
            'id': calibration_id,
            'user_id': user['id'],
            'device_id': request.data.get('device_id'),
            'baseline_angle': request.data.get('baseline_angle'),
            'created_at': now_iso(),
        }
        save_store()
        return Response({'calibration_id': calibration_id}, status=status.HTTP_201_CREATED)


class DeviceMetricsView(APIView):
    def post(self, request):
        ensure_no_raw_frames(request.data)
        entry = {
            'id': str(uuid4()),
            'timestamp': now_iso(),
            'battery_level': request.data.get('battery_level'),
            'fps': request.data.get('fps'),
            'device_id': request.data.get('device_id'),
        }
        DEVICE_METRICS.append(entry)
        save_store()
        return Response({'stored': True}, status=status.HTTP_201_CREATED)

# Create your views here.
