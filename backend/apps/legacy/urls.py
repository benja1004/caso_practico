from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import LegacyViewSet

router = DefaultRouter()
router.register("legacy", LegacyViewSet, basename="legacy")

urlpatterns = [path("", include(router.urls))]