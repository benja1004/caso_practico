from django.contrib import admin
from .models import HorarioMedico, BloqueoAgenda


@admin.register(HorarioMedico)
class HorarioMedicoAdmin(admin.ModelAdmin):
    list_display = ("medico", "dia_semana", "hora_inicio", "hora_fin",
                    "duracion_cita_min", "activo")
    list_filter = ("dia_semana", "activo")


admin.site.register(BloqueoAgenda)