from django.contrib import admin
from .models import RegistroLegacy


@admin.register(RegistroLegacy)
class RegistroLegacyAdmin(admin.ModelAdmin):
    list_display = ("paciente_legacy_id", "migrado_en", "validado", "paciente_vinculado")
    list_filter = ("validado",)