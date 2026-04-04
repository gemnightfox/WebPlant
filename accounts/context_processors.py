from .utils import get_user_preferences



def preferences(request):
    if not request.user.is_authenticated:
        return {}

    preferences = get_user_preferences(request.user)
    return {'user_preferences': preferences}




