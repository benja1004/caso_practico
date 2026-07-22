# 📖 guía-equipos.md — Detalle por módulo para los 6 compañeros

> **Antes de empezar:** lee [`PROYECTO-GUIA-EQUIPO.md`](./PROYECTO-GUIA-EQUIPO.md) para entender el panorama, las ramas y las reglas de commit. Aquí encontrarás el detalle de **tu módulo**.

## 🗺️ Mapeo rápido: apellido ↔ módulo ↔ sección en este archivo

| Apellido (rama `feature/<apellido>`) | Nombre | Sección en este archivo |
|---------------------------------------|--------|--------------------------|
| **barja** | BARJA ORTIZ, Erick | #3 — Agenda (horarios + citas) ⭐ |
| **navarro** | NAVARRO SERVA, Lesly | #2 — Pacientes + condiciones + legacy |
| **sulluchuco** | SULLUCHUCO VILCAPOMA, Anyelo | #4 — Monitoreo + alertas + offline |
| **toribio** | TORIBIO ANSELMO, David Angel | #5 — Prescripciones (QR) + Derivaciones + notif ⭐ |
| **yauri** | YAURI TORRES, Benjamín | #6 — Admin + Auditoría + Docker/K8s/legacy JSP |
| **huaynate** | HUAYNATE CORIÑAUPA, Angel Mitch | #1 — Autenticación + Perfil + MFA |

> Cada sección sigue la misma estructura:
> 1. **Tu módulo y rama** — qué te toca + archivos bajo tu responsabilidad.
> 2. **Lógica que ya implementamos** — para que seas conocedor (defenderás esto).
> 3. **Endpoints clave** + cómo probarlos con Postman/curl.
> 4. **Modelos/archivos importantes** — dónde están y qué hacen.
> 5. **Tareas de mejora sugeridas** — con **solución guiada paso a paso**.
> 6. **Defensa oral rápida** — qué decirle al docente cuando te toque explicar.

---

# 👤 HUAYNATE — Autenticación + Perfil del usuario + MFA (responsable: Angel Mitch)

**Rama:** `feature/huaynate`

## 1. Tu módulo y archivos bajo tu responsabilidad

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/accounts/models.py` | `Usuario` (AbstractUser + rol, MFA TOTP, bloqueo), `CentroSalud`, `Especialidad`, `PerfilMedico` |
| `backend/apps/accounts/serializers.py` | Serializers de login, MFA, usuarios y catálogos |
| `backend/apps/accounts/views.py` | `LoginView`, `MFAVerifyView`, `MeView`, `MFASetupView`, `UsuarioViewSet`, catálogos |
| `backend/apps/accounts/permissions.py` | `IsMedico`, `IsPaciente`, `IsAdminRole`, `IsOwnerOrMedico` |
| `backend/apps/accounts/urls.py` | Rutas `/api/v1/auth/...` |
| `backend/apps/accounts/admin.py` | Admin de usuarios |
| `frontend/src/pages/Login.jsx` | Login en 2 pasos (contraseña + TOTP) |
| `frontend/src/pages/MFASetup.jsx` | Pantalla para escanear QR con Google Authenticator |
| `frontend/src/context/AuthContext.jsx` | `useAuthContext` (hook obligatorio del caso) + timeout 15 min |
| `frontend/src/services/api.js` | Cliente fetch con JWT, refresh y manejo de throttle 429 |

## 2. Lógica que ya implementamos (para que la defiendas)

- **MFA TOTP real con `pyotp`**: cada `Usuario` tiene `mfa_secret` generado automáticamente al crearse. El login valida username+password y **sólo entonces** exige un código TOTP de 6 dígitos (válido 30 s). Si las credenciales fallan 3 veces → `bloqueado_hasta = now + 15 min` (HTTP 423 LOCKED).
- **2 endpoints /auth/login/ y /auth/mfa/**: nunca devuelves JWT en un solo paso. Probar con Postman:
  ```
  POST /api/v1/auth/login/   {"username":"doctor1","password":"doctor123"}
  → 200 {"mfa_required":true,"dev_code":"123456"}
  POST /api/v1/auth/mfa/     {"username":"doctor1","code":"123456"}
  → 200 {"access":"...","refresh":"...","user":{"rol":"MEDICO",...}}
  ```
  (El `dev_code` solo aparece en DEBUG; en producción el código llegaría por correo/Google Authenticator.)
- **JWT con SimpleJWT** (lifetime = 15 min, refresh = 8 h). El frontend **refresca automáticamente** y desloguea si el refresh también expira (RNF-05: sesión 15 min).
- **RBAC estricto** vía `permissions.py`: las vistas usan `IsMedico`, `IsPaciente`, `IsAdminRole`, `IsOwnerOrMedico`. El paciente solo se ve a sí mismo.
- **Throttling** configurado en `settings.py`: auth 12/min, usuario 300/min, anónimo 60/min.
- **MFASetup** (`/mfa-setup`): genera un QR `otpauth://` real para escanear con Google Authenticator. Hay un endpoint `/auth/me/mfa-setup/`.

## 3. Endpoints clave

| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| POST | `/api/v1/auth/login/` | Público (throttle auth) | Recibe credenciales → exige MFA |
| POST | `/api/v1/auth/mfa/` | Público | Verifica TOTP → emite JWT |
| GET | `/api/v1/auth/me/` | Autenticado | Datos del usuario logueado |
| GET | `/api/v1/auth/me/mfa-setup/` | Autenticado | QR otpauth + secreto (+ dev_code en DEBUG) |
| POST | `/api/v1/auth/refresh/` | Público | Refresca access token |
| GET/POST | `/api/v1/auth/usuarios/` | IsAdminRole | CRUD usuarios |
| GET | `/api/v1/centros/` | Autenticado | Lista centros de salud |
| GET | `/api/v1/especialidades/` | Autenticado | Lista especialidades |
| GET/POST | `/api/v1/perfiles-medico/` | Autenticado | Perfiles médicos (médico ↔ especialidad) |

## 4. Tareas de mejora sugeridas (con solución guiada)

### Mejora 1.A — Bloqueo real por intentos fallidos en MFA (no solo en password)
**Problema actual:** si el usuario falla el código TOTP, también cuenta como intento, pero el mensaje del backend no aclara que se bloqueará. **Mejora:** el mensaje de MFA debe decir cuántos intentos quedan.

**Pasos (en `apps/accounts/views.py`, clase `MFAVerifyView`):**
```python
def post(self, request):
    ...
    if not user.verificar_totp(s.validated_data["code"]):
        user.registrar_intento_fallido()
        restantes = 3 - user.intentos_fallidos
        msg = "Código TOTP inválido."
        if user.esta_bloqueado:
            msg = "Cuenta bloqueada 15 min por 3 intentos fallidos."
        else:
            msg += f" Te quedan {restantes} intento(s)."
        return Response({"detail": msg}, status=401)
```
Commit: `auth: mostrar intentos restantes al fallar TOTP`.

### Mejora 1.B — Logout en backend (invalidar refresh)
**Problema:** hoy el logout solo borra el token en el frontend, pero el refresh sigue válido hasta expirar. **Mejora:** blacklist del refresh en backend.

**Pasos:**
1. Editar `settings.py` → añade `"rest_framework_simplejwt.token_blacklist",` a `INSTALLED_APPS`.
2. `python manage.py migrate` (crea tablas para OutstandingToken).
3. En `views.py` añade:
```python
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            RefreshToken(request.data["refresh"]).blacklist()
            return Response({"detail": "Sesión cerrada."})
        except Exception:
            return Response({"detail": "Token inválido."}, status=400)
```
4. En `urls.py`: `path("logout/", LogoutView.as_view(), name="logout"),`.
5. En `AuthContext.jsx`, método `logout()`, antes de limpiar, haz `await api('/auth/logout/', { method: 'POST', body: { refresh: localStorage.getItem('refresh') } })`.
Commit: `auth: invalidar refresh en logout (blacklist)`.

### Mejora 1.C — Tests del flujo de auth (mínimo recomendado)
**Problema:** no hay tests. La rúbrica valora el testing.

**Pasos:** crea `backend/apps/accounts/tests.py`:
```python
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Usuario

class AuthFlowTests(TestCase):
    def setUp(self):
        self.u = Usuario.objects.create_user("x", "x@x.pe", "x12345678", rol="PACIENTE")
        self.u.mfa_enabled = True; self.u.save()

    def test_login_pide_mfa(self):
        c = APIClient()
        r = c.post("/api/v1/auth/login/", {"username": "x", "password": "x12345678"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["mfa_required"])

    def test_bloqueo_tras_3_intentos(self):
        c = APIClient()
        for _ in range(3):
            c.post("/api/v1/auth/login/", {"username": "x", "password": "MALA"})
        r = c.post("/api/v1/auth/login/", {"username": "x", "password": "MALA"})
        self.assertEqual(r.status_code, 423)
```
Correr: `python manage.py test accounts`. Commit: `auth: tests de login y bloqueo`.

### Mejora 1.D — Pedir permiso explícito para notificaciones del navegador
En `frontend/src/components/Layout.jsx` (no es tuyo, pero puedes abrir un PR al Comp. 6) pídele que agregue:
```js
if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
```
Si te dice que sí, deja tu feedback y él lo integra; no lo edites tú (respeta las ramas).

## 5. Defensa oral rápida (memoriza esto)

> "Implementé la autenticación multifactor TOTP con `pyotp`. El login son dos endpoints: `/auth/login/` valida credenciales y pide el código TOTP de 6 dígitos (válido 30 s); `/auth/mfa/` verifica ese código y emite el JWT con SimpleJWT (15 min de vida). Cumple RNF-05 (sesión 15 min y bloqueo tras 3 intentos). El frontend refresca automáticamente y desloguea al expirar, y proveo una vista `/mfa-setup` con QR `otpauth://` para configurar Google Authenticator de verdad."

---

# 👤 NAVARRO — Gestión de pacientes + condiciones crónicas + legacy staging (responsable: Lesly)

**Rama:** `feature/navarro`

## 1. Tu módulo y archivos

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/patients/models.py` | `Paciente` (1:1 con Usuario), `CondicionCronica`, `PacienteCondicion` (M2M con fecha_diagnostico) |
| `backend/apps/patients/serializers.py` | `PacienteSerializer` (con edad calculada, condiciones, links HATEOAS) |
| `backend/apps/patients/views.py` | `PacienteViewSet` (con annotate total_citas), filtros |
| `backend/apps/patients/urls.py` | `/api/v1/pacientes/`, `/condiciones/`, `/paciente-condiciones/` |
| `backend/apps/patients/admin.py` | Admin con campo `edad` calculado |
| `backend/apps/legacy/models.py` | `RegistroLegacy` (staging del JSP) |
| `backend/apps/legacy/views.py` | `importar()` (recibe lotes del JSP), `validar()` (admin crea Paciente) |
| `backend/apps/legacy/urls.py` | `/api/v1/legacy/importar/`, `/legacy/validar/` |

## 2. Lógica que ya implementamos

- `Paciente` hereda nombre/apellidos/dni/telefono del `Usuario` (no se duplican, decisión de diseño: `first_name`/`last_name` de AbstractUser se usan como datos personales).
- `PacienteCondicion` (tabla intermedia) enlaza cada paciente con sus condiciones crónicas (`Diabetes`, `Hipertensión`, `EPOC`) + fecha de diagnóstico. **Esto es crítico porque los rangos clínicos de glucosa varían según la condición** (Compañero 4 lo usa).
- `PacienteViewSet` hace `annotate` con `Count("citas")` y `Max("citas__fecha_hora")` (demostración de ORM annotate, exigido en el sílabo S05-S07).
- **RBAC**: si eres `PACIENTE` solo te ves a ti mismo en `/pacientes/` (mismo patrón que en signos, citas, recetas, derivaciones — coopera con los demás).
- **Legacy staging**: el módulo JSP (`legacy/patient-sync.jsp`) publica filas CSV en `/legacy/importar/` y quedan en **staging** (`RegistroLegacy`). El admin valida cada registro desde el frontend (Compañero 6) y crea el paciente vinculado o lo rechaza. Esto sigue el principio de **no confiar en los datos importados** (validación obligatoria).

## 3. Endpoints clave
| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| GET | `/api/v1/pacientes/` | Auth + IsOwnerOrMedico | Lista (paciente solo se ve a sí mismo) |
| GET | `/api/v1/pacientes/{id}/` | Auth + IsOwnerOrMedico | Detalle |
| POST/PATCH | `/api/v1/pacientes/` | Médico/Admin | CRUD |
| GET | `/api/v1/condiciones/` | Auth | Catálogo |
| GET/POST | `/api/v1/paciente-condiciones/` | Médico/Admin | Asignar condición a un paciente |
| POST | `/api/v1/legacy/importar/` | Auth | Recibe lotes del JSP → staging |
| POST | `/api/v1/legacy/validar/` | IsAdminRole | Valida un registro y crea paciente |

## 4. Tareas de mejora (con solución guiada)

### Mejora 2.A — Validar DNI peruano (8 dígitos)
**Problema:** el `dni` actual es CharField libre. **Mejora:** validate que sean 8 dígitos numéricos.

```python
# backend/apps/patients/models.py
from django.core.validators import RegexValidator

class Paciente(models.Model):
    ...
    # En Usuario (apps/accounts/models.py) el dni:
    dni = models.CharField(
        max_length=8,
        validators=[RegexValidator(r'^\d{8}$', 'El DNI debe tener 8 dígitos numéricos.')],
        blank=True,
    )
```
Luego en el frontend, en `Admin.jsx` añade `pattern="[0-9]{8}" maxLength={8}` al input dni. Commit: `accounts: validar DNI de 8 digitos`.

### Mejora 2.B — Buscar paciente también por nombre (no solo DNI en el wizard de Citas)
El Comp. 3 usa `/pacientes/?search=87654321`. El backend ya soporta `search` por `username`, `first_name`, `last_name`, `dni` (ver `PacienteViewSet` → `search_fields`). Pero el frontend del Comp. 3 solo busca por DNI. Ábrele un issue o comentalo; **tú** sí puedes enriquecer el endpoint `/pacientes/?condicion=DIABETES` para que devuelva pacientes con esa.condición:
```python
# views.py de patients, PacienteViewSet
filterset_fields = ["centro_salud_asignado", "condiciones__codigo"]
```
Así GET `/pacientes/?condiciones__codigo=DIABETES` filtra por condición crónica. Commit: `patients: filtrar por condicion cronica`.

### Mejora 2.C — Vista de detalle del paciente (historial consolidado)
**Mejora:** un endpoint que devuelve TODA la info de un paciente: datos + condiciones + últimas 10 citas + últimos 10 signos + recetas vigentes.

```python
# backend/apps/patients/views.py
@action(detail=True, methods=["get"])
def historial(self, request, pk=None):
    from apps.appointments.models import Cita
    from apps.clinical.models import SignoVital, Prescripcion
    from apps.prescriptions.models import Prescripcion  # solo si primero lo deja
    p = self.get_object()
    return Response({
        "paciente": PacienteSerializer(p).data,
        "citas": CitaSerializer(Cita.objects.filter(paciente=p)[:10], many=True).data,
        "signos": SignoVitalSerializer(SignoVital.objects.filter(paciente=p)[:20], many=True).data,
    })
```
Luego crea una página `PacienteDetalle.jsx` que llame a `/pacientes/{id}/historial/`. Commit: `patients: endpoint historial consolidado`.

### Mejora 2.D — Tests de tus modelos
```python
# backend/apps/patients/tests.py
from django.test import TestCase
from apps.accounts.models import Usuario
from .models import Paciente, CondicionCronica, PacienteCondicion

class PacienteTests(TestCase):
    def test_paciente_tiene_condicion(self):
        u = Usuario.objects.create_user("p1", "p@pe", "p1234567", rol="PACIENTE",
                                        first_name="A", last_name="B")
        p = Paciente.objects.create(usuario=u, fecha_nacimiento="1980-01-01")
        c = CondicionCronica.objects.create(nombre="Diabetes", codigo="DIABETES")
        PacienteCondicion.objects.create(paciente=p, condicion=c, fecha_diagnostico="2020-01-01")
        self.assertEqual(p.condiciones.count(), 1)
```
Commit: `patients: tests de modelo`.

## 5. Defensa oral rápida
> "Normalize los pacientes con suas condiciones crónicas mediante una tabla intermedia `PacienteCondicion` (M2M con fecha_diagnostico). Esta separación es clave porque los rangos normativos de glucosa varían si el paciente es diabético. La edad se calcula como propiedad derivada usando `date.today()`, y expongo `/pacientes/?condiciones__codigo=DIABETES` para filtrar por patología. Además implemento el staging del modulo legacy: el JSP publica a `/legacy/importar/` y el admin valida cada registro antes de crear el paciente vinculado — asi nunca confiamos en datos importados sin validación."

---

# 👤 BARJA — Agenda: horarios del médico + citas (calendario) ⭐ NÚCLEO (responsable: Erick)

**Rama:** `feature/barja`

## 1. Tu módulo y archivos

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/schedule/models.py` | `HorarioMedico` (plantilla semanal), `BloqueoAgenda` (excepciones), `calcular_disponibilidad()` |
| `backend/apps/schedule/views.py` | `HorarioMedicoViewSet`, `BloqueoAgendaViewSet` (con `disponibilidad/`) |
| `backend/apps/schedule/serializers.py` | Serializers (BloqueoAgenda oculta `motivo` al paciente) |
| `backend/apps/appointments/models.py` | `Cita` (con `creado_por` y restricción UNIQUE condicional) |
| `backend/apps/appointments/serializers.py` | Validación de fecha futura + 2h de anticipación + conflicto |
| `backend/apps/appointments/views.py` | `CitaViewSet` con concurrencia `select_for_update`, `cambiar_estado`, `reprogramar`, `cancelar`, `semana` |
| `frontend/src/pages/Horario.jsx` | Configurar/editar/borrar horarios y bloqueos (hero del médico con stats) |
| `frontend/src/pages/Citas.jsx` | Wizard por rol + calendario semanal + lista + botones de estado |

## 2. Lógica que ya implementamos

- **Plantilla semanal recurrente** (`HorarioMedico`): cada médico define por día de la semana (Lun=0…Dom=6) su rango de atención y duración de cada bloque. **No se permiten superposiciones** (validación en `clean()`).
- **Excepciones** (`BloqueoAgenda`): vacaciones/capacitaciones con `fecha_inicio/fin` y opcional `hora_inicio/fin` (para medio día). **El `motivo` es privado** y **se oculta al paciente** en `BloqueoAgendaSerializer.to_representation()` (privacidad Fla.A).
- **Disponibilidad real** = `calcular_disponibilidad(medico, fecha)` cruza las tres fuentes (Fla.B):
  1. `HorarioMedico` del día de la semana correspondiente (¿el médico atiende ese día?)
  2. `Cita` ya existente ese día para ese médico (slots ocupados)
  3. `BloqueoAgenda` vigente en esa fecha (¿está bloqueado?)
  → devuelve `(libres, ocupados)` listas de "HH:MM". El paciente solo ve **booleanos** (nunca nombres ni motivos).
- **Cita con trazabilidad**: `creado_por = FK Usuario` (paciente/personal medico/admin) + `creado_en`/`actualizado_en`.
- **Validaciones de Cita**:
  - Fecha futura (no pasado) y mínimo 2h de anticipación (Fla.B).
  - Concurrencia real: `create()` hace `select_for_update()` en transacción → si dos pacientes toman el mismo slot casi a la vez, el segundo recibe **409 "Horario ya no disponible"**.
  - Cancelar/reprogramar: mínimo 4h de anticipación (regla de negocio).
  - Restricción UNIQUE condicional (`estado != CANCELADA`) a nivel de BD → la copia de seguridad ante concurrencia.
- **Transiciones de estado** (`cambiar_estado`): PENDIENTE → CONFIRMADA → ATENDIDA. Estados terminales (ATENDIDA, CANCELADA) no pueden cambiar. Devuelve **409 con mensaje claro** si la transición es inválida.
- **Vista semana** (`/citas/semana/`): retorna citas de la semana actual — el frontend muestra calendario tipo grilla.

## 3. Endpoints clave
| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| GET/POST | `/api/v1/horarios/` | Médico (escritura) | CRUD plantilla semanal |
| GET/POST | `/api/v1/bloqueos/` | Médico | CRUD bloqueos |
| GET | `/api/v1/horarios/disponibilidad/?medico=2&fecha=2026-07-23` | Auth | Slots libres/ocupados |
| GET | `/api/v1/citas/` | Auth (filtrado por rol) | Lista de citas |
| POST | `/api/v1/citas/` | Auth | Crear cita (con validación de conflicto) |
| POST | `/api/v1/citas/{id}/cambiar_estado/` | Médico | Cambiar estado (valida transiciones) |
| POST | `/api/v1/citas/{id}/reprogramar/` | Auth | Reprogramar (mín 4h antes) |
| POST | `/api/v1/citas/{id}/cancelar/` | Auth | Cancelar (mín 4h antes) |
| GET | `/api/v1/citas/semana/` | Auth | Citas de la semana |

## 4. Tareas de mejora (con solución guiada)

### Mejora 3.A — Recordatorio por correo antes de la cita (RF-02)
**Problema:** hoy el "recordatorio" solo es un `print()` en consola del backend.

**Mejora real con console email (sin montar SMTP):**

Configura en `settings.py`:
```python
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "no-reply@saludconnect.pe"
```
Esto imprime el correo en la consola (suficiente para la demo; en producción se cambia a SMTP).

Añade un comando de management que busca citas de mañana y envía recordatorio:
```python
# backend/apps/appointments/management/commands/recordatorios.py
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from apps.appointments.models import Cita

class Command(BaseCommand):
    help = "Envía recordatorios de citas de mañana."
    def handle(self, *args, **options):
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        citas = Cita.objects.filter(fecha_hora__date=tomorrow, estado__in=["PENDIENTE","CONFIRMADA"], recordatorio_enviado=False)
        for c in citas:
            send_mail(
                subject="Recordatorio de su cita en SALUDCONNECT",
                message=f"Tiene una cita el {c.fecha_hora:%d/%m/%Y a las %H:%M} con {c.medico.get_full_name()}.",
                from_email=None,
                recipient_list=[c.paciente.usuario.email],
                fail_silently=True,
            )
            c.recordatorio_enviado = True
            c.save(update_fields=["recordatorio_enviado"])
        self.stdout.write(self.style.SUCCESS(f"Recordatorios enviados: {citas.count()}"))
```
Para crearlo, crea las carpetas `apps/appointments/management/commands/` con `__init__.py` vacíos en cada nivel. Correr:
```powershell
python manage.py recordatorios
```
(Opcional: programa con cron/Task Scheduler). Commit: `citas: enviar recordatorios por email (console backend)`.

### Mejora 3.B — Sobreventa SIEMPRE rechazada (demo de concurrencia)
Para demostrar durante la defensa que el sistema **de verdad** evita la sobreventa, prueba esto en consola Python:
```python
import threading
from django.test import Client
def post():
    c = Client()
    c.login(username="paciente1", password="paciente123")  # (o usa JWT)
    c.post("/api/v1/citas/", {"paciente":5,"medico":2,"fecha_hora":"2026-08-05T12:00:00","motivo":"x"})
ts = [threading.Thread(target=post) for _ in range(5)]
[t.start() for t in ts]; [t.join() for t in ts]
# Solo 1 debe tener status 201, las demás 409
```
Añade esto como test en `appointments/tests.py`. Commit: `citas: test de concurrencia (5 hilos)`.

### Mejora 3.C — Vista calendario mes completo
**Mejora:** en `Citas.jsx`, añade un toggle "Semana / Mes". Para el mes, en el backend añade:
```python
@action(detail=False, methods=["get"])
def mes(self, request):
    from datetime import timedelta
    inicio = timezone.now().date().replace(day=1)
    citas = self.get_queryset().filter(fecha_hora__date__gte=inicio, fecha_hora__date__lt=inicio + timedelta(days=31))
    return Response({"citas": CitaSerializer(citas, many=True).data})
```
Y en el frontend una grilla 7x5 (días del mes). Commit: `citas: vista mensual`.

### Mejora 3.D — Drag and drop para reprogramar (plus)
Más avanzado, opcional: usar `@dnd-kit/sortable` para arrastrar citas en el calendario. Requiere `npm install @dnd-kit/core @dnd-kit/sortable`. Te arriesgas a colisiones con cosas del Comp. 5; mejor coméntaselo primero.

### Mejora 3.E — Tests mínimos
```python
# backend/apps/appointments/tests.py
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Usuario
from apps.patients.models import Paciente
from .models import Cita
from django.utils import timezone

class CitaTests(TestCase):
    def setUp(self):
        self.medico = Usuario.objects.create_user("m","m@e.pe","m1234567",rol="MEDICO")
        self.paciente_u = Usuario.objects.create_user("p","p@e.pe","p1234567",rol="PACIENTE")
        self.paciente = Paciente.objects.create(usuario=self.paciente_u, fecha_nacimiento="1990-01-01")
        self.cita = Cita.objects.create(
            paciente=self.paciente, medico=self.medico,
            fecha_hora=timezone.now() + timezone.timedelta(days=2),
            motivo="x", creado_por=self.paciente_u)

    def test_no_cita_en_pasado(self):
        from rest_framework import serializers as srl
        from apps.appointments.serializers import CitaSerializer
        ser = CitaSerializer(data={"paciente":self.paciente.id,"medico":self.medico.id,
                                   "fecha_hora":"2020-01-01T10:00","motivo":"x"})
        self.assertFalse(ser.is_valid())
```
Commit: `citas: test de validacion de fecha pasada`.

## 5. Defensa oral rápida
> "El núcleo de la agenda es `HorarioMedico` (plantilla semanal recurrente) + `BloqueoAgenda` (excepciones). La disponibilidad se calcula **cruzando tres fuentes**: horario del día de la semana, citas ya tomadas y bloqueos vigentes. El paciente solo ve slots libres/ocupados (nunca nombres ni motivos — privacidad Fla.A). La cita valida fecha futura + 2h de anticipación y usa **`select_for_update` en transacción** para evitar sobreventa en concurrencia (si dos pacientes toman el mismo slot casi a la vez, el segundo recibe 409). Las transiciones de estado están modeladas (PENDIENTE → CONFIRMADA → ATENDIDA) con 409 para transiciones inválidas. Cumple RF-02 y el flujo Fla.B completo."

---

# 👤 SULLUCHUCO — Monitoreo de signos vitales + alertas + offline (responsable: Anyelo)

**Rama:** `feature/sulluchuco`

## 1. Tu módulo y archivos

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/clinical/models.py` | `RangoClinico` (general + por condición), `SignoVital` (presión con sis/dia), `Alerta` (leve/moderado/crítico), `RegistroOffline` |
| `backend/apps/clinical/serializers.py` | `SignoVitalSerializer` (calcula `fuera_de_rango` y `nivel_alerta`), crea `Alerta` automáticamente |
| `backend/apps/clinical/views.py` | `SignoVitalViewSet`, `tendencias/`, `sincronizar_offline/`, `AlertaViewSet` (`atender/`) |
| `frontend/src/pages/Monitoreo.jsx` | Registro de signos (incl. presión dual), cola offline local, alertas activas, tabla |
| `frontend/src/pages/Dashboard.jsx` | Gráfico Canvas con tendencias + exportación PDF (con tabla) |
| `frontend/src/components/CanvasChart.jsx` | Canvas puro (sin libs), series múltiples (presión sis+día) |
| `frontend/src/hooks/useHealthReducer.js` | `useHealthReducer` (hook obligatorio del caso) |
| `frontend/src/services/offlineStore.js` | Cola localStorage + sincronización |

## 2. Lógica que ya implementamos

- **RangoClinico configurable**: para cada tipo de signo (glucosa, SpO₂, etc.) hay un rango general (condicion_cronica=NULL) y rangos específicos por condición. La clase `RangoClinico.para(tipo, [condicion_ids])` **prioriza el rango de la condición** si existe; si no, usa el general. **Ejemplo clave**: glucosa normal 70-140, pero para diabético 80-180 (manual clínico).
- **Presión arterial**: un solo `SignoVital` tipo `PRESION` con dos campos `valor_sistolica` y `valor_diastolica` (decisión clínica: es más fiel a la realidad que dos registros separados).
- **Alerta automática**: cuando un `SignoVital` se crea fuera de rango, `SignoVitalSerializer.create()` crea automáticamente una `Alerta` con nivel `LEVE`, `MODERADO` o `CRITICO` según los umbrales extremos (`valor_min_critico`, `valor_max_critico`):
  - Si el valor está entre el rango normal y el crítico → MODERADO.
  - Si supera el umbral crítico → CRITICO.
  - No implementamos LEVE explícitamente pero queda reservado para futuras "alertas preventivas".
- **Modo offline (RNF-03)**: el frontend encola en `localStorage` (`offlineStore.js`) cuando `navigator.onLine = false` o falla la red. Al volver la conexión (evento `online`) o pulsar "Sincronizar ahora", se llama a `/signos/sincronizar_offline/` con todos los registros pendientes → crea `SignoVital` + `RegistroOffline` (auditoría). El signo se crea con `origen="OFFLINE"` y `registrado_en = capturado_en` (fecha del cliente, no la de sincronización — importante para tendencias correctas).
- **Tendencias** (`/signos/tendencias/`): retorna series por tipo de signo. Para `PRESION` cada punto tiene `sistolica` y `diastolica` (dos líneas en el canvas). El frontend (`CanvasChart.jsx`) dibuja:
  - Eje Y, ejes cartesianos.
  - **Banda verde** para el rango saludable (en signos no-PRESION).
  - **Líneas** por serie (roja sistólica, azul diastólica en PRESION).
  - **Puntos rojos** para los que están en alerta.

## 3. Endpoints clave
| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| GET/POST | `/api/v1/signos/` | Auth | Listar/crear signos |
| GET | `/api/v1/signos/tendencias/?paciente=1&tipo=GLUCOSA` | Auth | Series para gráfico |
| POST | `/api/v1/signos/sincronizar_offline/` | Auth | Crea lote de registros offline |
| GET | `/api/v1/alertas/?atendida=false` | Auth | Alertas no atendidas (paciente solo las suyas) |
| POST | `/api/v1/alertas/{id}/atender/` | Médico | Marca alerta atendida |
| GET | `/api/v1/rangos/` | Auth | Configuración de rangos |

## 4. Tareas de mejora (con solución guiada)

### Mejora 4.A — Exportar CSV de signos (además de PDF)
**Mejora:** botón "Exportar CSV" en Dashboard.

```javascript
// En Dashboard.jsx
const exportarCSV = () => {
  const filas = (series[tipo] || []).map(p =>
    `${new Date(p.fecha).toLocaleString('es-PE')},${p.valor},${p.en_alerta ? 'ALERTA' : 'OK'}`)
  const csv = `fecha,valor,estado\n${filas.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `signos_${tipo}.csv`; a.click()
}
```
Commit: `dashboard: exportar CSV de signos`.

### Mejora 4.B — Notificar al médico cuando hay alerta crítica
Cooperar con el Comp. 6 en `Layout.jsx`: que la campana priorice las alertas críticas (las marque en rojo urgente). Ya está hecha, pero puedes agregar **sonido** cuando llega una crítica:
```javascript
// En Layout.jsx, dentro del polling cuando nuevas > vistas:
if (notifs.some(n => n.critico)) new Audio('/beep.mp3').play()
```
Sube un `beep.mp3` corto a `frontend/public/`. Commit: `monitoreo: alerta sonora para alertas criticas`.

### Mejora 4.C — Mock de dispositivo IoT (simular lectura de oxímetro)
**Mejora divertida para la demo:** crea un endpoint que simule la lectura de un oxímetro Bluetooth:
```python
# backend/apps/clinical/views.py
@action(detail=False, methods=["post"])
def simular_dispositivo(self, request):
    """Simula la lectura de un oximetro IoT (mock)."""
    import random
    paciente_id = request.data.get("paciente")
    valor = random.randint(85, 99)  # SpO2 simulado
    sv = SignoVital.objects.create(
        paciente_id=paciente_id, tipo="SPO2", valor=valor, unidad="%",
        registrado_por=request.user, origen="SIMULADO",
        registrado_en=timezone.now())
    return Response(SignoVitalSerializer(sv).data, status=201)
```
Y un botón en el frontend: `<button onClick={simularDispositivo}>📟 Simular oxímetro</button>`. Llama a `/signos/simular_dispositivo/`. Commit: `monitoreo: mock de dispositivo IoT (oximetro)`.

### Mejora 4.D — Tests
```python
# backend/apps/clinical/tests.py
from django.test import TestCase
from apps.accounts.models import Usuario
from apps.patients.models import Paciente, CondicionCronica, PacienteCondicion
from .models import RangoClinico, SignoVital
import datetime

class SignoVitalTests(TestCase):
    def setUp(self):
        self.medico = Usuario.objects.create_user("m","m@e.pe","m1234567",rol="MEDICO")
        self.pU = Usuario.objects.create_user("p","p@e.pe","p1234567",rol="PACIENTE")
        self.p = Paciente.objects.create(usuario=self.pU, fecha_nacimiento="1990-01-01")
        self.diab = CondicionCronica.objects.create(nombre="Diabetes", codigo="DIABETES")
        PacienteCondicion.objects.create(paciente=self.p, condicion=self.diab, fecha_diagnostico="2020-01-01")
        # Rango para diabético
        RangoClinico.objects.create(tipo_signo="GLUCOSA", condicion_cronica=self.diab,
                                    valor_min=80, valor_max=180, valor_min_critico=60, valor_max_critico=300, unidad="mg/dL")

    def test_glucosa_diabetico_fuera_de_rango(self):
        sv = SignoVital(paciente=self.p, tipo="GLUCOSA", valor=250, unidad="mg/dL", registrado_por=self.medico)
        self.assertTrue(sv.fuera_de_rango)
        self.assertEqual(sv.nivel_alerta(), "MODERADO")
```
Commit: `monitoreo: tests de rango por condicion`.

## 5. Defensa oral rápida
> "El monitoreo distingue los rangos normativos por condición crónica — un diabético tiene rango de glucosa 80-180 mg/dL mientras un paciente sano 70-140. La validación se hace en `SignoVitalSerializer.create()`: compara contra `RangoClinico.para(tipo, condiciones)` y si está fuera genera automáticamente una `Alerta` con nivel MODERADO o CRITICO según umbrales extremos. Para presión arterial uso dos campos (sistólica/diastólica) en un mismo registro, fiel a la realidad clínica. El modo offline (RNF-03) encola los signos en localStorage del navegador y los sincroniza al recuperar la conexión, conservando la fecha original de captura (no la de sincronización) para que las tendencias sean correctas. El dashboard grafica series múltiples con Canvas puro, banda verde de rango saludable y exporta PDF con tabla de datos."

---

# 👤 TORIBIO — Prescripciones (recetas + QR) + Derivaciones + notificaciones ⭐ (responsable: David Angel)

**Rama:** `feature/toribio`

## 1. Tu módulo y archivos

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/prescriptions/models.py` | `Prescripcion` (firma_simulada SHA-256, codigo_verificacion, vigente_hasta), `DetallePrescripcion` (1..N medicamentos) |
| `backend/apps/prescriptions/serializers.py` | `PrescripcionSerializer` con detalles anidados, `qr_payload` |
| `backend/apps/prescriptions/views.py` | `PrescripcionViewSet`, `verificar/` (valida por código QR) |
| `backend/apps/referrals/models.py` | `Derivacion` (especialista_destino filtrado por especialidad), `AdjuntoDerivacion` |
| `backend/apps/referrals/views.py` | `DerivacionViewSet`, `cambiar_estado/`, `adjuntos/` |
| `frontend/src/pages/Prescripciones.jsx` | Emitir receta con medicamentos anidados, QR, PDF, modal Verificar QR |
| `frontend/src/pages/Derivaciones.jsx` | Crear derivación, filtrar especialistas por especialidad, subir adjuntos, cambiar estado |

## 2. Lógica que ya implementamos

- **Prescripción con firma simulada** (`Prescripcion.save()`): al crear se calcula `codigo_verificacion` (UUID corto) y `firma_simulada` = `SHA-256(medico_id + paciente_id + codigo + fecha_emision)`. **Inmutable** tras crear (el viewset sólo permite `GET` y `POST`).
- **Detalles anidados**: `PrescripcionSerializer` recibe `{... , detalles: [{medicamento, dosis, frecuencia, duracion_dias}, ...]}` y crea automáticamente los `DetallePrescripcion` (transaccional).
- **Vigencia**: `vigente_hasta = fecha_emision + 30 días` (default). El verificador lo muestra como badge VIGENTE/VENCIDA.
- **Verificación QR**: el QR codifica `SALUDCONNECT|codigo|firma16`. El endpoint `/prescripciones/verificar/?codigo=XXX` retorna `{valida:true/false, vigente:bool, receta:{...}}`. El frontend muestra un modal con el documento completo + tabla de medicamentos + firma SHA-256.
- **Derivaciones**:
  - El `especialista_destino` es **un médico con una especialidad específica** (no un rol aparte) — decisión de modelado alineada con el caso. Se filtra en el frontend por `especialidad_destino`.
  - `estado`: PENDIENTE → ACEPTADA/RECHAZADA → COMPLETADA. `fecha_respuesta` se setea cuando cambia.
  - `AdjuntoDerivacion` permite subir archivos (exámenes, informes) vía `/derivaciones/{id}/adjuntos/`.

## 3. Endpoints clave
| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| POST | `/api/v1/prescripciones/` | Médico | Crear receta con detalles anidados |
| GET | `/api/v1/prescripciones/` | Auth (paciente solo las suyas) | Lista |
| GET | `/api/v1/prescripciones/verificar/?codigo=XXX` | Público | Verifica autenticidad (no pide token) |
| POST | `/api/v1/derivaciones/` | Médico | Crear derivación |
| GET | `/api/v1/derivaciones/` | Auth | Lista (paciente solo las suyas) |
| POST | `/api/v1/derivaciones/{id}/cambiar_estado/` | Médico | Aceptar/rechazar/completar |
| POST | `/api/v1/derivaciones/{id}/adjuntos/` | Médico | Subir archivo adjunto |

## 4. Tareas de mejora (con solución guiada)

### Mejora 5.A — Escanear QR con la cámara del celular → ver PDF 🔥 (pediste esto)
**Objetivo:** desde el celular, abrir la app, escanear el QR de una receta impresa y ver el PDF sin loguearse.

**Paso 1** — Crea una página pública de verificación en el frontend.

Crea `frontend/src/pages/VerificarQR.jsx`:
```jsx
import { useState, useRef } from 'react'
import { QrReader } from 'react-qr-scanner'  // librería liviana

export default function VerificarQR() {
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const verificar = async (cod) => {
    setError(''); setResultado(null)
    try {
      const r = await fetch(`/api/v1/prescripciones/verificar/?codigo=${cod}`)
      const d = await r.json()
      if (!d.valida) { setError('Receta NO encontrada.'); return }
      setResultado(d)
    } catch (e) { setError(e.message) }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1>Verificar receta</h1>
      <p>Escanea el QR o ingresa el código manualmente.</p>
      <QrReader
        constraints={{ facingMode: 'environment' }}
        onResult={(res) => { if (res?.text) { const cod = res.text.split('|')[1]; verificar(cod) } }}
        style={{ width: '100%' }}
      />
      <input value={codigo} placeholder="Ej. E30D9380F8F7"
        onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
      <button onClick={() => verificar(codigo)}>Verificar</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {resultado && (
        <div style={{ marginTop: 20 }}>
          <h3>Receta auténtica ✓</h3>
          <p>Paciente: {resultado.receta.paciente_nombre}</p>
          {/* ... tabla de medicamentos como en Prescripciones.jsx ... */}
          <button onClick={() => window.open(`/api/v1/prescripciones/${resultado.receta.id}/pdf`, '_blank')}>
            Ver PDF
          </button>
        </div>
      )}
    </div>
  )
}
```

**Paso 2** — Instala la lib: `npm install react-qr-scanner` (es liviana, ~50 KB).

**Paso 3** — Agrega la ruta pública en `App.jsx`:
```jsx
<Route path="/verificar-qr" element={<VerificarQR />} />  // fuera del PrivateRoute
```

**Paso 4** — (Apoyas al Comp. 6) Crea el endpoint público de PDF. En `apps/prescriptions/views.py`:
```python
from django.http import HttpResponse

@action(detail=True, methods=["get"], permission_classes=[])
def pdf(self, request, pk=None):
    """PDF público (validado por codigo_verificacion en la URL)."""
    from reportlab.pdfgen import canvas as rl
    p = self.get_object()
    # Verifica que el codigo pasado coincida
    codigo_url = request.query_params.get("codigo", "")
    if codigo_url != p.codigo_verificacion:
        return HttpResponse(status=403)
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="receta_{p.codigo_verificacion}.pdf"'
    c = rl.Canvas(response)
    c.drawString(100, 800, f"SALUDCONNECT - Receta {p.codigo_verificacion}")
    c.drawString(100, 780, f"Paciente: {p.paciente.nombre_completo}")
    c.drawString(100, 760, f"Medico: Dr(a). {p.medico.get_full_name()}")
    y = 740
    for d in p.detalles.all():
        c.drawString(100, y, f"- {d.medicamento} | {d.dosis} | {d.frecuencia} | {d.duracion_dias}d")
        y -= 20
    c.showPage(); c.save()
    return response
```
Necesitas `reportlab`: añade `reportlab>=4.0` a `requirements.txt` y `pip install reportlab`.

**Paso 5** — La ruta en `urls.py` ya está como action del ViewSet (`/prescripciones/{id}/pdf/?codigo=XXX`).

**Paso 6** — En el botón "Ver PDF" del Paso 1, cambia la URL a:
```js
window.open(`/api/v1/prescripciones/${resultado.receta.id}/pdf/?codigo=${resultado.receta.codigo_verificacion}`, '_blank')
```

**Paso 7** — Prueba desde tu celular: abre `http://IP_DE_TU_PC:5173/verificar-qr` (asegúrate de que Vite corra con `--host`: en `vite.config.js` añade `server: { host: true, ... }`). Apunta la cámara al QR de una receta emitida → la cámara lo lee → ves el documento → botón "Ver PDF".

Commit: `prescripciones: verificar QR con camara + PDF publico`.

### Mejora 5.B — Derivaciones notifican al especialista (campana + browser notif + opcional Telegram) 🔥 (pediste esto)

**Parte 1 — Backend emite evento al cambiar estado.** En `apps/referrals/views.py`, dentro de `cambiar_estado`:
```python
def cambiar_estado(self, request, pk=None):
    ...
    deriv.save()
    # Notificacion in-app: crea entrada en una tabla Notificacion (o usa LogAuditoria con action="NOTIF")
    from apps.audit.models import LogAuditoria
    LogAuditoria.objects.create(
        usuario=deriv.especialista_destino.username if deriv.especialista_destino else "especialista",
        accion="NOTIF", modelo_afectado="Derivacion", objeto_id=deriv.pk,
        ip_address=None, detalle=f"Derivacion #{deriv.pk}: {nuevo}")
    return Response(...)
```
(La campana ya recoge alertas + citas pendientes; ahora agrega "NOTIF" de LogAuditoria filtrado por usuario=yo y accion="NOTIF". O crea una app `notifications` limpia — más prolijo.)

**Parte 2 — Campana recoge notificaciones.** Coordina con Comp. 6. En `Layout.jsx`, dentro del polling añade:
```js
const n = await api('/admin-panel/auditoria/?accion=NOTIF&usuario=' + user.username)
;(n.results || n).forEach(x => items.push({
  id: 'n'+x.id, tipo:'notif', icon:'🔔',
  texto: x.detalle, link:'/derivaciones'
}))
```

**Parte 3 — Opcional Telegram real.** Only si quieres ir más allá:
1. Crea un bot: en Telegram habla con `@BotFather` → `/newbot` → guarda el `token`.
2. quién sea el especialista debe iniciar una conversación con el bot y mandar `/start`; el bot captura el `chat_id`.
3. En `Derivacion.save()` o `cambiar_estado()`, al cambiar estado:
```python
import requests
def notificar_telegram(chat_id, mensaje, token):
    requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                  data={"chat_id": chat_id, "text": mensaje})

notificar_telegram(chat_id="123456",
    mensaje=f"Derivación #{deriv.pk}: estado {nuevo}", token="BOT_TOKEN")
```
4. Guarda `BOT_TOKEN` en `.env` (no lo commitees — está en `.gitignore`).
5. Almacena el `chat_id` por usuario (en una tabla `PerfilTelegram` con `usuario` + `chat_id`).

Commit: `derivaciones: notificar al especialista (campana + browser)`.
(O si hiciste Telegram: `derivaciones: notificacion por Telegram real`.)

### Mejora 5.C — Marcar receta como "usada" en farmacia
**Mejora:** un farmacéutico puede marcar la receta como dispensada (un contador de usos). Añade campo `veces_dispensada` a `Prescripcion` y un endpoint `/prescripciones/{id}/dispensar/` que la incrementa si `veces_dispensada < 3` (máximo 3 dispensaciones). Commit: `prescripciones: controlar dispensacion en farmacia`.

### Mejora 5.D — Tests
```python
# backend/apps/prescriptions/tests.py
from django.test import TestCase
from apps.accounts.models import Usuario
from apps.patients.models import Paciente
from .models import Prescripcion, DetallePrescripcion

class PrescripcionTests(TestCase):
    def setUp(self):
        self.med = Usuario.objects.create_user("m","m@e.pe","m1234567",rol="MEDICO")
        self.pU = Usuario.objects.create_user("p","p@e.pe","p1234567",rol="PACIENTE")
        self.p = Paciente.objects.create(usuario=self.pU, fecha_nacimiento="1990-01-01")
    def test_creacion_con_detalles(self):
        pres = Prescripcion.objects.create(paciente=self.p, medico=self.med)
        DetallePrescripcion.objects.create(prescripcion=pres, medicamento="Test",
                                           dosis="1", frecuencia="diaria", duracion_dias=7)
        self.assertEqual(pres.detalles.count(), 1)
        self.assertEqual(len(pres.codigo_verificacion), 12)
        self.assertEqual(len(pres.firma_simulada), 64)
```
Commit: `prescripciones: tests de creacion y firma`.

## 5. Defensa oral rápida
> "La prescripción digital genera automáticamente un `codigo_verificacion` UUID de 12 caracteres y una `firma_simulada` SHA-256 que actúa como sello anti-tamper (sobrescribe el save() del modelo). El contenido puede anidar N medicamentos (`DetallePrescripcion`). El QR codifica `SALUDCONNECT|codigo|firma16` y se verifica en `/prescripciones/verificar/` — como ese endpoint es público, también funciona desde el celular escaneando el QR con la cámara. Las derivaciones modelan al especialista como un médico con una especialidad distinta (no como un rol aparte, fiel al caso) y notifican al médico receptor vía campana + browser notification (y opcional Telegram con un bot)."

---

# 👤 YAURI — Administración + Auditoría inmutable + Infraestructura (Docker/K8s/legacy JSP) (responsable: Benjamín)

**Rama:** `feature/yauri`

## 1. Tu módulo y archivos

| Carpeta/archivo | Qué contiene |
|----|---------------|
| `backend/apps/audit/models.py` | `LogAuditoria` inmutable (override save/delete para impedir edición) |
| `backend/apps/audit/middleware.py` | `AuditMiddleware` (registra todo request a /api/) |
| `backend/apps/audit/signals.py` | Signals que poblan `modelo_afectado` y `objeto_id` en creaciones/ediciones |
| `backend/apps/audit/views.py` | `LogAuditoriaViewSet` (solo lectura, IsAdminRole), `respaldo/` |
| `backend/apps/audit/urls.py` | `/api/v1/admin-panel/auditoria/` |
| `backend/apps/core/management/commands/seed.py` | Carga datos de demo |
| `backend/config/settings.py` | Config global (DB, throttle, rangos clínicos, JWT) |
| `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | Imágenes Docker |
| `docker-compose.yml` | Stack completo con PostgreSQL |
| `k8s/` | Namespace, ConfigMap, Deployments + probes + PVC + NetworkPolicy |
| `legacy/patient-sync.jsp`, `legacy/historiales.csv` | Módulo JSP legacy |
| `frontend/src/components/Layout.jsx` | Sidebar + campana de notificaciones |
| `frontend/src/pages/Admin.jsx` | Panel admin: usuarios, auditoría inmutable, respaldo, staging legacy |

## 2. Lógica que ya implementamos

- **LogAuditoria inmutable** (`apps/audit/models.py`): el `save()` levanta `ValueError` si ya tiene `pk` (no se actualiza), y el `delete()` levanta `ValueError` (no se borra). En el `admin.py` se quitan los permisos de add/change/delete. **RNF-04 cumplido**.
- **Adquisición automática**: `AuditMiddleware` registra cada request a `/api/` con `usuario`, `accion` (HTTP method), `ip_address`, `timestamp` y `detalle` (status + path). Paraaccurate tracking, además **signals** (`signals.py`) registran operaciones sensibles en modelos de `Cita`, `SignoVital`, `Prescripcion`, `Derivacion`, `Usuario` poblaando `modelo_afectado` y `objeto_id`.
- **Respaldo** (`/admin-panel/auditoria/respaldo/`): genera conteos de todas las tablas (mock de backup) y crea una entrada `accion="EXPORT"` en el log.
- **Seed command** (`core/management/commands/seed.py`): carga centros, especialidades, 3 médicos (con perfiles y horarios), 3 pacientes (con condiciones), 14 días de signos vitales (incluyendo presión dual), 1 cita, 1 prescripción con 2 medicamentos y 1 derivación. **Idempotente** (no reseedeá si ya existe `admin`). Decisión de diseño: cada condicionante ya tiene `mfa_enabled=True` para que el login esté real desde el 1er día.
- **Docker**: `docker-compose.yml` con 3 servicios (postgres:16-alpine, backend con gunicorn + auto-migrate, frontend con nginx + proxy y headers de seguridad). `Dockerfile` del backend corre `migrate && seed` en el CMD.
- **Kubernetes**: `k8s/` con Namespace, ConfigMap (rangos clínicos via env), Secret (DJANGO_SECRET_KEY, POSTGRES_PASSWORD), Deployment postgres + PVC, Deployment backend (2 replicas + readiness/liveness probes), Deployment frontend, Service NodePort, NetworkPolicy (egress básico).
- **Legacy JSP**: `legacy/patient-sync.jsp` lee `historiales.csv` y hace POST a `/api/v1/legacy/importar/` (staging). Despliegue: copiar a `webapps/legacy/` de Tomcat y llamar `http://localhost:8080/legacy/patient-sync.jsp?token=JWT_ADMIN`.

## 3. Endpoints clave (audit)
| Método | Ruta | Permiso | Función |
|--------|------|---------|---------|
| GET | `/api/v1/admin-panel/auditoria/` | IsAdminRole | Log inmutable |
| POST | `/api/v1/admin-panel/auditoria/respaldo/` | IsAdminRole | Genera respaldo |
| GET | `/api/v1/legacy/` | IsAdminRole | Registros en staging |
| POST | `/api/v1/legacy/importar/` | Auth | Recibe lotes JSP |
| POST | `/api/v1/legacy/validar/` | IsAdminRole | Crea/rechaza paciente |

## 4. Tareas de mejora (con solución guiada)

### Mejora 6.A — Respaldo real (descargar JSON)
**Problema:** el respaldo actual solo devuelve conteos. **Mejora:** descargar un archivo JSON con todos los datos.

```python
# backend/apps/audit/views.py, en respaldo():
@action(detail=False, methods=["get"])
def descargar_respaldo(self, request):
    from django.http import HttpResponse
    import json
    from apps.appointments.models import Cita
    from apps.clinical.models import SignoVital, Prescripcion
    from apps.patients.models import Paciente
    from apps.referrals.models import Derivacion
    data = {
        "pacientes": list(Paciente.objects.values()),
        "citas": list(Cita.objects.values()),
        "signos": list(SignoVital.objects.values()),
        "prescripciones": list(Prescripcion.objects.values()),
        "derivaciones": list(Derivacion.objects.values()),
        "logs": list(LogAuditoria.objects.values()),
    }
    resp = HttpResponse(json.dumps(data, default=str), content_type='application/json')
    resp['Content-Disposition'] = 'attachment; filename="respaldo_saludconnect.json"'
    return resp
```
Commit: `audit: respaldo descargable JSON`.

### Mejora 6.B — Exportar log de auditoría a CSV
```python
@action(detail=False, methods=["get"])
def exportar_csv(self, request):
    import csv
    from django.http import HttpResponse
    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename="auditoria.csv"'
    w = csv.writer(resp)
    w.writerow(['timestamp', 'usuario', 'accion', 'modelo', 'objeto_id', 'ip', 'detalle'])
    for log in LogAuditoria.objects.all():
        w.writerow([log.timestamp, log.usuario, log.accion, log.modelo_afectado,
                    log.objeto_id, log.ip_address, log.detalle])
    return resp
```
Añade botón en `Admin.jsx`: `<button onClick={() => window.open('/api/v1/admin-panel/auditoria/exportar_csv/')}>Exportar CSV</button>`. Commit: `audit: exportar log a CSV`.

### Mejora 6.C — Healthcheck endpoint (mejora probes K8s)
```python
# backend/config/urls.py
path("health/", lambda r: HttpResponse("OK"))

# o como view en audit
@action(detail=False, methods=["get"], permission_classes=[])
def health(self, request):
    from django.db import connection
    try:
        connection.ensure_connection()
        return Response({"status": "OK", "db": "OK"})
    except Exception as e:
        return Response({"status": "FAIL", "db": str(e)}, status=503)
```
Actualiza los probes en `k8s/03-backend.yaml` para usar `/health/` (no requiere auth). Commit: `audit: endpoint /health/ para probes K8s`.

### Mejora 6.D — Healthcheck en productos: rate limiting visual en el panel admin
**Mejora:** mostrar en Admin.jsx cuántos throttles se han disparado en últimas 24h:
```js
const logs = await api('/admin-panel/auditoria/?accion=GET&page_size=200')
const throttled = logs.results.filter(l => l.detalle.includes('429')).length
```
Y muéstralo como stat card. Commit: `audit: mostrar throttles recientes en panel`.

### Mejora 6.E — Validar que legacy JSP compila con Tomcat real (evidencia para la rúbrica)
Si tienes tiempo: baja Tomcat 9 zip (`https://tomcat.apache.org/`), copia `legacy/` a `webapps/legacy/`, inicia `bin/startup.bat` y prueba `http://localhost:8080/legacy/patient-sync.jsp?token=JWT`. Es la **evidencia física** del módulo legacy. Documenta con captura en el README. Commit: `docs: evidencia de Tomcat con JSP legacy`.

### Mejora 6.F — Múltiples réplicas en K8s (sólo lectura)
`k8s/03-backend.yaml` ya trae `replicas: 2`. Prúebalo:
```powershell
kubectl scale deployment backend -n saludconnect --replicas=4
kubectl get pods -n saludconnect
# Debes ver 4 pods backend
```
Commit: `docs: evidencia de escalado horizontal (4 replicas)`.

### Mejora 6.G — Tests de inmutabilidad del LogAuditoria (muy importante para defensa)
```python
# backend/apps/audit/tests.py
from django.test import TestCase
from .models import LogAuditoria

class InmutabilidadTests(TestCase):
    def test_no_se_puede_editar(self):
        log = LogAuditoria.objects.create(usuario="x", accion="GET", ip_address="127.0.0.1")
        log.usuario = "otro"
        with self.assertRaises(ValueError):
            log.save()

    def test_no_se_puede_borrar(self):
        log = LogAuditoria.objects.create(usuario="x", accion="GET", ip_address="127.0.0.1")
        with self.assertRaises(ValueError):
            log.delete()
```
Commit: `audit: tests de inmutabilidad del LogAuditoria`.

## 5. Defensa oral rápida
> "Implementé la auditoría inmutable en `LogAuditoria`: el `save()` lanza `ValueError` si el registro ya tiene `pk` (no se edita) y el `delete()` lanza `ValueError` (no se borra) — el admin incluso en la interfaz Django Admin no tiene permisos de add/change/delete. Los registros se capturan de dos formas: el `AuditMiddleware` registra cada request a `/api/` con usuario, IP, timestamp y status; y los `signals` añaden `modelo_afectado` y `objeto_id` en operaciones sensibles (Cita, SignoVital, Prescripcion, Derivacion). Esto cumple RNF-04 con trazabilidad completa. Para infraestructura, `docker-compose.yml` levanta PostgreSQL 16 + gunicorn + nginx con headers HSTS/nosniff (RNF-01) y `k8s/` define ConfigMap (rangos clínicos), probes readiness/liveness, PVC y NetworkPolicy (RNF-07). El módulo legacy JSP publica CSV a staging y el admin valida cada registro antes de crear el paciente (principio de no confiar en datos externos)."

---

# 🎯 Resumen final para el coordinador

```text
1. git clone https://github.com/USUARIO/saludconnect.git && cd saludconnect
2. Reparte las 6 ramas (una por persona):
   - feature/auth-mfa                  → Compañero 1
   - feature/pacientes                 → Compañero 2
   - feature/agenda                    → Compañero 3
   - feature/monitoreo                 → Compañero 4
   - feature/prescripciones-derivaciones → Compañero 5
   - feature/admin-audit-devops        → Compañero 6
3. Cada uno: checkout su rama, lee su sección aquí, hace mínimo 3 commits + 1 mejora + 1 PR.
4. Coordinador revisa PRs (merge a main solo tras aprobación).
5. Día de la defensa: ejecuta todo desde main (python manage.py migrate && seed)
   y cada uno explica SU módulo en la defensa oral (frase lista en su sección).
```

### Dependencia entre módulos (qué necesita cada uno de quién)
- **C1 (auth)** → independiente.
- **C2 (patients)** → depende de C1 (Usuario).
- **C3 (agenda)** → depende de C1 (Usuario/Medico) y C2 (Paciente).
- **C4 (monitoreo)** → depende de C2 (Paciente, CondicionCronica).
- **C5 (prescripciones+derivaciones)** → depende de C2 (Paciente), C3 (Cita), C1 (Especialista).
- **C6 (audit/devops)** → independiente (registra todos los demás).

**Recomendación de orden de merge:** C1 → C2 → C3 → C4 → C5 → C6. Si C3/C4/C5 tienen dependencias circulares con sus mejoras, prioriza al que menos dependencias interponga (C3 primero, porque C5 y C4 pueden usar cita).

### Checklist final por compañero (antes de defensa)
- [ ] Mínimo **3 commits** en su rama + **1 PR mergeado**.
- [ ] Al menos **1 mejora sugerida** implementada y probada (o documentada si es muy grande).
- [ ] **1 test mínimo** de su módulo (defended como "TDD/evidencia").
- [ ] Frase de defensa oral **memorizada** (en su sección).
- [ ] Actualiza la sección de su módulo en el README (matriz RF/RNF que toca).

¡Mucha suerte! Recuerden que cada commit y cada PR cuenta para la rúbrica de Defensa + Documentación + Ética (40% combinado de la nota total).