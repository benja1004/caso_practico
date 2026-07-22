from django.conf import settings
from django.db import models


class Cita(models.Model):
    """Agendamiento con creado_por (trazabilidad) y concurrencia controlada."""

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        REPROGRAMADA = "REPROGRAMADA", "Reprogramada"
        CANCELADA = "CANCELADA", "Cancelada"
        ATENDIDA = "ATENDIDA", "Atendida"

    paciente = models.ForeignKey("patients.Paciente", on_delete=models.CASCADE,
                                 related_name="citas")
    medico = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               related_name="citas_medico",
                               limit_choices_to={"rol": "MEDICO"})
    centro_salud = models.ForeignKey("accounts.CentroSalud", on_delete=models.PROTECT,
                                     related_name="citas", null=True, blank=True)
    fecha_hora = models.DateTimeField()
    motivo = models.CharField(max_length=200)
    estado = models.CharField(max_length=12, choices=Estado.choices,
                              default=Estado.PENDIENTE)
    recordatorio_enviado = models.BooleanField(default=False)
    # Trazabilidad: quien creo la cita (paciente o personal medico)
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="citas_creadas")
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_hora"]
        # Concurrencia: un medico no puede tener dos citas activas en el mismo slot.
        # SQLite no soporta partial unique; se valida en la transaccion (select_for_update).
        constraints = [
            models.UniqueConstraint(fields=["medico", "fecha_hora"],
                                    name="uniq_cita_medico_slot",
                                    condition=~models.Q(estado="CANCELADA")),
        ]

    def __str__(self):
        return f"{self.paciente} con {self.medico} - {self.fecha_hora:%d/%m/%Y %H:%M}"