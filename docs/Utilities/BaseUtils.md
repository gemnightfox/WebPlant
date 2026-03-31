# Project Utilities — base_utils.py
[Back to README.md](../../README.md)

`base_utils.py` lives at the project root and provides shared helpers used across apps.



## `reusable_form_submission(request, form, **kwargs)`

A thin wrapper for handling POST form submissions that return a JSON response.

```python
from base_utils import reusable_form_submission

@require_POST
def my_view(request):
    return reusable_form_submission(request, MyForm, instance=obj)
```

- Instantiates `form` with `request.POST` and any extra `kwargs` (e.g. `instance`, `user`).
- Returns `JsonResponse({'status': 'success'})` on valid submission.
- Raises an `Exception` with the form errors if validation fails.

Views using this helper must be decorated with `@require_POST`.



## `CustomTokenGenerator`

Extends Django's `PasswordResetTokenGenerator` to scope tokens to a specific purpose, preventing a token generated for one action (e.g. password reset) from being reused for a different one (e.g. account deletion).

```python
from base_utils import CustomTokenGenerator

delete_account_token = CustomTokenGenerator(purpose='delete_account')

# Generate
token = delete_account_token.make_token(user)

# Verify
is_valid = delete_account_token.check_token(user, token)
```

The `purpose` string is mixed into the hash, so tokens for different purposes are always distinct even for the same user and timestamp.
