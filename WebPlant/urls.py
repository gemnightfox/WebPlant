from django.contrib import admin
from django.urls import path, include
from base_utils import custom_getenv
from django.conf import settings
from django.conf.urls.static import static

def trigger_error(request):
    return 1/0

URL_SECRET = custom_getenv('URL_SECRET') # Prevents users visiting a private URL (eg. /admin/ becomes /admin/shhhh-secret-value/)

urlpatterns = [
    path(f'admin/{URL_SECRET}/' if URL_SECRET else 'admin/', admin.site.urls),
    path(f'trigger-error/{URL_SECRET}/' if URL_SECRET else 'trigger-error/', trigger_error),
    path('', include('home.urls')),
    path('feedback/', include('feedback.urls')),
    path('account/', include('accounts.urls')), # Adds onto Django Allauth URLs (eg. account dashboard)
    path('account/', include('allauth.urls')),
    path('notification/', include('notification.urls')),
    path('workspace/', include('workspace.urls')),
    path('project/', include('project.urls')),
    path('group/', include('group.urls')),
    path('task/', include('task.urls')),
]



if settings.DEBUG and settings.CLOUDINARY_URL:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)





