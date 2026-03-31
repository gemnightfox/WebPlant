from django.contrib import admin
from .models import CustomUser, UserPreference



admin.site.register(CustomUser)
admin.site.register(UserPreference)


