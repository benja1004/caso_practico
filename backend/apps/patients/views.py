from django.db.models import Count, Max
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsOwnerOrMedico
from .models import CondicionCronica, Paciente, PacienteCondicion
from .serializers import (CondicionCronicaSerializer, PacienteCondicionSerializer,
                          PacienteSerializer)


class PacienteViewSet(viewsets.ModelViewSet):
    """ORM con annotate: total de citas y ultima cita por paciente. (Mejora 2.B + 2.C)"""
    serializer_class = PacienteSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrMedico]
    # Mejora 2.B: filtrar por condicion cronica ademas de centro_salud
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

    # Mejora 2.C — Historial consolidado del paciente
    @action(detail=True, methods=["get"])
    def historial(self, request, pk=None):
        """Devuelve TODA la info de un paciente: datos + condiciones + últimas citas + signos."""
        from apps.appointments.models import Cita
        from apps.appointments.serializers import CitaSerializer
        from apps.clinical.models import SignoVital
        from apps.clinical.serializers import SignoVitalSerializer

        p = self.get_object()
        citas = Cita.objects.filter(paciente=p).order_by("-fecha_hora")[:10]
        signos = SignoVital.objects.filter(paciente=p).order_by("-registrado_en")[:20]
        return Response({
            "paciente": PacienteSerializer(p, context={"request": request}).data,
            "citas": CitaSerializer(citas, many=True).data,
            "signos": SignoVitalSerializer(signos, many=True).data,
        })


class CondicionCronicaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CondicionCronica.objects.all()
    serializer_class = CondicionCronicaSerializer
    permission_classes = [IsAuthenticated]


class PacienteCondicionViewSet(viewsets.ModelViewSet):
    queryset = PacienteCondicion.objects.select_related("paciente", "condicion")
    serializer_class = PacienteCondicionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrMedico]
    filterset_fields = ["paciente", "condicion"]