from django.contrib import admin
from .models import CondicionCronica, Paciente, PacienteCondicion


admin.site.register(CondicionCronica)


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ("nombre_completo", "edad", "centro_salud_asignado")
    list_filter = ("centro_salud_asignado",)
    search_fields = ("usuario__username", "usuario__dni")
    readonly_fields = ("edad",)

    @admin.display(description="Nombre")
    def nombre_completo(self, obj):
        return obj.nombre_completo

    @admin.display(description="Edad")
    def edad(self, obj):
        return obj.edad


admin.site.register(PacienteCondicion)