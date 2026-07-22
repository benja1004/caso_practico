from django.conf import settings
from django.db import models


class CondicionCronica(models.Model):
    """Catalogo: Diabetes, Hipertension, EPOC."""
    nombre = models.CharField(max_length=50, unique=True)
    codigo = models.CharField(max_length=20, unique=True,
                              help_text="Ej. DIABETES, HIPERTENSION, EPOC")

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Paciente(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                   related_name="paciente")
    fecha_nacimiento = models.DateField()
    direccion = models.CharField(max_length=200, blank=True)
    centro_salud_asignado = models.ForeignKey("accounts.CentroSalud", on_delete=models.PROTECT,
                                              related_name="pacientes", null=True, blank=True)
    contacto_emergencia = models.CharField(max_length=100, blank=True)
    # M2M con CondicionCronica via tabla intermedia PacienteCondicion
    condiciones = models.ManyToManyField(CondicionCronica, through="PacienteCondicion",
                                         related_name="pacientes")

    class Meta:
        ordering = ["usuario__last_name", "usuario__first_name"]

    def __str__(self):
        return f"{self.usuario.get_full_name() or self.usuario.username}"

    @property
    def nombre_completo(self):
        return self.usuario.get_full_name() or self.usuario.username

    @property
    def edad(self):
        from datetime import date
        h = date.today()
        return (h.year - self.fecha_nacimiento.year
                - ((h.month, h.day) < (self.fecha_nacimiento.month,
                                       self.fecha_nacimiento.day)))


class PacienteCondicion(models.Model):
    """Relacion M2M: paciente <-> condicion cronica con fecha de diagnostico."""
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="condiciones_set")
    condicion = models.ForeignKey(CondicionCronica, on_delete=models.PROTECT)
    fecha_diagnostico = models.DateField()

    class Meta:
        unique_together = ("paciente", "condicion")