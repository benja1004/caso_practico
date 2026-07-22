from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from .models import LogAuditoria


class LogAuditoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogAuditoria
        fields = "__all__"


class LogAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """RF-07: auditoria inmutable (solo lectura, solo admin)."""
    queryset = LogAuditoria.objects.all()
    serializer_class = LogAuditoriaSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["usuario", "accion", "modelo_afectado"]
    search_fields = ["usuario", "modelo_afectado", "detalle"]

    @action(detail=False, methods=["post"])
    def respaldo(self, request):
        from apps.appointments.models import Cita
        from apps.clinical.models import SignoVital
        from apps.patients.models import Paciente
        from apps.prescriptions.models import Prescripcion
        from apps.referrals.models import Derivacion
        resumen = {
            "pacientes": Paciente.objects.count(), "citas": Cita.objects.count(),
            "signos_vitales": SignoVital.objects.count(),
            "prescripciones": Prescripcion.objects.count(),
            "derivaciones": Derivacion.objects.count(),
            "logs": LogAuditoria.objects.count(),
        }
        if request.user.rol == "ADMIN":
            LogAuditoria.objects.create(
                usuario=request.user.username, accion="EXPORT",
                modelo_afectado="Respaldo", objeto_id="-",
                ip_address=None, detalle=str(resumen))
        return Response({"detail": "Respaldo generado (simulado).", "resumen": resumen})