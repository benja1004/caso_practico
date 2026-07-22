from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

from apps.accounts.urls import catalog_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include(catalog_urlpatterns)),
    path("api/v1/", include("apps.patients.urls")),
    path("api/v1/", include("apps.schedule.urls")),
    path("api/v1/", include("apps.appointments.urls")),
    path("api/v1/", include("apps.clinical.urls")),
    path("api/v1/", include("apps.prescriptions.urls")),
    path("api/v1/", include("apps.referrals.urls")),
    path("api/v1/", include("apps.legacy.urls")),
    path("api/v1/admin-panel/", include("apps.audit.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)