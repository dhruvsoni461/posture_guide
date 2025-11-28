import bcrypt
import jwt
from datetime import datetime, timezone
from typing import Tuple
from django.conf import settings
from rest_framework import exceptions


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except ValueError:
        return False


def generate_token(user_id: str) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        'user_id': user_id,
        'iat': int(now.timestamp()),
        'exp': int((now + settings.JWT_EXP_DELTA).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise exceptions.AuthenticationFailed('Token expired') from exc
    except jwt.InvalidTokenError as exc:
        raise exceptions.AuthenticationFailed('Invalid token') from exc


def get_token_from_request(request) -> Tuple[str, dict]:
    auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        raise exceptions.AuthenticationFailed('Authorization header missing')
    token = auth_header.split(' ', 1)[1].strip()
    payload = decode_token(token)
    return token, payload

