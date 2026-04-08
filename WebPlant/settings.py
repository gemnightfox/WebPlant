from pathlib import Path
import os
import sentry_sdk
from dotenv import load_dotenv
import dj_database_url
from django.core.management.utils import get_random_secret_key

load_dotenv()
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'



def get_env(env_var: str, default=None):
    if DEBUG:
        return os.getenv(env_var, default)
    else:
        result = os.getenv(env_var)
        if not result:
            raise EnvironmentError(f'{env_var} was not found within the given environment variables.')
        return result



BASE_DIR = Path(__file__).resolve().parent.parent

# Note: If no environment variable is given, the key is randomized every restart
# User is logged out every time + a message saying: 'Session data corrupted'
SECRET_KEY = get_env('DJANGO_SECRET_KEY', get_random_secret_key())

ALLOWED_HOSTS = get_env('ALLOWED_HOSTS', '').split(',') # Env variable 'ALLOWED_HOSTS' format: 'example1.com,example2.com'
if DEBUG:
    ALLOWED_HOSTS += ['127.0.0.1', 'localhost']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.sites',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',

    # 'django_ratelimit' added below
    'anymail',
    'django_celery_beat',

    'home',
    'feedback',
    'accounts', # Avoid 'account' due to conflicts with Allauth
    'notification',
    'workspace',
    'workspace_role',
    'project',
    'group',
    'task',
]

REDIS_URL = get_env('REDIS_URL')
if REDIS_URL:
    INSTALLED_APPS += ['django_ratelimit'] # Error thrown out without a valid REDIS_URL (no dummy cache allowed either)

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'SOCKET_CONNECT_TIMEOUT': 5,
                'SOCKET_TIMEOUT': 5,
                'CONNECTION_POOL_KWARGS': {'max_connections': 50},
            },
            'TIMEOUT': 60 * 5,
        }
    }

if REDIS_URL:
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
else:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BEAT_SCHEDULE = {
    'run-every-5-minutes': {
        'task': 'task.tasks.send_task_alert',
        'schedule': 60 * 5,
    }
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'WebPlant.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                
                'accounts.context_processors.preferences',
                'workspace.context_processors.workspaces',
            ],
        },
    },
]

WSGI_APPLICATION = 'WebPlant.wsgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=get_env('DATABASE_URL', 'sqlite:///db.sqlite3'),
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=not DEBUG,
    )
}

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

if DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend' # Prints to console
else:
    EMAIL_BACKEND = 'anymail.backends.resend.EmailBackend' # Actual emails are sent online

ANYMAIL = {
    'RESEND_API_KEY': get_env('RESEND_API_KEY'),
}
DEFAULT_FROM_EMAIL = get_env('DEFAULT_FROM_EMAIL', default='email@example.com')

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

SITE_ID = 1

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    X_FRAME_OPTIONS = 'DENY'
    SECURE_CONTENT_TYPE_NOSNIFF = True

ACCOUNT_CHANGE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
ACCOUNT_LOGIN_METHODS = {'email', 'username'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*', 'password2*']

SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True

ACCOUNT_LOGIN_BY_CODE_ENABLED = True
ACCOUNT_LOGIN_BY_CODE_TIMEOUT = 60 * 5
ACCOUNT_ADAPTER = 'accounts.adapters.CustomAllauthAccountAdapter'

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': get_env('GOOGLE_CLIENT_ID'),
            'secret': get_env('GOOGLE_SECRET'),
        }
    }
}

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

sentry_sdk.init(
    dsn=get_env('SENTRY_DSN'),
    traces_sample_rate=1,
    profiles_sample_rate=1,
    send_default_pii=True,
)

AUTH_USER_MODEL = 'accounts.CustomUser'

PASSWORD_RESET_TIMEOUT = 60 * 15 # 15 mins

LOGIN_URL = '/account/login/'
LOGIN_REDIRECT_URL = '/account/'
LOGOUT_REDIRECT_URL = '/account/login/'

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'




