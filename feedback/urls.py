from django.urls import path
from .views import dashboard, success

app_name = 'feedback'

urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('success/', success, name='success'),
]



