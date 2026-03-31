# Email — django-anymail + Resend
[Back to README.md](../../README.md)

Email sending is abstracted by [django-anymail](https://anymail.dev/), which provides a unified interface over multiple email providers. The configured provider is **[Resend](https://resend.com)**.



## Backends

| Environment | Backend | Behaviour |
|---|---|---|
| Development (`DEBUG=True`) | `django.core.mail.backends.console.EmailBackend` | Prints emails to stdout — no mail is sent. |
| Production (`DEBUG=False`) | `anymail.backends.resend.EmailBackend` | Sends via the Resend API. |

The switch is automatic based on the `DEBUG` setting — no code change required between environments.



## Configuration

Set the following in your `.env` for production:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
DEFAULT_FROM_EMAIL=no-reply@yourdomain.com
```

`DEFAULT_FROM_EMAIL` is used as the sender for all system-generated emails (verification, password reset, notifications).



## Switching Providers

Anymail supports many providers (SendGrid, Mailgun, Postmark, etc.). To switch:

1. Install the provider's extras: `pip install django-anymail[mailgun]` (for example).
2. Change the `EMAIL_BACKEND` in `settings.py` to `anymail.backends.mailgun.EmailBackend`.
3. Replace the `ANYMAIL` settings block with the new provider's API key.

No application-level email code needs to change.
