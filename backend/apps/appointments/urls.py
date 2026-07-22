from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import CitaViewSet

router = DefaultRouter()
router.register("citas", CitaViewSet, basename="citas")

urlpatterns = [path("", include(router.urls))]