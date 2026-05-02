from django.http import JsonResponse
import os
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.serializers.json import DjangoJSONEncoder



def custom_getenv(env_var: str, default=None):
    DEBUG = os.getenv('DJANGO_DEBUG') == 'True'
    if DEBUG:
        return os.getenv(env_var, default)
    else:
        result = os.getenv(env_var)
        if not result:
            raise EnvironmentError(f'{env_var} was not found within the given environment variables.')
        return result



class CustomJsonResponse(JsonResponse):
    def __init__(self, data, **kwargs):
        kwargs.setdefault('encoder', DjangoJSONEncoder)
        super().__init__(data, **kwargs)



# POST is required (@require_POST is used in views)
def reusable_form_submission(request, form, return_new_object=False, **kwargs):
    form_instance = form(request.POST, request.FILES, **kwargs)
    if not form_instance.is_valid():
        raise Exception(f'Error encountered during form submission. Error: {form_instance.errors}')
    
    new_object = form_instance.save()
    if return_new_object:
        return new_object
    else:
        return CustomJsonResponse({'status': 'success', 'new_object_id': new_object.id})



class CustomTokenGenerator(PasswordResetTokenGenerator):
    def __init__(self, purpose):
        super().__init__()
        self.purpose = purpose # What the token is used for, eg. 'delete_account', appended to prevent clashes between different token verifications

    def _make_hash_value(self, user, timestamp):
        return f'{self.purpose}___{timestamp}__{user.id}__{user.email}'




