from django.contrib import admin
from .models import Prescripcion, DetallePrescripcion


class DetallePrescripcionInline(admin.TabularInline):
    model = DetallePrescripcion
    extra = 1


@admin.register(Prescripcion)
class PrescripcionAdmin(admin.ModelAdmin):
    list_display = ("codigo_verificacion", "paciente", "medico", "fecha_emision",
                    "vigente_hasta")
    readonly_fields = ("firma_simulada", "codigo_verificacion",
                       "fecha_emision", "vigente_hasta")
    inlines = [DetallePrescripcionInline]