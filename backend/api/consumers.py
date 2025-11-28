from channels.generic.websocket import AsyncJsonWebsocketConsumer
from urllib.parse import parse_qs
from .auth_utils import decode_token
from .in_memory_store import LIVE_POSTURE_FEED


class PostureConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query = parse_qs(self.scope['query_string'].decode())
        token = query.get('token', [None])[0]
        if not token:
            await self.close(code=4001)
            return
        try:
            decode_token(token)
        except Exception:
            await self.close(code=4003)
            return
        await self.channel_layer.group_add('live_posture', self.channel_name)
        await self.accept()
        await self.send_json({'type': 'history', 'events': LIVE_POSTURE_FEED[-5:]})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('live_posture', self.channel_name)

    async def receive_json(self, content, **kwargs):
        await self.send_json({'ack': True})

    async def posture_event(self, event):
        await self.send_json({'type': 'posture', 'event': event['event']})

