from django.urls import path
from . import views

urlpatterns = [
    path('auth/signup/', views.SignupView.as_view(), name='signup'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/me/', views.ProfileView.as_view(), name='me'),
    path('sessions/start/', views.SessionStartView.as_view(), name='session-start'),
    path('sessions/<str:session_id>/event/', views.SessionEventView.as_view(), name='session-event'),
    path('sessions/<str:session_id>/pause/', views.SessionPauseView.as_view(), name='session-pause'),
    path('sessions/<str:session_id>/resume/', views.SessionResumeView.as_view(), name='session-resume'),
    path('sessions/<str:session_id>/end/', views.SessionEndView.as_view(), name='session-end'),
    path('sessions/<str:session_id>/events/', views.SessionEventsView.as_view(), name='session-events'),
    path('users/me/sessions/', views.MySessionsView.as_view(), name='my-sessions'),
    path('calibration/', views.CalibrationView.as_view(), name='calibration'),
    path('device_metrics/', views.DeviceMetricsView.as_view(), name='device-metrics'),
]

