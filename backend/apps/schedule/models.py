from datetime import datetime, time, timedelta
from django.db import models
from django.conf import settings


class HorarioMedico(models.Model):
    """Plantilla semanal recurrente del medico. Aqui se calculan los slots disponibles."""
    DIAS = [(0, "Lunes"), (1, "Martes"), (2, "Miercoles"), (3, "Jueves"),
            (4, "Viernes"), (5, "Sabado"), (6, "Domingo")]

    medico = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="horarios",
                               limit_choices_to={"rol": "MEDICO"})
    dia_semana = models.PositiveSmallIntegerField(choices=DIAS)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    duracion_cita_min = models.PositiveSmallIntegerField(default=30)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["medico", "dia_semana", "hora_inicio"]
        constraints = [
            models.UniqueConstraint(fields=["medico", "dia_semana", "hora_inicio"],
                                    name="uniq_horario_inicio"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.hora_inicio >= self.hora_fin:
            raise ValidationError("hora_inicio debe ser menor que hora_fin.")
        # Sin superposicion: ningun horario existente (activo) del mismo dia/medico
        # debe solaparse con este rango.
        qs = HorarioMedico.objects.filter(medico=self.medico, dia_semana=self.dia_semana,
                                           activo=True).exclude(pk=self.pk)
        for h in qs:
            if not (self.hora_fin <= h.hora_inicio or self.hora_inicio >= h.hora_fin):
                raise ValidationError("Existen horarios superpuestos para este dia.")

    def __str__(self):
        return f"{self.medico} - {self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"


class BloqueoAgenda(models.Model):
    """Excepciones puntuales (vacaciones, capacitaciones) sin tocar el horario base."""
    medico = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="bloqueos")
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    # Opcionales para ausencias de medio dia
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    # visible solo para medico/admin, nunca para el paciente
    motivo = models.CharField(max_length=200, blank=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.fecha_inicio > self.fecha_fin:
            raise ValidationError("fecha_inicio no puede ser posterior a fecha_fin.")
        if self.hora_inicio and self.hora_fin and self.hora_inicio >= self.hora_fin:
            raise ValidationError("hora_inicio debe ser menor que hora_fin.")

    def cubre(self, fecha, hora=None):
        if not (self.fecha_inicio <= fecha <= self.fecha_fin):
            return False
        if hora is not None and self.hora_inicio and self.hora_fin:
            return self.hora_inicio <= hora < self.hora_fin
        return True


def generar_slots(hora_inicio, hora_fin, duracion_min):
    """Devuelve lista de times separados por duracion."""
    out = []
    t = hora_inicio
    while t < hora_fin:
        out.append(t)
        minutos = ((t.hour * 60 + t.minute) + duracion_min)
        t = time(minutos // 60 % 24, minutos % 60)
    return out


def calcular_disponibilidad(medico, fecha):
    """Cruza HorarioMedico + Citas + BloqueoAgenda -> lista de slots.
    Devuelve (libres, ocupados) y respeta privacidad: el paciente no ve nombres ni motivos.
    """
    from apps.appointments.models import Cita
    dia = fecha.weekday()  # python: 0=lunes ... 6=domingo = nuestrodia
    horarios = HorarioMedico.objects.filter(medico=medico, dia_semana=dia, activo=True)
    bloqueos = list(BloqueoAgenda.objects.filter(medico=medico,
                                                 fecha_inicio__lte=fecha,
                                                 fecha_fin__gte=fecha))
    libres, ocupados = [], []
    citas = Cita.objects.filter(medico=medico, fecha_hora__date=fecha,
                                estado__in=["PENDIENTE", "CONFIRMADA", "REPROGRAMADA"])
    horas_ocupadas = {c.fecha_hora.astimezone().time() for c in citas}

    for h in horarios:
        if any(b.cubre(fecha) for b in bloqueos):
            # dia o bloque completo ese rango se omite
            continue
        for slot in generar_slots(h.hora_inicio, h.hora_fin, h.duracion_cita_min):
            ocupado_por_bloqueo = any(b.cubre(fecha, slot) for b in bloqueos)
            ocupado_por_cita = slot in horas_ocupadas
            (ocupados if (ocupado_por_cita or ocupado_por_bloqueo) else libres).append(slot.strftime("%H:%M"))
    return libres, ocupados