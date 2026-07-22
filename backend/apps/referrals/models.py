from django.conf import settings
from django.db import models
from django.utils import timezone


class Derivacion(models.Model):
    """RF-06: derivacion entre niveles de atencion. Especialista = medico con otra especialidad."""

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        ACEPTADA = "ACEPTADA", "Aceptada"
        RECHAZADA = "RECHAZADA", "Rechazada"
        COMPLETADA = "COMPLETADA", "Completada"

    class Prioridad(models.TextChoices):
        ALTA = "ALTA", "Alta"
        MEDIA = "MEDIA", "Media"
        BAJA = "BAJA", "Baja"

    paciente = models.ForeignKey("patients.Paciente", on_delete=models.CASCADE,
                                 related_name="derivaciones")
    medico_origen = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                      related_name="derivaciones_enviadas")
    # especialista_destino: medico especifico o null (cualquier especialista de esa especialidad)
    especialista_destino = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                             related_name="derivaciones_recibidas",
                                             null=True, blank=True,
                                             limit_choices_to={"rol": "MEDICO"})
    especialidad_destino = models.ForeignKey("accounts.Especialidad", on_delete=models.PROTECT,
                                             related_name="derivaciones_recibidas")
    centro_origen = models.ForeignKey("accounts.CentroSalud", on_delete=models.PROTECT,
                                      related_name="derivaciones_salientes")
    centro_destino = models.ForeignKey("accounts.CentroSalud", on_delete=models.PROTECT,
                                      related_name="derivaciones_entrantes")
    motivo = models.TextField()
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PENDIENTE)
    prioridad = models.CharField(max_length=6, choices=Prioridad.choices, default=Prioridad.MEDIA)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_solicitud"]


class AdjuntoDerivacion(models.Model):
    derivacion = models.ForeignKey(Derivacion, on_delete=models.CASCADE, related_name="adjuntos")
    archivo = models.FileField(upload_to="derivaciones/")
    tipo_documento = models.CharField(max_length=50)
    subido_en = models.DateTimeField(auto_now_add=True)