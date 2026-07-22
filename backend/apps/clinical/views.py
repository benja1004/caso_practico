from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsMedico
from .models import RangoClinico, SignoVital, Alerta, RegistroOffline
from .serializers import (RangoClinicoSerializer, SignoVitalSerializer,
                          AlertaSerializer, RegistroOfflineSerializer)


class RangoClinicoViewSet(viewsets.ModelViewSet):
    queryset = RangoClinico.objects.all()
    serializer_class = RangoClinicoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["tipo_signo", "condicion_cronica"]


class SignoVitalViewSet(viewsets.ModelViewSet):
    """RF-03/RF-04: registro y tendencias."""
    serializer_class = SignoVitalSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["paciente", "tipo", "origen"]
    ordering_fields = ["registrado_en", "valor"]

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsMedico()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = SignoVital.objects.select_related("paciente", "registrado_por")
        if self.request.user.rol == "PACIENTE":
            qs = qs.filter(paciente__usuario=self.request.user)
        return qs

    @action(detail=False, methods=["get"])
    def tendencias(self, request):
        paciente_id = request.query_params.get("paciente")
        qs = self.get_queryset().order_by("registrado_en")
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        tipo = request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
        series = {}
        for s in qs[:500]:
            d = s.__dict__
            punto = {"fecha": s.registrado_en.isoformat(),
                     "en_alerta": s.fuera_de_rango}
            if s.tipo == "PRESION":
                punto["sistolica"] = s.valor_sistolica
                punto["diastolica"] = s.valor_diastolica
            else:
                punto["valor"] = s.valor
            series.setdefault(s.tipo, []).append(punto)
        return Response({"paciente": paciente_id, "series": series})

    @action(detail=False, methods=["post"])
    def sincronizar_offline(self, request):
        """RNF-03: recibe registros offline y crea SignoVital + RegistroOffline."""
        datos = request.data if isinstance(request.data, list) else [request.data]
        creados = 0
        for item in datos:
            sv = SignoVital.objects.create(
                paciente_id=item.get("paciente"),
                tipo=item.get("tipo"),
                valor=item.get("valor"),
                valor_sistolica=item.get("valor_sistolica"),
                valor_diastolica=item.get("valor_diastolica"),
                unidad=item.get("unidad", ""),
                registrado_en=item.get("capturado_en"),
                registrado_por=request.user,
                origen=SignoVital.Origen.OFFLINE,
            )
            nivel = sv.nivel_alerta()
            if nivel:
                Alerta.objects.create(signo_vital=sv, nivel=nivel,
                                      mensaje=f"{sv.get_tipo_display()} offline fuera de rango")
            RegistroOffline.objects.create(
                paciente_id=sv.paciente_id, dispositivo_id=item.get("dispositivo_id", "web"),
                payload=item, capturado_en=item.get("capturado_en"),
                sincronizado=True, sincronizado_en=timezone.now(),
                signo_vital=sv,
            )
            creados += 1
        return Response({"sincronizados": creados}, status=status.HTTP_201_CREATED)


class AlertaViewSet(viewsets.ReadOnlyModelViewSet):
    """Panel del medico: alertas activas de sus pacientes."""
    serializer_class = AlertaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["nivel", "atendida"]

    def get_queryset(self):
        qs = Alerta.objects.select_related("signo_vital", "signo_vital__paciente")
        if self.request.user.rol == "PACIENTE":
            qs = qs.filter(signo_vital__paciente__usuario=self.request.user)
        return qs

    @action(detail=True, methods=["post"])
    def atender(self, request, pk=None):
        a = self.get_object()
        a.atendida = True
        a.save()
        return Response({"detail": "Alerta atendida."})


class RegistroOfflineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RegistroOffline.objects.select_related("paciente", "signo_vital")
    serializer_class = RegistroOfflineSerializer
    permission_classes = [IsAuthenticated]