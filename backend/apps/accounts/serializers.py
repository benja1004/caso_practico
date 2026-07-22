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
    fecha_nacimiento = serializers.DateField(write_only=True, required=False, allow_null=True)
    direccion = serializers.CharField(write_only=True, required=False, allow_blank=True)
    contacto_emergencia = serializers.CharField(write_only=True, required=False, allow_blank=True)
    centro_salud_asignado = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    especialidad = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    centro_salud = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    numero_colegiatura = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = ["id", "username", "email", "first_name", "last_name",
                  "rol", "dni", "telefono", "password", "fecha_nacimiento",
                  "direccion", "contacto_emergencia", "centro_salud_asignado",
                  "especialidad", "centro_salud", "numero_colegiatura"]

    def create(self, validated_data):
        fecha_nacimiento = validated_data.pop("fecha_nacimiento", None)
        direccion = validated_data.pop("direccion", "")
        contacto_emergencia = validated_data.pop("contacto_emergencia", "")
        centro_salud_asignado_id = validated_data.pop("centro_salud_asignado", None)
        especialidad_id = validated_data.pop("especialidad", None)
        centro_salud_id = validated_data.pop("centro_salud", None)
        numero_colegiatura = validated_data.pop("numero_colegiatura", "")

        usuario = Usuario.objects.create_user(**validated_data)

        if usuario.rol == "PACIENTE":
            from apps.patients.models import Paciente
            Paciente.objects.create(
                usuario=usuario,
                fecha_nacimiento=fecha_nacimiento or "2000-01-01",
                direccion=direccion,
                contacto_emergencia=contacto_emergencia,
                centro_salud_asignado_id=centro_salud_asignado_id,
            )
        elif usuario.rol == "MEDICO" and especialidad_id and centro_salud_id:
            from apps.accounts.models import PerfilMedico
            PerfilMedico.objects.create(
                usuario=usuario,
                especialidad_id=especialidad_id,
                centro_salud_id=centro_salud_id,
                numero_colegiatura=numero_colegiatura or "N/A",
            )
        return usuario


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