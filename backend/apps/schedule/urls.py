from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import HorarioMedicoViewSet, BloqueoAgendaViewSet

router = DefaultRouter()
router.register("horarios", HorarioMedicoViewSet, basename="horarios")
router.register("bloqueos", BloqueoAgendaViewSet, basename="bloqueos")

urlpatterns = [path("", include(router.urls))]