from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (RangoClinicoViewSet, SignoVitalViewSet, AlertaViewSet,
                   RegistroOfflineViewSet)

router = DefaultRouter()
router.register("rangos", RangoClinicoViewSet, basename="rangos")
router.register("signos", SignoVitalViewSet, basename="signos")
router.register("alertas", AlertaViewSet, basename="alertas")
router.register("registros-offline", RegistroOfflineViewSet, basename="registros-offline")

urlpatterns = [path("", include(router.urls))]