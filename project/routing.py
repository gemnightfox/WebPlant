from django.urls import path
from . import consumers



websocket_urlpatterns = [
    path('update/<uuid:project_id>/', consumers.ProjectUpdate.as_asgi()),
]




