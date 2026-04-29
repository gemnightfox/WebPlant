from .models import UserPreference



def get_user_preferences(user):
    user_preferences, _ = UserPreference.objects.get_or_create(user=user)
    return user_preferences





