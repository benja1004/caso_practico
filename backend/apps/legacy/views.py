from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsMedico
from apps.patients.models import Paciente
from apps.accounts.models import Usuario, CentroSalud
from .models import RegistroLegacy
from .serializers import (RegistroLegacySerializer, ImportarCsvSerializer,
                          ValidarRegistroSerializer)


class LegacyViewSet(viewsets.ReadOnlyModelViewSet):
    """RF-09: staging del modulo JSP. El admin valida y crea el Paciente."""
    queryset = RegistroLegacy.objects.select_related("paciente_vinculado")
    serializer_class = RegistroLegacySerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["validado"]

    @action(detail=False, methods=["post"])
    def importar(self, request):
        """Recibe lotes del modulo JSP legacy (patient-sync.jsp) los encola en staging."""
        s = ImportarCsvSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        creados = 0
        for fila in s.validated_data["registros"]:
            RegistroLegacy.objects.create(
                paciente_legacy_id=str(fila.get("dni", "")), datos_csv=fila)
            creados += 1
        return Response({"importados_a_staging": creados}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def validar(self, request):
        """El admin valida cada registro: crear Paciente o rechazar."""
        s = ValidarRegistroSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        reg = RegistroLegacy.objects.get(pk=s.validated_data["registro_id"])
        accion = s.validated_data["accion"]
        if accion == "crear_paciente":
            d = reg.datos_csv
            # Crea usuario paciente vinculado
            user, _ = Usuario.objects.get_or_create(
                username=f"paciente_{d.get('dni', '')}",
                defaults={"rol": "PACIENTE", "first_name": d.get("nombres", ""),
                          "last_name": d.get("apellidos", ""),
                          "dni": d.get("dni", "")})
            centro = CentroSalud.objects.first()
            try:
                from datetime import datetime
                fnac = (datetime.fromisoformat(d.get("fecha_nacimiento"))
                        if d.get("fecha_nacimiento") else datetime(1980, 1, 1).date())
            except Exception:
                from datetime import date
                fnac = date(1980, 1, 1)
            paciente, _ = Paciente.objects.get_or_create(
                usuario=user, defaults={"fecha_nacimiento": fnac,
                                       "centro_salud_asignado": centro})
            reg.paciente_vinculado = paciente
            reg.validado = True
            reg.save()
            return Response({"detail": "Paciente creado y vinculado.",
                             "paciente_id": paciente.pk})
        # rechazar
        reg.validado = True
        reg.save()
        return Response({"detail": "Registro rechazado (no migrado)."})