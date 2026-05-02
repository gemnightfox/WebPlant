## custom_getenv
> Returns the environment variable specified
> Default value (given in arguments/parameters) only works for development (DEBUG=True)
- **Development mode (DEBUG=True)**: If no environment variable found, returns the default value given in arguments (None if no default given)
- **Production mode (DEBUG=False)**: If the environment variable is not present, raise an error (ignores any default value given in arguments)



## CustomJsonResponse
- Defaults the encoder to DjangoJSONEncoder (Objects in JsonResponse won't crash if they have Django types like: UUID, DateTimeField, ...)
- Note: To make things simpler, all default Django JsonResponse is replaced with CustomJsonResponse, even if the encoder is not required



## reusable_form_submission
- Reusable boilerplate helper function to save forms during POST requests



## CustomTokenGenerator
- Generates a token (linked to user ID and email)
- The 'purpose' argument is used to separate different tokens (eg. delete account VS disable notifications)



