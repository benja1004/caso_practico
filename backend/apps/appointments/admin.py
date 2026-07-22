from django.contrib import admin
from .models import Cita


@admin.register(Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ("paciente", "medico", "fecha_hora", "estado",
                    "creado_por", "recordatorio_enviado")
    list_filter = ("estado", "medico")