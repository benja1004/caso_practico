from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsMedico
from .models import Prescripcion
from .serializers import PrescripcionSerializer


class PrescripcionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescripcionSerializer
    http_method_names = ["get", "post", "head", "options"]  # inmutables tras crear
    filterset_fields = ["paciente", "medico", "cita"]
    search_fields = ["codigo_verificacion"]

    def get_permissions(self):
        return [IsMedico()] if self.action == "create" else [IsAuthenticated()]

    def get_queryset(self):
        qs = Prescripcion.objects.select_related("paciente", "medico").prefetch_related("detalles")
        if self.request.user.rol == "PACIENTE":
            qs = qs.filter(paciente__usuario=self.request.user)
        return qs

    @action(detail=False, methods=["get"])
    def verificar(self, request):
        """Verificacion publica por codigo QR."""
        codigo = request.query_params.get("codigo", "").upper()
        try:
            p = Prescripcion.objects.get(codigo_verificacion=codigo)
            data = PrescripcionSerializer(p).data
            vigente = p.vigente_hasta >= __import__("django.utils.timezone", fromlist=["now"]).now()
            return Response({"valida": True, "vigente": vigente, "receta": data})
        except Prescripcion.DoesNotExist:
            return Response({"valida": False}, status=404)