import json
from rest_framework import serializers
from .models import RegistroLegacy


class RegistroLegacySerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroLegacy
        fields = "__all__"
        read_only_fields = ["migrado_en", "validado", "paciente_vinculado"]


class ImportarCsvSerializer(serializers.Serializer):
    """El JSP legacy envia lotes de filas CSV (JSON)."""
    registros = serializers.ListField(child=serializers.JSONField(), min_length=1)


class ValidarRegistroSerializer(serializers.Serializer):
    registro_id = serializers.IntegerField()
    accion = serializers.ChoiceField(choices=["crear_paciente", "rechazar"])