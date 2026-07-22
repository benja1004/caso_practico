from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import DerivacionViewSet

router = DefaultRouter()
router.register("derivaciones", DerivacionViewSet, basename="derivaciones")

urlpatterns = [path("", include(router.urls))]