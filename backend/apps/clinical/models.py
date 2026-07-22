from django.conf import settings
from django.db import models
from django.utils import timezone


class RangoClinico(models.Model):
    """Rango normal segun tipo de signo + condicion cronica (opcional).
    El rango de glucosa NO es igual para un diabetico que para un paciente sano.
    """
    class Tipo(models.TextChoices):
        GLUCOSA = "GLUCOSA", "Glucosa"
        SPO2 = "SPO2", "SpO2"
        TEMPERATURA = "TEMPERATURA", "Temperatura"
        PRESION = "PRESION", "Presion arterial"

    tipo_signo = models.CharField(max_length=15, choices=Tipo.choices)
    condicion_cronica = models.ForeignKey("patients.CondicionCronica", on_delete=models.CASCADE,
                                          null=True, blank=True, related_name="rangos")
    valor_min = models.FloatField()
    valor_max = models.FloatField()
    # Umbrales extremos para nivel critico (leve/moderado/critico)
    valor_min_critico = models.FloatField(null=True, blank=True)
    valor_max_critico = models.FloatField(null=True, blank=True)
    unidad = models.CharField(max_length=15)

    class Meta:
        unique_together = ("tipo_signo", "condicion_cronica")
        ordering = ["tipo_signo", "condicion_cronica"]

    def __str__(self):
        return f"{self.tipo_signo} {self.valor_min}-{self.valor_max} {self.unidad}"

    @classmethod
    def para(cls, tipo, condiciones_ids=None):
        """Devuelve el rango aplicable: prioriza el de la condicion, fallback al generico."""
        if condiciones_ids:
            r = cls.objects.filter(tipo_signo=tipo,
                                   condicion_cronica_id__in=condiciones_ids).first()
            if r:
                return r
        return cls.objects.filter(tipo_signo=tipo, condicion_cronica__isnull=True).first()


class SignoVital(models.Model):
    """Registro de signos. Presion tiene dos valores (sistolica/diastolica)."""

    class Origen(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        OFFLINE = "OFFLINE", "Offline (sincronizado)"

    paciente = models.ForeignKey("patients.Paciente", on_delete=models.CASCADE,
                                 related_name="signos")
    cita = models.ForeignKey("appointments.Cita", on_delete=models.SET_NULL,
                             null=True, blank=True, related_name="signos")
    tipo = models.CharField(max_length=15, choices=RangoClinico.Tipo.choices)
    valor = models.FloatField(null=True, blank=True,
                             help_text="Para presion usar sistolica/diastolica")
    valor_sistolica = models.FloatField(null=True, blank=True)
    valor_diastolica = models.FloatField(null=True, blank=True)
    unidad = models.CharField(max_length=15, blank=True)
    registrado_en = models.DateTimeField()
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="signos_registrados")
    origen = models.CharField(max_length=10, choices=Origen.choices, default=Origen.MANUAL)

    class Meta:
        ordering = ["-registrado_en"]

    def _evaluar_valor(self, valor):
        """Devuelve (fuera_de_rango, nivel_alerta) dado un valor y el rango del paciente."""
        if valor is None:
            return False, None
        ids = list(self.paciente.condiciones.values_list("id", flat=True))
        r = RangoClinico.para(self.tipo, ids)
        if not r:
            return False, None
        critico_bajo = r.valor_min_critico and valor < r.valor_min_critico
        critico_alto = r.valor_max_critico and valor > r.valor_max_critico
        if critico_bajo or critico_alto:
            return True, "CRITICO"
        if not (r.valor_min <= valor <= r.valor_max):
            return True, "MODERADO"
        return False, None

    @property
    def fuera_de_rango(self):
        if self.tipo == "PRESION":
            return any(self._evaluar_valor(v)[0]
                       for v in (self.valor_sistolica, self.valor_diastolica))
        return self._evaluar_valor(self.valor)[0]

    def nivel_alerta(self):
        niveles = []
        if self.tipo == "PRESION":
            for v in (self.valor_sistolica, self.valor_diastolica):
                if v is not None:
                    _, n = self._evaluar_valor(v)
                    if n:
                        niveles.append(n)
        else:
            _, n = self._evaluar_valor(self.valor)
            if n:
                niveles.append(n)
        # El mas grave prevalece
        for n in ("CRITICO", "MODERADO", "LEVE"):
            if n in niveles:
                return n
        return None


class Alerta(models.Model):
    """Generada automaticamente al detectar un signo fuera de rango."""
    class Nivel(models.TextChoices):
        LEVE = "LEVE", "Leve"
        MODERADO = "MODERADO", "Moderado"
        CRITICO = "CRITICO", "Critico"

    signo_vital = models.ForeignKey(SignoVital, on_delete=models.CASCADE, related_name="alertas")
    nivel = models.CharField(max_length=10, choices=Nivel.choices)
    mensaje = models.CharField(max_length=300)
    atendida = models.BooleanField(default=False)
    generada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generada_en"]


class RegistroOffline(models.Model):
    """Staging de datos capturados sin conexion (sincroniza al volver la red)."""
    paciente = models.ForeignKey("patients.Paciente", on_delete=models.CASCADE,
                                 related_name="registros_offline")
    dispositivo_id = models.CharField(max_length=100)
    payload = models.JSONField()  # datos capturados sin conexion
    capturado_en = models.DateTimeField()
    sincronizado = models.BooleanField(default=False)
    sincronizado_en = models.DateTimeField(null=True, blank=True)
    signo_vital = models.ForeignKey(SignoVital, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="registro_origen")