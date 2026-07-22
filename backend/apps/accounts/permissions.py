from rest_framework.permissions import BasePermission


class IsMedico(BasePermission):
    message = "Solo personal medico puede realizar esta accion."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ("MEDICO", "ADMIN")


class IsPaciente(BasePermission):
    message = "Solo pacientes pueden realizar esta accion."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == "PACIENTE"


class IsAdminRole(BasePermission):
    message = "Solo el administrador."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == "ADMIN"


class IsOwnerOrMedico(BasePermission):
    """El paciente solo ve sus propios datos; el medico/admin ve segun corresponda."""

    def has_object_permission(self, request, view, obj):
        if request.user.rol in ("MEDICO", "ADMIN"):
            return True
        paciente_user = getattr(getattr(obj, "paciente", obj), "usuario", None)
        return paciente_user == request.user