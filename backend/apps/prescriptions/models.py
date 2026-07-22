import hashlib
import uuid
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


class Prescripcion(models.Model):
    """RF-05: receta digital con firma simulada y codigo de verificacion QR."""
    cita = models.ForeignKey("appointments.Cita", on_delete=models.SET_NULL,
                             null=True, blank=True, related_name="prescripciones")
    medico = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               related_name="prescripciones_emitidas",
                               limit_choices_to={"rol": "MEDICO"})
    paciente = models.ForeignKey("patients.Paciente", on_delete=models.CASCADE,
                                 related_name="prescripciones")
    firma_simulada = models.CharField(max_length=64, editable=False)
    codigo_verificacion = models.CharField(max_length=12, unique=True, editable=False)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    vigente_hasta = models.DateTimeField()  # default 30 dias

    class Meta:
        ordering = ["-fecha_emision"]

    def save(self, *args, **kwargs):
        if not self.codigo_verificacion:
            self.codigo_verificacion = uuid.uuid4().hex[:12].upper()
        if not self.fecha_emision:
            self.fecha_emision = timezone.now()
        if not self.vigente_hasta:
            self.vigente_hasta = self.fecha_emision + timedelta(days=30)
        if not self.firma_simulada:
            data = (f"{self.medico_id}|{self.paciente_id}|{self.codigo_verificacion}"
                    f"|{self.fecha_emision}")
            self.firma_simulada = hashlib.sha256(data.encode()).hexdigest()
        super().save(*args, **kwargs)


class DetallePrescripcion(models.Model):
    """Cada medicamento de una prescripcion (1..N)."""
    prescripcion = models.ForeignKey(Prescripcion, on_delete=models.CASCADE,
                                     related_name="detalles")
    medicamento = models.CharField(max_length=150)
    dosis = models.CharField(max_length=100)
    frecuencia = models.CharField(max_length=100)
    duracion_dias = models.PositiveSmallIntegerField()