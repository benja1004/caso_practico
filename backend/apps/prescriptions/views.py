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
        if self.action in ("create",):
            return [IsMedico()]
        elif self.action in ("verificar", "pdf"):
            return []
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Prescripcion.objects.select_related("paciente", "medico").prefetch_related("detalles")
        user = self.request.user
        if user.is_anonymous:
            codigo = self.request.query_params.get("codigo", "")
            if codigo:
                return qs.filter(codigo_verificacion=codigo.upper())
            if self.action == "pdf":
                return qs
            return qs.none()
        if user.rol == "PACIENTE":
            qs = qs.filter(paciente__usuario=user)
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

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """PDF público (validado por codigo_verificacion en la URL)."""
        from reportlab.pdfgen import canvas as rl
        from django.http import HttpResponse
        
        p = self.get_object()
        codigo_url = request.query_params.get("codigo", "")
        if codigo_url != p.codigo_verificacion:
            return HttpResponse("Código de verificación incorrecto.", status=403)
            
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="receta_{p.codigo_verificacion}.pdf"'
        
        c = rl.Canvas(response)
        c.drawString(100, 800, f"SALUDCONNECT - Receta {p.codigo_verificacion}")
        c.drawString(100, 780, f"Paciente: {p.paciente.nombre_completo}")
        c.drawString(100, 760, f"Medico: Dr(a). {p.medico.get_full_name() or p.medico.username}")
        c.drawString(100, 740, f"Fecha emision: {p.fecha_emision.strftime('%d/%m/%Y %H:%M')}")
        c.drawString(100, 720, f"Vence: {p.vigente_hasta.strftime('%d/%m/%Y')}")
        
        y = 680
        c.drawString(100, 700, "Medicamentos:")
        for d in p.detalles.all():
            c.drawString(120, y, f"- {d.medicamento} | {d.dosis} | {d.frecuencia} | {d.duracion_dias}d")
            y -= 20
            
        c.drawString(100, y - 40, f"Firma digital (SHA-256):")
        c.drawString(100, y - 60, f"{p.firma_simulada}")
        c.showPage()
        c.save()
        return response