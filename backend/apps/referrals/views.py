from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsMedico
from .models import Derivacion, AdjuntoDerivacion
from .serializers import DerivacionSerializer, AdjuntoDerivacionSerializer


class DerivacionViewSet(viewsets.ModelViewSet):
    serializer_class = DerivacionSerializer
    filterset_fields = ["paciente", "estado", "prioridad", "especialidad_destino",
                        "especialista_destino", "centro_origen", "centro_destino"]
    ordering_fields = ["fecha_solicitud", "prioridad"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "cambiar_estado", "adjuntos"):
            return [IsMedico()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Derivacion.objects.select_related(
            "paciente", "medico_origen", "especialista_destino",
            "especialidad_destino", "centro_origen", "centro_destino").prefetch_related("adjuntos")
        u = self.request.user
        if u.rol == "PACIENTE":
            qs = qs.filter(paciente__usuario=u)
        return qs

    def perform_create(self, serializer):
        deriv = serializer.save()
        if deriv.especialista_destino:
            from apps.audit.models import LogAuditoria
            LogAuditoria.objects.create(
                usuario=deriv.especialista_destino.username,
                accion="NOTIF", modelo_afectado="Derivacion", objeto_id=deriv.pk,
                ip_address=None, detalle=f"Nueva derivación #{deriv.pk} recibida."
            )

    @action(detail=True, methods=["post"])
    def cambiar_estado(self, request, pk=None):
        deriv = self.get_object()
        nuevo = request.data.get("estado")
        if nuevo not in Derivacion.Estado.values:
            return Response({"detail": "Estado invalido."}, status=400)
        deriv.estado = nuevo
        deriv.fecha_respuesta = timezone.now()
        deriv.save()

        # Notificar al creador de la derivación
        from apps.audit.models import LogAuditoria
        LogAuditoria.objects.create(
            usuario=deriv.medico_origen.username,
            accion="NOTIF", modelo_afectado="Derivacion", objeto_id=deriv.pk,
            ip_address=None, detalle=f"Derivación #{deriv.pk} cambió a: {nuevo}"
        )

        return Response(DerivacionSerializer(deriv).data)

    @action(detail=True, methods=["post"])
    def adjuntos(self, request, pk=None):
        """Adjuntar documentos de soporte (AdjuntoDerivacion)."""
        deriv = self.get_object()
        archivo = request.FILES.get("archivo")
        tipo = request.data.get("tipo_documento", "Adjunto")
        if not archivo:
            return Response({"detail": "archivo requerido."}, status=400)
        adj = AdjuntoDerivacion.objects.create(derivacion=deriv, archivo=archivo,
                                               tipo_documento=tipo)
        return Response(AdjuntoDerivacionSerializer(adj).data, status=status.HTTP_201_CREATED)