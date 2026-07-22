from django.db import models


class LogAuditoria(models.Model):
    """RNF-04: log inmutable de accesos, modificaciones y exportaciones."""

    usuario = models.CharField(max_length=150, db_index=True)
    accion = models.CharField(max_length=10)  # LOGIN, CREATE, UPDATE, DELETE, GET, EXPORT
    modelo_afectado = models.CharField(max_length=100, blank=True)
    objeto_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    detalle = models.TextField(blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("LogAuditoria es inmutable: no se puede editar.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("LogAuditoria es inmutable: no se puede eliminar.")