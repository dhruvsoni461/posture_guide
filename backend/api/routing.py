from django.urls import re_path
from .consumers import PostureConsumer

websocket_urlpatterns = [
    re_path(r'ws/posture/$', PostureConsumer.as_asgi()),
]

