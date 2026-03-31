from .utils import get_preferences



def preferences(request):
    if not request.user.is_authenticated:
        return {}

    preferences = get_preferences(request.user)
    return {'user_preferences': preferences}




