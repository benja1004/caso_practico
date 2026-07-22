from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import PacienteViewSet, CondicionCronicaViewSet, PacienteCondicionViewSet

router = DefaultRouter()
router.register("pacientes", PacienteViewSet, basename="pacientes")
router.register("condiciones", CondicionCronicaViewSet, basename="condiciones")
router.register("paciente-condiciones", PacienteCondicionViewSet, basename="paciente-condiciones")

urlpatterns = [path("", include(router.urls))]