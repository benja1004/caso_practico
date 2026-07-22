from rest_framework import serializers
from .models import Prescripcion, DetallePrescripcion


class DetallePrescripcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetallePrescripcion
        fields = ["id", "medicamento", "dosis", "frecuencia", "duracion_dias"]


class PrescripcionSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    medico_nombre = serializers.SerializerMethodField()
    detalles = DetallePrescripcionSerializer(many=True)
    qr_payload = serializers.SerializerMethodField()

    class Meta:
        model = Prescripcion
        fields = ["id", "cita", "medico", "medico_nombre", "paciente", "paciente_nombre",
                  "firma_simulada", "codigo_verificacion", "fecha_emision",
                  "vigente_hasta", "detalles", "qr_payload"]
        read_only_fields = ["medico", "firma_simulada", "codigo_verificacion",
                            "fecha_emision", "vigente_hasta"]

    def get_medico_nombre(self, obj):
        return f"Dr(a). {obj.medico.get_full_name() or obj.medico.username}"

    def get_qr_payload(self, obj):
        return f"SALUDCONNECT|{obj.codigo_verificacion}|{obj.firma_simulada[:16]}"

    def create(self, validated_data):
        detalles_data = validated_data.pop("detalles", [])
        validated_data["medico"] = self.context["request"].user
        pres = Prescripcion.objects.create(**validated_data)
        for d in detalles_data:
            DetallePrescripcion.objects.create(prescripcion=pres, **d)
        return pres

    def update(self, instance, validated_data):
        # Los detalles no se editan (prescripcion inmutable una vez emitida)
        validated_data.pop("detalles", None)
        return super().update(instance, validated_data)