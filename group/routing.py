from django.urls import path
from . import consumers



websocket_urlpatterns = [
    path('update/<uuid:group_id>/', consumers.GroupUpdate.as_asgi()),
]




