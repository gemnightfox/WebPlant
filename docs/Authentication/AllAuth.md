# Authentication — django-allauth
[Back to README.md](../../README.md)

Authentication is handled by [django-allauth](https://docs.allauth.org/) with the following configuration:

- Login is **email-only** (no username field).
- Email verification is **mandatory** before a user can log in.
- Users can also sign in with **Google OAuth**.
- Changing the account email address is enabled.



## Email + Password Login

AllAuth manages the full signup → verify → login → password-reset flow. The relevant URL prefix is `/account/` (mapped in `WebPlant/urls.py`).

| Action | URL |
|---|---|
| Sign up | `/account/signup/` |
| Log in | `/account/login/` |
| Log out | `/account/logout/` |
| Password reset | `/account/password/reset/` |
| Email management | `/account/email/` |

Verification emails are sent via the configured email backend (console in dev, Resend in prod — see [Email/Anymail.md](../Email/Anymail.md)).



## Google OAuth

Google OAuth is provided by `allauth.socialaccount.providers.google`. New Google logins are automatically connected to an existing account if the email address matches (`SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True`).

### Setup (Google Cloud Console)

1. Go to **APIs & Services → Credentials** and create an OAuth 2.0 Client ID (Web application).
2. Add your domain to **Authorised JavaScript origins** and `https://<domain>/account/google/login/callback/` to **Authorised redirect URIs**.
3. Copy the **Client ID** and **Client Secret** into your `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_SECRET=your-client-secret
```

### Django Site Setup (one-time)

AllAuth uses `django.contrib.sites`. After the first migration, make sure the `Site` object in the database matches your domain (the default is `example.com`). This can be set via the Django admin at `/admin/sites/site/`.

For local development, set the site domain to `localhost:8000`.



## Custom User Model

The project uses `accounts.CustomUser` as `AUTH_USER_MODEL`. It extends Django's `AbstractUser` with email as the primary identifier.

Authentication backends registered:

1. `django.contrib.auth.backends.ModelBackend` — standard Django auth
2. `allauth.account.auth_backends.AuthenticationBackend` — AllAuth social/email auth
