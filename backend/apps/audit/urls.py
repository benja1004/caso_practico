from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import LogAuditoriaViewSet

router = DefaultRouter()
router.register("auditoria", LogAuditoriaViewSet, basename="auditoria")

urlpatterns = [path("", include(router.urls))]