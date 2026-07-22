"""Signals: registran acciones sensibles en LogAuditoria con modelo_afectado y objeto_id."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.accounts.models import Usuario
from apps.appointments.models import Cita
from apps.clinical.models import SignoVital
from apps.prescriptions.models import Prescripcion
from apps.referrals.models import Derivacion

from .models import LogAuditoria


def _registrar(usuario, accion, modelo, objeto_id, detalle=""):
    if usuario is None or not getattr(usuario, "is_authenticated", False):
        return
    try:
        LogAuditoria.objects.create(
            usuario=usuario.username, accion=accion,
            modelo_afectado=modelo, objeto_id=str(objeto_id),
            ip_address=None, detalle=detalle[:300])
    except Exception:
        pass


@receiver(post_save, sender=Cita)
def _log_cita(sender, instance, created, **kwargs):
    _registrar(getattr(instance, "creado_por", None), "CREATE" if created else "UPDATE",
              "Cita", instance.pk, f"estado={instance.estado}")


@receiver(post_save, sender=SignoVital)
def _log_signo(sender, instance, created, **kwargs):
    _registrar(instance.registrado_por, "CREATE" if created else "UPDATE",
              "SignoVital", instance.pk, f"tipo={instance.tipo}")


@receiver(post_save, sender=Prescripcion)
def _log_prescripcion(sender, instance, created, **kwargs):
    _registrar(instance.medico, "CREATE" if created else "UPDATE",
              "Prescripcion", instance.pk, f"codigo={instance.codigo_verificacion}")


@receiver(post_save, sender=Derivacion)
def _log_derivacion(sender, instance, created, **kwargs):
    _registrar(instance.medico_origen, "CREATE" if created else "UPDATE",
              "Derivacion", instance.pk, f"estado={instance.estado}")


@receiver(post_delete, sender=Cita)
def _log_del_cita(sender, instance, **kwargs):
    _registrar(getattr(instance, "creado_por", None), "DELETE", "Cita", instance.pk)


@receiver(post_save, sender=Usuario)
def _log_usuario(sender, instance, created, **kwargs):
    if created:
        _registrar(instance, "CREATE", "Usuario", instance.pk, f"rol={instance.rol}")