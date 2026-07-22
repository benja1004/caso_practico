from rest_framework import serializers
from .models import Paciente, PacienteCondicion, CondicionCronica


class CondicionCronicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CondicionCronica
        fields = "__all__"


class PacienteCondicionSerializer(serializers.ModelSerializer):
    condicion_codigo = serializers.CharField(source="condicion.codigo", read_only=True)
    condicion_nombre = serializers.CharField(source="condicion.nombre", read_only=True)

    class Meta:
        model = PacienteCondicion
        fields = ["id", "paciente", "condicion", "condicion_codigo", "condicion_nombre",
                  "fecha_diagnostico"]


class PacienteSerializer(serializers.ModelSerializer):
    edad = serializers.ReadOnlyField()
    nombre_completo = serializers.ReadOnlyField()
    username = serializers.CharField(source="usuario.username", read_only=True)
    dni = serializers.CharField(source="usuario.dni", read_only=True)
    telefono = serializers.CharField(source="usuario.telefono", read_only=True)
    centro_salud_nombre = serializers.CharField(source="centro_salud_asignado.nombre",
                                                read_only=True)
    condiciones = serializers.SerializerMethodField()
    links = serializers.SerializerMethodField()  # HATEOAS

    class Meta:
        model = Paciente
        fields = ["id", "usuario", "username", "dni", "telefono", "nombre_completo",
                  "fecha_nacimiento", "edad", "direccion", "centro_salud_asignado",
                  "centro_salud_nombre", "contacto_emergencia", "condiciones", "links"]
        read_only_fields = ["usuario"]

    def get_condiciones(self, obj):
        return [{"codigo": c.condicion.codigo, "nombre": c.condicion.nombre,
                 "fecha_diagnostico": c.fecha_diagnostico} for c in obj.condiciones_set.all()]

    def get_links(self, obj):
        return {
            "self": f"/api/v1/pacientes/{obj.pk}/",
            "citas": f"/api/v1/citas/?paciente={obj.pk}",
            "signos": f"/api/v1/signos/?paciente={obj.pk}",
            "tendencias": f"/api/v1/signos/tendencias/?paciente={obj.pk}",
            "derivaciones": f"/api/v1/derivaciones/?paciente={obj.pk}",
        }