from django.contrib import admin
from .models import LogAuditoria


@admin.register(LogAuditoria)
class LogAuditoriaAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "usuario", "accion", "modelo_afectado",
                    "objeto_id", "ip_address")
    list_filter = ("accion", "modelo_afectado")
    readonly_fields = ("usuario", "accion", "modelo_afectado", "objeto_id",
                       "ip_address", "detalle", "timestamp")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False