from .models import LogAuditoria

RUTAS_AUDITABLES = "/api/"


def _ip_cliente(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditMiddleware:
    """RNF-04: registra cada acceso a la API con timestamp e IP."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith(RUTAS_AUDITABLES):
            usuario = getattr(request.user, "username", "") or "anonimo"
            try:
                LogAuditoria.objects.create(
                    usuario=usuario, accion=request.method,
                    modelo_afectado="", objeto_id="",
                    ip_address=_ip_cliente(request),
                    detalle=f"status={response.status_code} path={request.path[:200]}",
                )
            except Exception:
                pass  # la auditoria nunca debe romper la peticion
        return response