from django.urls import path
from . import consumers



websocket_urlpatterns = [
    path('update/<uuid:task_id>/', consumers.TaskUpdate.as_asgi()),
]




