from django.db.models import Count, Max
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminRole, IsOwnerOrMedico
from .models import CondicionCronica, Paciente, PacienteCondicion
from .serializers import (CondicionCronicaSerializer, PacienteCondicionSerializer,
                          PacienteSerializer)


class PacienteViewSet(viewsets.ModelViewSet):
    """ORM con annotate: total de citas y ultima cita por paciente."""
    serializer_class = PacienteSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrMedico]
    filterset_fields = ["centro_salud_asignado", "condiciones__codigo"]
    search_fields = ["usuario__username", "usuario__first_name",
                     "usuario__last_name", "usuario__dni"]

    def get_queryset(self):
        qs = Paciente.objects.select_related("usuario", "centro_salud_asignado").annotate(
            total_citas=Count("citas", distinct=True),
            ultima_cita=Max("citas__fecha_hora"),
        ).order_by("usuario__last_name", "usuario__first_name")
        if self.request.user.rol == "PACIENTE":
            qs = qs.filter(usuario=self.request.user)
        return qs


class CondicionCronicaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CondicionCronica.objects.all()
    serializer_class = CondicionCronicaSerializer
    permission_classes = [IsAuthenticated]


class PacienteCondicionViewSet(viewsets.ModelViewSet):
    queryset = PacienteCondicion.objects.select_related("paciente", "condicion")
    serializer_class = PacienteCondicionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrMedico]
    filterset_fields = ["paciente", "condicion"]