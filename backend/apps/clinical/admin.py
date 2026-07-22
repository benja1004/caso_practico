from django.contrib import admin
from .models import RangoClinico, SignoVital, Alerta, RegistroOffline


@admin.register(RangoClinico)
class RangoClinicoAdmin(admin.ModelAdmin):
    list_display = ("tipo_signo", "condicion_cronica", "valor_min", "valor_max",
                    "valor_min_critico", "valor_max_critico", "unidad")
    list_filter = ("tipo_signo",)


@admin.register(SignoVital)
class SignoVitalAdmin(admin.ModelAdmin):
    list_display = ("paciente", "tipo", "valor", "valor_sistolica", "valor_diastolica",
                    "origen", "registrado_en", "alerta")
    list_filter = ("tipo", "origen")

    @admin.display(description="Alerta")
    def alerta(self, obj):
        return obj.nivel_alerta() or "-"


admin.site.register(Alerta)
admin.site.register(RegistroOffline)