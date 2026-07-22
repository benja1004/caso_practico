from rest_framework import serializers
from .models import RangoClinico, SignoVital, Alerta, RegistroOffline


class RangoClinicoSerializer(serializers.ModelSerializer):
    condicion_nombre = serializers.CharField(source="condicion_cronica.nombre",
                                            read_only=True)

    class Meta:
        model = RangoClinico
        fields = "__all__"


class SignoVitalSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    fuera_de_rango = serializers.ReadOnlyField()
    nivel_alerta = serializers.SerializerMethodField()
    rango_aplicado = serializers.SerializerMethodField()

    class Meta:
        model = SignoVital
        fields = ["id", "paciente", "paciente_nombre", "cita", "tipo", "valor",
                  "valor_sistolica", "valor_diastolica", "unidad", "registrado_en",
                  "registrado_por", "origen", "fuera_de_rango", "nivel_alerta",
                  "rango_aplicado"]
        read_only_fields = ["registrado_por", "registrado_en", "nivel_alerta"]

    def get_nivel_alerta(self, obj):
        return obj.nivel_alerta()

    def get_rango_aplicado(self, obj):
        ids = list(obj.paciente.condiciones.values_list("id", flat=True))
        r = RangoClinico.para(obj.tipo, ids)
        if not r:
            return None
        return {"min": r.valor_min, "max": r.valor_max, "unidad": r.unidad}

    def create(self, validated_data):
        from django.utils import timezone
        validated_data.setdefault("registrado_en", timezone.now())
        user = self.context["request"].user
        sv = SignoVital.objects.create(registrado_por=user, **validated_data)
        # Generar Alerta automaticamente si esta fuera de rango
        nivel = sv.nivel_alerta()
        if nivel:
            mensaje = (f"{sv.get_tipo_display()} fuera de rango "
                       f"({sv.paciente.nombre_completo})")
            Alerta.objects.create(signo_vital=sv, nivel=nivel, mensaje=mensaje)
        return sv


class AlertaSerializer(serializers.ModelSerializer):
    paciente = serializers.CharField(source="signo_vital.paciente.nombre_completo",
                                     read_only=True)
    signo_tipo = serializers.CharField(source="signo_vital.get_tipo_display",
                                      read_only=True)
    signo_valor = serializers.SerializerMethodField()

    class Meta:
        model = Alerta
        fields = "__all__"

    def get_signo_valor(self, obj):
        sv = obj.signo_vital
        if sv.tipo == "PRESION":
            return f"{sv.valor_sistolica}/{sv.valor_diastolica}"
        return str(sv.valor)


class RegistroOfflineSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroOffline
        fields = "__all__"
        read_only_fields = ["sincronizado", "sincronizado_en", "signo_vital"]