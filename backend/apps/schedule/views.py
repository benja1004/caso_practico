from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsMedico
from .models import HorarioMedico, BloqueoAgenda, calcular_disponibilidad
from .serializers import HorarioMedicoSerializer, BloqueoAgendaSerializer


class HorarioMedicoViewSet(viewsets.ModelViewSet):
    """El medico configura/edita su plantilla semanal."""
    serializer_class = HorarioMedicoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["medico", "dia_semana", "activo"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsMedico()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = HorarioMedico.objects.select_related("medico")
        u = self.request.user
        if u.rol == "MEDICO":
            return qs.filter(medico=u)
        return qs

    def perform_create(self, serializer):
        serializer.save(medico=self.request.user)

    @action(detail=False, methods=["get"])
    def disponibilidad(self, request):
        """GET /horarios/disponibilidad/?medico=1&fecha=2026-07-23
        Devuelve slots libres/ocupados (booleanos, sin nombres ni motivos).
        Cruza HorarioMedico + Cita + BloqueoAgenda."""
        medico_id = request.query_params.get("medico")
        fecha = request.query_params.get("fecha")
        if not (medico_id and fecha):
            return Response({"detail": "medico y fecha son requeridos."}, status=400)
        from django.contrib.auth import get_user_model
        Usuario = get_user_model()
        try:
            medico = Usuario.objects.get(pk=medico_id, rol="MEDICO")
        except Usuario.DoesNotExist:
            return Response({"detail": "Medico no encontrado."}, status=404)
        from datetime import datetime
        f = datetime.fromisoformat(fecha).date()
        libres, ocupados = calcular_disponibilidad(medico, f)
        return Response({"fecha": fecha, "libres": libres, "ocupados": ocupados})


class BloqueoAgendaViewSet(viewsets.ModelViewSet):
    serializer_class = BloqueoAgendaSerializer
    filterset_fields = ["medico"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsMedico()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = BloqueoAgenda.objects.select_related("medico")
        u = self.request.user
        if u.rol == "MEDICO":
            return qs.filter(medico=u)
        # Paciente: solo ve bloqueos (sin motivo) de los medicos
        return qs

    def perform_create(self, serializer):
        serializer.save(medico=self.request.user)