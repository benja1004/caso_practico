"""
SALUDCONNECT - Configuracion Django
Semanas S01-S14: settings por entorno, seguridad, DRF, JWT, throttling.
"""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-inseguro-cambiar-en-produccion")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Terceros
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Apps locales (segun modelo final de 20 entidades)
    "apps.accounts",        # Usuario, CentroSalud, Especialidad, PerfilMedico
    "apps.patients",        # Paciente, CondicionCronica, PacienteCondicion
    "apps.schedule",        # HorarioMedico, BloqueoAgenda
    "apps.appointments",    # Cita
    "apps.clinical",        # RangoClinico, SignoVital, Alerta, RegistroOffline
    "apps.prescriptions",   # Prescripcion, DetallePrescripcion
    "apps.referrals",       # Derivacion, AdjuntoDerivacion
    "apps.audit",           # LogAuditoria + signals
    "apps.legacy",          # RegistroLegacy (staging JSP)
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # RNF-04: Auditoria inmutable de accesos con timestamp e IP
    "apps.audit.middleware.AuditMiddleware",
]

ROOT_URLCONF = "config.urls"
AUTH_USER_MODEL = "accounts.Usuario"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Base de datos: SQLite por defecto (demo local) / PostgreSQL si hay variables
# de entorno (Docker / Kubernetes) -> mismo codigo, dos despliegues.
# ---------------------------------------------------------------------------
if os.environ.get("POSTGRES_HOST"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "saludconnect"),
            "USER": os.environ.get("POSTGRES_USER", "salud"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "salud123"),
            "HOST": os.environ.get("POSTGRES_HOST", "db"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "es-pe"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# RNF-05: timeout de sesion 15 minutos
SESSION_COOKIE_AGE = 15 * 60

# Seguridad (RNF-01)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# CORS para el frontend Vite
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# ---------------------------------------------------------------------------
# DRF: JWT, paginacion por historial, throttling estricto, filtros
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
        "auth": "12/minute",  # login/MFA: holgado para la demo, sigue siendo estricto
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SALUDCONNECT API",
    "DESCRIPTION": "Portal de telemedicina para centros rurales de la sierra central.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),  # RNF-05
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
}

# ---------------------------------------------------------------------------
# RNF-03 / Infraestructura: rangos clinicos configurables.
# En Kubernetes se inyectan via ConfigMap (variables de entorno).
# ---------------------------------------------------------------------------
def _rango(env_prefix, default_min, default_max):
    return (
        float(os.environ.get(f"{env_prefix}_MIN", default_min)),
        float(os.environ.get(f"{env_prefix}_MAX", default_max)),
    )

RANGOS_CLINICOS = {
    "GLUCOSA": _rango("RANGO_GLUCOSA", 70, 140),
    "SPO2": _rango("RANGO_SPO2", 92, 100),
    "TEMPERATURA": _rango("RANGO_TEMPERATURA", 36.0, 37.5),
    "PRESION_SISTOLICA": _rango("RANGO_PSIS", 90, 140),
    "PRESION_DIASTOLICA": _rango("RANGO_PDIA", 60, 90),
}
