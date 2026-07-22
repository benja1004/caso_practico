from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsMedico
from .models import Cita
from .serializers import CitaSerializer


class CitaViewSet(viewsets.ModelViewSet):
    """RF-02: agendamiento con trazabilidad (creado_por) y concurrencia."""
    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["paciente", "medico", "estado", "centro_salud"]
    ordering_fields = ["fecha_hora"]

    def get_queryset(self):
        qs = Cita.objects.select_related("paciente", "medico", "creado_por", "centro_salud")
        u = self.request.user
        if u.rol == "PACIENTE":
            # Privacidad: el paciente SOLO ve sus propias citas
            qs = qs.filter(paciente__usuario=u)
        elif u.rol == "MEDICO":
            qs = qs.filter(medico=u)
        return qs

    def perform_create(self, serializer):
        # Trazabilidad: registra SI fue creada por el propio paciente o por personal medico
        serializer.save(creado_por=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # Concurrencia real: bloquea filas del slot en transaccion + revalida
        medico_id = request.data.get("medico")
        fecha = request.data.get("fecha_hora")
        if medico_id and fecha:
            existente = (Cita.objects.select_for_update()
                         .filter(medico_id=medico_id, fecha_hora=fecha,
                                 estado__in=["PENDIENTE", "CONFIRMADA", "REPROGRAMADA"]))
            if existente.exists():
                return Response(
                    {"detail": "Horario ya no disponible (otro paciente lo tomo)."},
                    status=status.HTTP_409_CONFLICT)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def reprogramar(self, request, pk=None):
        cita = self.get_object()
        nueva = request.data.get("fecha_hora")
        if not nueva:
            return Response({"detail": "fecha_hora requerida."}, status=400)
        from datetime import datetime
        nueva_dt = datetime.fromisoformat(nueva.replace("Z", ""))
        nueva_dt = timezone.make_aware(nueva_dt) if timezone.is_naive(nueva_dt) else nueva_dt
        # Regla: reprogramar minimo 4h antes de la cita original
        if cita.fecha_hora - timezone.now() < timedelta(hours=4):
            return Response(
                {"detail": "Solo se puede reprogramar con 4+ horas de anticipacion."},
                status=400)
        if nueva_dt < timezone.now() + timedelta(hours=2):
            return Response({"detail": "La nueva fecha debe tener 2+ horas de anticipacion."},
                            status=400)
        # Validar disponibilidad del nuevo slot
        if Cita.objects.filter(medico=cita.medico, fecha_hora=nueva_dt,
                               estado__in=["PENDIENTE", "CONFIRMADA", "REPROGRAMADA"]).exclude(pk=cita.pk).exists():
            return Response({"detail": "El nuevo horario no esta disponible."}, status=409)
        cita.fecha_hora = nueva_dt
        cita.estado = Cita.Estado.REPROGRAMADA
        cita.save()
        return Response(CitaSerializer(cita).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        cita = self.get_object()
        if cita.fecha_hora - timezone.now() < timedelta(hours=4):
            return Response(
                {"detail": "Solo se puede cancelar con 4+ horas de anticipacion."},
                status=400)
        cita.estado = Cita.Estado.CANCELADA
        cita.save()
        return Response({"detail": "Cita cancelada."})

    @action(detail=False, methods=["get"])
    def semana(self, request):
        """Vista calendario: citas de la semana (lado paciente o medico)."""
        desde = timezone.now().date()
        # Lunes de esta semana
        from datetime import timedelta as td
        lunes = desde - td(days=desde.weekday())
        citas = self.get_queryset().filter(fecha_hora__date__gte=lunes,
                                          fecha_hora__date__lt=lunes + td(days=7))
        data = CitaSerializer(citas, many=True).data
        return Response({"lunes": lunes.isoformat(), "citas": data})