from django.contrib import admin
from .models import Derivacion, AdjuntoDerivacion


class AdjuntoDerivacionInline(admin.TabularInline):
    model = AdjuntoDerivacion
    extra = 1


@admin.register(Derivacion)
class DerivacionAdmin(admin.ModelAdmin):
    list_display = ("paciente", "especialidad_destino", "centro_destino", "prioridad",
                    "estado", "fecha_solicitud")
    list_filter = ("estado", "prioridad", "especialidad_destino")
    inlines = [AdjuntoDerivacionInline]