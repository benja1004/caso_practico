from rest_framework import serializers
from .models import Derivacion, AdjuntoDerivacion


class AdjuntoDerivacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdjuntoDerivacion
        fields = "__all__"
        read_only_fields = ["derivacion", "subido_en"]


class DerivacionSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    medico_origen_nombre = serializers.SerializerMethodField()
    especialista_destino_nombre = serializers.SerializerMethodField()
    especialidad_destino_nombre = serializers.CharField(source="especialidad_destino.nombre",
                                                       read_only=True)
    centro_origen_nombre = serializers.CharField(source="centro_origen.nombre", read_only=True)
    centro_destino_nombre = serializers.CharField(source="centro_destino.nombre", read_only=True)
    adjuntos = AdjuntoDerivacionSerializer(many=True, read_only=True)

    class Meta:
        model = Derivacion
        fields = "__all__"
        read_only_fields = ["medico_origen", "fecha_solicitud", "fecha_respuesta"]

    def get_medico_origen_nombre(self, obj):
        return f"Dr(a). {obj.medico_origen.get_full_name() or obj.medico_origen.username}"

    def get_especialista_destino_nombre(self, obj):
        if obj.especialista_destino:
            return f"Dr(a). {obj.especialista_destino.get_full_name() or obj.especialista_destino.username}"
        return "Cualquier especialista disponible"

    def create(self, validated_data):
        validated_data["medico_origen"] = self.context["request"].user
        return super().create(validated_data)