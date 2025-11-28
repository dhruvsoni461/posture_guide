import math
from typing import Dict, Tuple, Optional
from rest_framework import exceptions


def _parse_point(raw) -> Tuple[float, float, float]:
    if isinstance(raw, dict):
        x = raw.get('x') or raw.get('X')
        y = raw.get('y') or raw.get('Y')
        conf = raw.get('confidence', raw.get('score', 1))
    elif isinstance(raw, (list, tuple)) and len(raw) >= 2:
        x, y = raw[0], raw[1]
        conf = raw[2] if len(raw) > 2 else 1
    else:
        raise exceptions.ValidationError('Invalid keypoint format')
    if x is None or y is None:
        raise exceptions.ValidationError('Keypoints must provide x and y')
    return float(x), float(y), float(conf or 0)


def _midpoint(p1, p2):
    return ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)


def compute_angles(keypoints: Dict) -> Dict[str, Optional[float]]:
    try:
        ls = _parse_point(keypoints['left_shoulder'])
        rs = _parse_point(keypoints['right_shoulder'])
        lh = _parse_point(keypoints['left_hip'])
        rh = _parse_point(keypoints['right_hip'])
        nose = _parse_point(keypoints.get('nose', keypoints.get('head', [0, 0, 0])))
    except KeyError as exc:
        raise exceptions.ValidationError(f'Missing keypoint: {exc}') from exc

    confidences = [ls[2], rs[2], lh[2], rh[2], nose[2]]
    avg_conf = sum(confidences) / len(confidences)

    shoulder_mid = _midpoint(ls, rs)
    hip_mid = _midpoint(lh, rh)

    dx = hip_mid[0] - shoulder_mid[0]
    dy = hip_mid[1] - shoulder_mid[1]
    spine_angle = abs(math.degrees(math.atan2(dx, dy)))  # relative to vertical

    nose_dx = nose[0] - shoulder_mid[0]
    neck_tilt = math.degrees(math.atan2(nose_dx, abs(dy) + 1e-6))

    if not 0 <= spine_angle <= 90:
        raise exceptions.ValidationError('Computed angle out of range')

    result = {
        'angle': round(spine_angle, 2) if avg_conf >= 0.3 else None,
        'neck_tilt': round(neck_tilt, 2) if avg_conf >= 0.3 else None,
        'score': round(avg_conf, 2),
    }
    if avg_conf < 0.3:
        result['score'] = round(avg_conf, 2)
    return result

