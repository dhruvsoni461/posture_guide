from django.test import SimpleTestCase
from rest_framework.test import APIClient


class APISmokeTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_login_session_flow(self):
        signup_resp = self.client.post('/api/auth/signup/', {
            'name': 'Tester',
            'email': 'test@example.com',
            'password': 'secret123',
        }, format='json')
        self.assertEqual(signup_resp.status_code, 201)

        login_resp = self.client.post('/api/auth/login/', {
            'email': 'test@example.com',
            'password': 'secret123',
        }, format='json')
        self.assertEqual(login_resp.status_code, 200)
        token = login_resp.data['token']

        start_resp = self.client.post('/api/sessions/start/', {}, format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(start_resp.status_code, 201)
        session_id = start_resp.data['session_id']

        event_payload = {
            'label': 'Good',
            'keypoints': {
                'left_shoulder': {'x': 0.4, 'y': 0.3, 'confidence': 0.9},
                'right_shoulder': {'x': 0.6, 'y': 0.3, 'confidence': 0.9},
                'left_hip': {'x': 0.45, 'y': 0.6, 'confidence': 0.9},
                'right_hip': {'x': 0.55, 'y': 0.6, 'confidence': 0.9},
                'nose': {'x': 0.5, 'y': 0.2, 'confidence': 0.9},
            }
        }
        event_resp = self.client.post(f'/api/sessions/{session_id}/event/', event_payload, format='json')
        self.assertEqual(event_resp.status_code, 201)

        events_resp = self.client.get(f'/api/sessions/{session_id}/events/')
        self.assertEqual(events_resp.status_code, 200)
        self.assertEqual(len(events_resp.data), 1)
        self.assertIsNotNone(events_resp.data[0]['angle'])

# Create your tests here.
