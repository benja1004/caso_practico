from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CentroSalud, Especialidad, PerfilMedico
from .permissions import IsAdminRole
from .serializers import (CentroSaludSerializer, EspecialidadSerializer,
                          LoginSerializer, MFASerializer, PerfilMedicoSerializer,
                          UsuarioCreateSerializer, UsuarioSerializer)

Usuario = get_user_model()


def _emitir_jwt(user):
    user.ultimo_acceso = timezone.now()
    user.save(update_fields=["ultimo_acceso"])
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh),
            "user": UsuarioSerializer(user).data}


class LoginView(generics.GenericAPIView):
    """RF-01 paso 1: credenciales -> exige token temporal TOTP."""
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        username = s.validated_data["username"]
        try:
            user = Usuario.objects.get(username=username)
        except Usuario.DoesNotExist:
            return Response({"detail": "Credenciales invalidas."}, status=401)

        if user.esta_bloqueado:
            return Response(
                {"detail": "Cuenta bloqueada 15 min (3 intentos fallidos)."},
                status=status.HTTP_423_LOCKED)

        auth_user = authenticate(username=username,
                                  password=s.validated_data["password"])
        if auth_user is None:
            user.registrar_intento_fallido()
            return Response({"detail": "Credenciales invalidas."}, status=401)

        user.resetear_intentos()
        if not user.mfa_enabled:
            # Enrolla y emite token directamente (caso de usuarios sin setup previo)
            user.mfa_enabled = True
            user.save(update_fields=["mfa_enabled"])
            return Response({**_emitir_jwt(user), "mfa_required": False})
            # Nota: en el seed all users ya tienen mfa_enabled=True; este branch
            # cubre usuarios creados por el admin sin setup. Para exigir MFA real
            # el usuario debe escanear el QR una vez (ver /me/mfa-setup/).

        resp = {"detail": "Ingrese el codigo TOTP (Google Authenticator).",
                "mfa_required": True}
        from django.conf import settings
        if settings.DEBUG:
            resp["dev_code"] = user.generar_totp()  # demo sin telefono
        return Response(resp)


class MFAVerifyView(generics.GenericAPIView):
    """RF-01 paso 2: valida el TOTP y emite el JWT (15 min de vida)."""
    permission_classes = [AllowAny]
    serializer_class = MFASerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user = Usuario.objects.get(username=s.validated_data["username"])
        except Usuario.DoesNotExist:
            return Response({"detail": "Codigo invalido."}, status=401)
        if user.esta_bloqueado:
            return Response({"detail": "Cuenta bloqueada temporalmente."}, status=423)
        if not user.verificar_totp(s.validated_data["code"]):
            user.registrar_intento_fallido()
            return Response({"detail": "Codigo TOTP invalido."}, status=401)
        user.resetear_intentos()
        return Response({**_emitir_jwt(user), "mfa_required": False})


class MeView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsuarioSerializer

    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)

    @action(detail=False, methods=["get"])
    def mfa_setup(self, request):
        """QR otpauth para que el usuario escanee con Google Authenticator."""
        return Response({"otpauth_uri": request.user.otpauth_uri(),
                         "secret": request.user.mfa_secret})


class UsuarioViewSet(viewsets.ModelViewSet):
    """RF-07: gestion de usuarios (solo admin)."""
    queryset = Usuario.objects.all().order_by("username")
    permission_classes = [IsAdminRole]
    filterset_fields = ["rol", "is_active"]
    search_fields = ["username", "first_name", "last_name", "dni"]

    def get_serializer_class(self):
        return UsuarioCreateSerializer if self.action == "create" else UsuarioSerializer

    @action(detail=True, methods=["post"])
    def desbloquear(self, request, pk=None):
        self.get_object().resetear_intentos()
        return Response({"detail": "Usuario desbloqueado."})


class CatalogoViewSetMixin:
    permission_classes = [IsAuthenticated]


class CentroSaludViewSet(viewsets.ModelViewSet):
    queryset = CentroSalud.objects.all()
    serializer_class = CentroSaludSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["nivel_atencion"]


class EspecialidadViewSet(viewsets.ModelViewSet):
    queryset = Especialidad.objects.all().order_by("nombre")
    serializer_class = EspecialidadSerializer
    permission_classes = [IsAuthenticated]


class PerfilMedicoViewSet(viewsets.ModelViewSet):
    queryset = PerfilMedico.objects.select_related("usuario", "especialidad", "centro_salud")
    serializer_class = PerfilMedicoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["especialidad", "centro_salud"]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)