from django.http import JsonResponse
from django.contrib.auth.tokens import PasswordResetTokenGenerator



# POST is required (@require_POST is used in views)
def reusable_form_submission(request, form, **kwargs):
    form_instance = form(request.POST, **kwargs)
    if form_instance.is_valid():
        form_instance.save()
        return JsonResponse({'status': 'success'})
    else:
        raise Exception(f'Error encountered during form submission. Error: {form_instance.errors}')



class CustomTokenGenerator(PasswordResetTokenGenerator):
    def __init__(self, purpose):
        super().__init__()
        self.purpose = purpose # What the token is used for, eg. 'delete_account', appended to prevent clashes between different token verifications

    def _make_hash_value(self, user, timestamp):
        return f'{self.purpose}___{timestamp}__{user.pk}__{user.email}'






