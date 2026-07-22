import pyotp
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Usuario(AbstractUser):
    """Usuario base con rol RBAC estricto (RNF-05) y MFA TOTP real."""

    class Roles(models.TextChoices):
        ADMIN = "ADMIN", "Administrador"
        MEDICO = "MEDICO", "Medico"
        PACIENTE = "PACIENTE", "Paciente"

    rol = models.CharField(max_length=10, choices=Roles.choices, default=Roles.PACIENTE)
    dni = models.CharField(max_length=8, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    # MFA TOTP (RF-01)
    mfa_secret = models.CharField(max_length=64, blank=True)
    mfa_enabled = models.BooleanField(default=False)
    # Bloqueo tras 3 intentos fallidos (RNF-05)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)
    ultimo_acceso = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "username"

    @property
    def esta_bloqueado(self):
        return bool(self.bloqueado_hasta and self.bloqueado_hasta > timezone.now())

    def save(self, *args, **kwargs):
        if not self.mfa_secret:
            self.mfa_secret = pyotp.random_base32()
        super().save(*args, **kwargs)

    def generar_totp(self):
        return pyotp.TOTP(self.mfa_secret).now()

    def verificar_totp(self, code):
        if not self.mfa_enabled or not self.mfa_secret:
            return False
        return pyotp.TOTP(self.mfa_secret).verify(code, valid_window=1)

    def otpauth_uri(self):
        return pyotp.TOTP(self.mfa_secret).provisioning_uri(
            name=self.username, issuer_name="SALUDCONNECT")

    def registrar_intento_fallido(self):
        self.intentos_fallidos += 1
        if self.intentos_fallidos >= 3:
            self.bloqueado_hasta = timezone.now() + timezone.timedelta(minutes=15)
            self.intentos_fallidos = 0
        self.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])

    def resetear_intentos(self):
        self.intentos_fallidos = 0
        self.bloqueado_hasta = None
        self.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])


class CentroSalud(models.Model):
    nombre = models.CharField(max_length=150)
    # 1=puesto rural, 2=centro, 3=especializado
    nivel_atencion = models.PositiveSmallIntegerField(choices=[(1, "Puesto rural"), (2, "Centro"), (3, "Especializado")])
    ubicacion = models.CharField(max_length=200)
    tiene_conectividad_estable = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.nombre} (N{self.nivel_atencion})"


class Especialidad(models.Model):
    """Catalogo: incluye 'Medicina General' como un valor mas."""
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre


class PerfilMedico(models.Model):
    """Un especialista es un medico con una especialidad distinta a Medicina General."""
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name="perfil_medico")
    especialidad = models.ForeignKey(Especialidad, on_delete=models.PROTECT, related_name="medicos")
    centro_salud = models.ForeignKey(CentroSalud, on_delete=models.PROTECT, related_name="medicos")
    numero_colegiatura = models.CharField(max_length=20)

    def __str__(self):
        return f"Dr(a). {self.usuario.get_full_name()} - {self.especialidad}"