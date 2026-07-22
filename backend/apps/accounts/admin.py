from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, CentroSalud, Especialidad, PerfilMedico


@admin.register(Usuario)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "rol", "dni", "mfa_enabled", "esta_bloqueado",
                    "is_active", "ultimo_acceso")
    list_filter = ("rol", "is_active", "mfa_enabled")
    fieldsets = UserAdmin.fieldsets + (
        ("SALUDCONNECT", {"fields": ("rol", "dni", "telefono",
                                      "mfa_secret", "mfa_enabled",
                                      "intentos_fallidos", "bloqueado_hasta",
                                      "ultimo_acceso")}),
    )
    readonly_fields = ("mfa_secret", "ultimo_acceso")


admin.site.register(CentroSalud)
admin.site.register(Especialidad)
admin.site.register(PerfilMedico)