from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import PrescripcionViewSet

router = DefaultRouter()
router.register("prescripciones", PrescripcionViewSet, basename="prescripciones")

urlpatterns = [path("", include(router.urls))]