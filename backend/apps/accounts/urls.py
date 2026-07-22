from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (LoginView, MFAVerifyView, MeView, UsuarioViewSet,
                    CentroSaludViewSet, EspecialidadViewSet, PerfilMedicoViewSet)

# Rutas de autenticacion (montadas en /api/v1/auth/)
auth_router = DefaultRouter()
auth_router.register("usuarios", UsuarioViewSet, basename="usuarios")

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("mfa/", MFAVerifyView.as_view(), name="mfa"),
    path("me/", MeView.as_view(), name="me"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("", include(auth_router.urls)),
]

# Catalogos generales (montados en /api/v1/)
catalog_router = DefaultRouter()
catalog_router.register("centros", CentroSaludViewSet, basename="centros")
catalog_router.register("especialidades", EspecialidadViewSet, basename="especialidades")
catalog_router.register("perfiles-medico", PerfilMedicoViewSet, basename="perfiles-medico")
catalog_urlpatterns = [path("", include(catalog_router.urls))]