from django.urls import path
from channels.routing import URLRouter
import project.routing
import group.routing
import task.routing



websocket_urlpatterns = [
    path('websocket/project/', URLRouter(project.routing.websocket_urlpatterns)),
    path('websocket/group/', URLRouter(group.routing.websocket_urlpatterns)),
    path('websocket/task/', URLRouter(task.routing.websocket_urlpatterns)),
]




