from django.db import models


class RegistroLegacy(models.Model):
    """Staging del modulo JSP: historiales importados desde CSV pendientes de validacion."""
    paciente_legacy_id = models.CharField(max_length=50)
    datos_csv = models.JSONField()
    migrado_en = models.DateTimeField(auto_now_add=True)
    validado = models.BooleanField(default=False)
    paciente_vinculado = models.ForeignKey("patients.Paciente", on_delete=models.SET_NULL,
                                           null=True, blank=True, related_name="legacy")

    class Meta:
        ordering = ["-migrado_en"]