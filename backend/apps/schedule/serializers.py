from rest_framework import serializers
from .models import HorarioMedico, BloqueoAgenda


class HorarioMedicoSerializer(serializers.ModelSerializer):
    medico_nombre = serializers.CharField(source="medico.get_full_name", read_only=True)
    dia_display = serializers.CharField(source="get_dia_semana_display", read_only=True)

    class Meta:
        model = HorarioMedico
        fields = ["id", "medico", "medico_nombre", "dia_semana", "dia_display",
                  "hora_inicio", "hora_fin", "duracion_cita_min", "activo"]
        read_only_fields = ["medico"]

    def validate(self, attrs):
        # Reusa la validacion de superposicion del modelo
        instance = HorarioMedico(**{**attrs, "medico": self.context["request"].user})
        instance.clean()
        return attrs


class BloqueoAgendaSerializer(serializers.ModelSerializer):
    """El motivo nunca se expone al paciente (ver get_queryset filtrado por rol)."""
    medico_nombre = serializers.CharField(source="medico.get_full_name", read_only=True)

    class Meta:
        model = BloqueoAgenda
        fields = ["id", "medico", "medico_nombre", "fecha_inicio", "fecha_fin",
                  "hora_inicio", "hora_fin", "motivo", "fecha_inicio_iso"]
        read_only_fields = ["medico", "fecha_inicio_iso"]

    fecha_inicio_iso = serializers.SerializerMethodField()

    def get_fecha_inicio_iso(self, obj):
        return obj.fecha_inicio.isoformat()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Privacidad: el paciente solo ve el rango, NUNCA el motivo
        if self.context["request"].user.rol == "PACIENTE":
            data.pop("motivo", None)
        return data