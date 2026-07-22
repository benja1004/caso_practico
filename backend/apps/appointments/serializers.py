from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers

from .models import Cita


class CitaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    medico_nombre = serializers.SerializerMethodField()
    centro_salud_nombre = serializers.CharField(source="centro_salud.nombre", read_only=True)
    creado_por_username = serializers.CharField(source="creado_por.username", read_only=True)
    creado_por_rol = serializers.CharField(source="creado_por.rol", read_only=True)

    class Meta:
        model = Cita
        fields = "__all__"
        read_only_fields = ["recordatorio_enviado", "creado_en", "actualizado_en",
                            "creado_por"]

    def get_medico_nombre(self, obj):
        return f"Dr(a). {obj.medico.get_full_name() or obj.medico.username}"

    def validate_fecha_hora(self, value):
        ahora = timezone.now()
        if value < ahora:
            raise serializers.ValidationError("No se puede agendar en fecha pasada.")
        # Regla: minimo 2 horas antes para agendar el mismo dia
        if (value - ahora) < timedelta(hours=2):
            raise serializers.ValidationError(
                "El agendamiento requiere al menos 2 horas de anticipacion.")
        return value

    def validate(self, attrs):
        """Concurrencia: el slot debe estar libre al momento de guardar."""
        medico = attrs.get("medico") or getattr(self.instance, "medico", None)
        fecha = attrs.get("fecha_hora") or getattr(self.instance, "fecha_hora", None)
        if medico and fecha:
            qs = (Cita.objects.filter(medico=medico, fecha_hora=fecha,
                                      estado__in=["PENDIENTE", "CONFIRMADA",
                                                  "REPROGRAMADA"]))
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"fecha_hora": "Horario ya no disponible (otro paciente lo tomo)."})
        return attrs