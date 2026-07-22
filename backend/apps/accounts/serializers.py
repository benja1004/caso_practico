from rest_framework import serializers
from .models import Usuario, CentroSalud, Especialidad, PerfilMedico


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["id", "username", "email", "first_name", "last_name",
                  "rol", "dni", "telefono", "mfa_enabled", "is_active", "ultimo_acceso"]
        read_only_fields = ["id", "mfa_enabled", "ultimo_acceso", "is_active"]


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Usuario
        fields = ["id", "username", "email", "first_name", "last_name",
                  "rol", "dni", "telefono", "password"]

    def create(self, validated_data):
        return Usuario.objects.create_user(**validated_data)


class CentroSaludSerializer(serializers.ModelSerializer):
    class Meta:
        model = CentroSalud
        fields = "__all__"


class EspecialidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = "__all__"


class PerfilMedicoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.get_full_name", read_only=True)
    especialidad_nombre = serializers.CharField(source="especialidad.nombre", read_only=True)
    centro_salud_nombre = serializers.CharField(source="centro_salud.nombre", read_only=True)

    class Meta:
        model = PerfilMedico
        fields = "__all__"
        read_only_fields = ["usuario"]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class MFASerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)