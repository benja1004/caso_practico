# INFORME TÉCNICO FINAL — SALUDCONNECT

## Portal de Telemedicina y Monitoreo de Pacientes Crónicos

**Versión:** 1.0  
**Fecha:** Julio 2026  
**Equipo:** 6 integrantes (BARJA, NAVARRO, SULLUCHUCO, TORIBIO, YAURI, HUAYNATE)

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Modelo de Base de Datos (20 Entidades)](#3-modelo-de-base-de-datos-20-entidades)
4. [Lógica de Negocio por Módulo](#4-lógica-de-negocio-por-módulo)
5. [Frontend (React + Vite)](#5-frontend-react--vite)
6. [Requisitos No Funcionales (RNF)](#6-requisitos-no-funcionales-rnf)
7. [Infraestructura (Docker + Kubernetes)](#7-infraestructura-docker--kubernetes)
8. [Módulo Legacy (JSP)](#8-módulo-legacy-jsp)
9. [API REST — Endpoints Completos](#9-api-rest--endpoints-completos)
10. [Seguridad](#10-seguridad)
11. [Reparto por Integrante](#11-reparto-por-integrante)
12. [Guía de Despliegue](#12-guía-de-despliegue)

---

## 1. Resumen Ejecutivo

SALUDCONNECT es un portal web de telemedicina diseñado para centros de salud rurales de la sierra central del Perú. El sistema permite:

- **Autenticación multifactor (MFA TOTP)** con JWT y control de roles estricto (RBAC).
- **Agendamiento de citas** con cálculo de disponibilidad en tiempo real (horario médico + bloqueos + citas existentes).
- **Monitoreo de signos vitales** con rangos adaptados por condición crónica y alertas automáticas de 3 niveles.
- **Prescripciones digitales** con firma simulada SHA-256 y código QR verificable.
- **Derivaciones** entre niveles de atención con notificaciones al especialista destino.
- **Auditoría inmutable** de todas las acciones sensibles (middleware + signals).
- **Modo offline** para centros sin conectividad estable.
- **Migración legacy** desde sistema JSP anterior con staging y validación.
- **Infraestructura containerizada** con Docker Compose y manifiestos Kubernetes.

**Stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.2 + DRF 3.15 + SimpleJWT |
| Frontend | React 18 + Vite 5 + React Router 6 |
| BD | PostgreSQL 16 (prod) / SQLite (dev) |
| Auth | JWT (15 min) + TOTP (pyotp) |
| Infra | Docker Compose + Kubernetes (k8s/) |
| Docs API | drf-spectacular (Swagger UI + ReDoc) |
| Legacy | JSP (Tomcat) + CSV |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (SPA)                       │
│  React 18 + Vite — http://localhost:5173 (dev)          │
│  React 18 + nginx  — http://localhost:8080 (Docker)     │
└───────────────┬─────────────────────────────────────────┘
                │  HTTP/JSON (JWT Bearer)
                ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND — Django + DRF                      │
│  http://localhost:8000 (dev/Docker)                     │
│                                                         │
│  9 apps:                                               │
│  accounts │ patients │ schedule │ appointments         │
│  clinical │ prescriptions │ referrals │ audit │ legacy │
│                                                         │
│  Middleware: CORS → Auth → Audit → Throttle            │
│  Signals: post_save/post_delete → LogAuditoria         │
└───────┬─────────────────────────────────┬───────────────┘
        │                                 │
        ▼                                 ▼
┌───────────────┐              ┌─────────────────┐
│  PostgreSQL   │              │   Módulo Legacy │
│  (Docker)     │              │   patient-sync  │
│  saludconnect │              │   .jsp (Tomcat) │
│  Usuario:salud│              │   CSV → API     │
└───────────────┘              └─────────────────┘
```

### Estructura de carpetas

```
salud/
├── backend/
│   ├── apps/
│   │   ├── accounts/        # Usuario, CentroSalud, Especialidad, PerfilMedico
│   │   ├── patients/        # Paciente, CondicionCronica, PacienteCondicion
│   │   ├── schedule/        # HorarioMedico, BloqueoAgenda
│   │   ├── appointments/    # Cita
│   │   ├── clinical/        # RangoClinico, SignoVital, Alerta, RegistroOffline
│   │   ├── prescriptions/   # Prescripcion, DetallePrescripcion
│   │   ├── referrals/       # Derivacion, AdjuntoDerivacion
│   │   ├── audit/           # LogAuditoria (inmutable)
│   │   ├── legacy/          # RegistroLegacy (staging JSP)
│   │   └── core/            # seed (datos demo)
│   ├── config/              # settings.py, urls.py, wsgi.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # 9 páginas (Login, Citas, Monitoreo, etc.)
│   │   ├── components/      # Layout.jsx, CanvasChart.jsx
│   │   ├── context/         # AuthContext.jsx
│   │   ├── services/        # api.js, offlineStore.js
│   │   └── styles.css
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/                     # 4 manifiestos Kubernetes
├── legacy/                  # patient-sync.jsp + historiales.csv
├── docker-compose.yml
├── PROYECTO-GUIA-EQUIPO.md
├── guia-equipos.md
└── INFORME-FINAL.md          ← este archivo
```

---

## 3. Modelo de Base de Datos (20 Entidades)

La BD está completamente normalizada (3FN) con 20 entidades distribuidas en 9 apps Django. A continuación el detalle de cada entidad, sus campos y relaciones.

### 3.1 App: accounts (4 entidades)

#### 3.1.1 Usuario
Hereda de `AbstractUser`. Modelo de autenticación principal con RBAC y MFA TOTP.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `username` | CharField(150) | Único, heredado |
| `email` | EmailField | Correo electrónico |
| `first_name` | CharField(150) | Nombres |
| `last_name` | CharField(150) | Apellidos |
| `rol` | CharField(10) | ADMIN / MEDICO / PACIENTE (choices) |
| `dni` | CharField(8) | Documento de identidad |
| `telefono` | CharField(20) | Teléfono de contacto |
| `mfa_secret` | CharField(64) | Secreto TOTP (auto-generado con pyotp) |
| `mfa_enabled` | Boolean | MFA activado |
| `intentos_fallidos` | PositiveSmall | Contador de intentos fallidos |
| `bloqueado_hasta` | DateTime | Bloqueo temporal (15 min tras 3 intentos) |
| `ultimo_acceso` | DateTime | Último login (trazabilidad) |

**Métodos clave:**
- `generar_totp()` → código TOTP actual (pyotp.TOTP.now())
- `verificar_totp(code)` → valida con ventana de ±30s
- `registrar_intento_fallido()` → bloquea tras 3 intentos por 15 min
- `otpauth_uri()` → URI para QR de Google Authenticator
- `save()` override → auto-genera `mfa_secret` si está vacío

#### 3.1.2 CentroSalud

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | CharField(150) | Nombre del establecimiento |
| `nivel_atencion` | PositiveSmall | 1=Puesto rural, 2=Centro, 3=Especializado |
| `ubicacion` | CharField(200) | Dirección/ubicación geográfica |
| `tiene_conectividad_estable` | Boolean | Para activar/desactivar modo offline |

#### 3.1.3 Especialidad

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | CharField(100) | Único. Ej: Medicina General, Cardiología, Neumología |

#### 3.1.4 PerfilMedico
Relación 1:1 con Usuario (solo médicos). Un especialista es un médico con especialidad distinta a Medicina General.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `usuario` | OneToOne(Usuario) | FK al usuario médico |
| `especialidad` | FK(Especialidad) | PROTECT |
| `centro_salud` | FK(CentroSalud) | PROTECT |
| `numero_colegiatura` | CharField(20) | CMP |

### 3.2 App: patients (3 entidades)

#### 3.2.1 Paciente
Relación 1:1 con Usuario (solo pacientes).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `usuario` | OneToOne(Usuario) | FK CASCADE |
| `fecha_nacimiento` | DateField | Para cálculo de edad |
| `direccion` | CharField(200) | Dirección domiciliaria |
| `centro_salud_asignado` | FK(CentroSalud) | PROTECT, nullable |
| `contacto_emergencia` | CharField(100) | Nombre y teléfono |

**Propiedades calculadas:**
- `nombre_completo` → usuario.get_full_name() o username
- `edad` → cálculo desde fecha_nacimiento

#### 3.2.2 CondicionCronica
Catálogo: Diabetes, Hipertensión, EPOC.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | CharField(50) | Único |
| `codigo` | CharField(20) | Único. Ej: DIABETES, HIPERTENSION, EPOC |

#### 3.2.3 PacienteCondicion
Tabla intermedia M2M (Paciente ↔ CondicionCronica) con metadatos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente` | FK(Paciente) | CASCADE |
| `condicion` | FK(CondicionCronica) | PROTECT |
| `fecha_diagnostico` | DateField | Cuándo se diagnosticó |

**Constraint:** `unique_together = ("paciente", "condicion")`

### 3.3 App: schedule (2 entidades)

#### 3.3.1 HorarioMedico
Plantilla semanal recurrente del médico. Aquí se calculan los slots disponibles.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `medico` | FK(Usuario) | limit_choices_to rol=MEDICO |
| `dia_semana` | PositiveSmall | 0=Lunes ... 6=Domingo |
| `hora_inicio` | TimeField | Inicio del bloque |
| `hora_fin` | TimeField | Fin del bloque |
| `duracion_cita_min` | PositiveSmall | Default 30 min |
| `activo` | Boolean | Para desactivar sin borrar |

**Validaciones:**
- `clean()`: hora_inicio < hora_fin
- Sin superposición: valida contra horarios existentes del mismo día/médico
- `UniqueConstraint`: (medico, dia_semana, hora_inicio)

#### 3.3.2 BloqueoAgenda
Excepciones puntuales (vacaciones, capacitaciones) sin tocar el horario base.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `medico` | FK(Usuario) | CASCADE |
| `fecha_inicio` | DateField | Inicio del bloqueo |
| `fecha_fin` | DateField | Fin del bloqueo |
| `hora_inicio` | TimeField | Nullable (bloqueo parcial) |
| `hora_fin` | TimeField | Nullable (bloqueo parcial) |
| `motivo` | CharField(200) | Visible solo médico/admin |

**Método:** `cubre(fecha, hora)` → verifica si una fecha/hora está bloqueada

### 3.4 App: appointments (1 entidad)

#### 3.4.1 Cita
Agendamiento con trazabilidad (creado_por) y control de concurrencia.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente` | FK(Paciente) | CASCADE |
| `medico` | FK(Usuario) | PROTECT, limit rol=MEDICO |
| `centro_salud` | FK(CentroSalud) | PROTECT, nullable |
| `fecha_hora` | DateTimeField | Fecha y hora de la cita |
| `motivo` | CharField(200) | Motivo de consulta |
| `estado` | CharField(12) | PENDIENTE/CONFIRMADA/REPROGRAMADA/CANCELADA/ATENDIDA |
| `recordatorio_enviado` | Boolean | Si se envió recordatorio |
| `creado_por` | FK(Usuario) | SET_NULL — trazabilidad |
| `creado_en` | DateTime | auto_now_add |
| `actualizado_en` | DateTime | auto_now |

**Constraint de concurrencia:**
```python
UniqueConstraint(
    fields=["medico", "fecha_hora"],
    name="uniq_cita_medico_slot",
    condition=~Q(estado="CANCELADA")  # solo citas activas
)
```

### 3.5 App: clinical (4 entidades)

#### 3.5.1 RangoClinico
Rango normal según tipo de signo + condición crónica. El rango de glucosa NO es igual para un diabético que para un paciente sano.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo_signo` | CharField(15) | GLUCOSA/SPO2/TEMPERATURA/PRESION |
| `condicion_cronica` | FK(CondicionCronica) | Nullable (null = rango genérico) |
| `valor_min` | Float | Límite inferior normal |
| `valor_max` | Float | Límite superior normal |
| `valor_min_critico` | Float | Nullable — umbral crítico bajo |
| `valor_max_critico` | Float | Nullable — umbral crítico alto |
| `unidad` | CharField(15) | mg/dL, %, °C, mmHg |

**Método clase:** `para(tipo, condiciones_ids)` → prioriza el rango de la condición, fallback al genérico

#### 3.5.2 SignoVital
Registro de signos vitales. Presión tiene dos valores (sistólica/diastólica).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente` | FK(Paciente) | CASCADE |
| `cita` | FK(Cita) | SET_NULL, nullable |
| `tipo` | CharField(15) | GLUCOSA/SPO2/TEMPERATURA/PRESION |
| `valor` | Float | Nullable (para presión usar sis/dia) |
| `valor_sistolica` | Float | Nullable |
| `valor_diastolica` | Float | Nullable |
| `unidad` | CharField(15) | |
| `registrado_en` | DateTime | Momento de la medición |
| `registrado_por` | FK(Usuario) | SET_NULL |
| `origen` | CharField(10) | MANUAL / OFFLINE |

**Lógica de evaluación:**
- `_evaluar_valor(valor)` → compara contra `RangoClinico.para()` y devuelve `(fuera_de_rango, nivel)`
- Niveles: `CRITICO` (umbral extremo) > `MODERADO` (fuera de rango normal) > `None` (normal)
- `nivel_alerta()` → devuelve el nivel más grave (CRITICO > MODERADO > LEVE)

#### 3.5.3 Alerta
Generada automáticamente al detectar un signo fuera de rango.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `signo_vital` | FK(SignoVital) | CASCADE |
| `nivel` | CharField(10) | LEVE / MODERADO / CRITICO |
| `mensaje` | CharField(300) | Descripción human-readable |
| `atendida` | Boolean | Si el médico la marcó como atendida |
| `generada_en` | DateTime | auto_now_add |

#### 3.5.4 RegistroOffline
Staging de datos capturados sin conexión (sincroniza al volver la red).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente` | FK(Paciente) | CASCADE |
| `dispositivo_id` | CharField(100) | ID del dispositivo |
| `payload` | JSONField | Datos capturados sin conexión |
| `capturado_en` | DateTime | Momento de captura |
| `sincronizado` | Boolean | Default False |
| `sincronizado_en` | DateTime | Nullable |
| `signo_vital` | FK(SignoVital) | SET_NULL — link al registro sincronizado |

### 3.6 App: prescriptions (2 entidades)

#### 3.6.1 Prescripcion
Receta digital con firma simulada SHA-256 y código de verificación QR.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `cita` | FK(Cita) | SET_NULL, nullable |
| `medico` | FK(Usuario) | PROTECT, limit rol=MEDICO |
| `paciente` | FK(Paciente) | CASCADE |
| `firma_simulada` | CharField(64) | SHA-256 (auto, no editable) |
| `codigo_verificacion` | CharField(12) | UUID único (auto, no editable) |
| `fecha_emision` | DateTime | auto_now_add |
| `vigente_hasta` | DateTime | Default +30 días |

**Lógica de firma:**
```python
data = f"{medico_id}|{paciente_id}|{codigo_verificacion}|{fecha_emision}"
firma_simulada = hashlib.sha256(data.encode()).hexdigest()
```

#### 3.6.2 DetallePrescripcion
Cada medicamento de una prescripción (relación 1:N).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `prescripcion` | FK(Prescripcion) | CASCADE |
| `medicamento` | CharField(150) | Nombre del medicamento |
| `dosis` | CharField(100) | Ej: 500mg |
| `frecuencia` | CharField(100) | Ej: cada 8 horas |
| `duracion_dias` | PositiveSmall | Días de tratamiento |

### 3.7 App: referrals (2 entidades)

#### 3.7.1 Derivacion
Derivación entre niveles de atención.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente` | FK(Paciente) | CASCADE |
| `medico_origen` | FK(Usuario) | PROTECT |
| `especialista_destino` | FK(Usuario) | PROTECT, nullable (cualquier especialista) |
| `especialidad_destino` | FK(Especialidad) | PROTECT |
| `centro_origen` | FK(CentroSalud) | PROTECT |
| `centro_destino` | FK(CentroSalud) | PROTECT |
| `motivo` | TextField | Motivo clínico |
| `estado` | CharField(12) | PENDIENTE/ACEPTADA/RECHAZADA/COMPLETADA |
| `prioridad` | CharField(6) | ALTA/MEDIA/BAJA |
| `fecha_solicitud` | DateTime | auto_now_add |
| `fecha_respuesta` | DateTime | Nullable |

#### 3.7.2 AdjuntoDerivacion
Documentos adjuntos a una derivación (exámenes, historial).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `derivacion` | FK(Derivacion) | CASCADE |
| `archivo` | FileField | upload_to="derivaciones/" |
| `tipo_documento` | CharField(50) | Ej: "Examen de laboratorio" |
| `subido_en` | DateTime | auto_now_add |

### 3.8 App: audit (1 entidad)

#### 3.8.1 LogAuditoria
**INMUTABLE** — no se puede editar ni eliminar. RNF-04.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `usuario` | CharField(150) | Username (db_index) |
| `accion` | CharField(10) | LOGIN/CREATE/UPDATE/DELETE/GET/EXPORT |
| `modelo_afectado` | CharField(100) | Ej: "Cita", "Usuario" |
| `objeto_id` | CharField(100) | ID del objeto afectado |
| `ip_address` | GenericIPAddress | Nullable |
| `timestamp` | DateTime | auto_now_add (db_index) |
| `detalle` | TextField | Info adicional (status, path, etc.) |

**Bloqueo de inmutabilidad:**
```python
def save(self, *args, **kwargs):
    if self.pk:  # ya existe → intento de edición
        raise ValueError("LogAuditoria es inmutable: no se puede editar.")
    super().save(*args, **kwargs)

def delete(self, *args, **kwargs):
    raise ValueError("LogAuditoria es inmutable: no se puede eliminar.")
```

**Django admin:** `has_add_permission`, `has_change_permission`, `has_delete_permission` = False

### 3.9 App: legacy (1 entidad)

#### 3.9.1 RegistroLegacy
Staging del módulo JSP: historiales importados desde CSV pendientes de validación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paciente_legacy_id` | CharField(50) | ID del sistema legacy |
| `datos_csv` | JSONField | Datos importados del CSV |
| `migrado_en` | DateTime | auto_now_add |
| `validado` | Boolean | Default False |
| `paciente_vinculado` | FK(Paciente) | SET_NULL — paciente creado tras validación |

### 3.10 Resumen de relaciones

```
Usuario (1) ──── (1) Paciente
Usuario (1) ──── (1) PerfilMedico
Usuario (1) ──── (N) HorarioMedico
Usuario (1) ──── (N) BloqueoAgenda
Usuario (1) ──── (N) Cita (como medico)
Usuario (1) ──── (N) Cita (como creado_por)
Usuario (1) ──── (N) SignoVital (como registrado_por)
Usuario (1) ──── (N) Prescripcion (como medico)
Usuario (1) ──── (N) Derivacion (como medico_origen)
Usuario (1) ──── (N) Derivacion (como especialista_destino)

Paciente (N) ←──→ (N) CondicionCronica  [via PacienteCondicion]
Paciente (1) ──── (N) Cita
Paciente (1) ──── (N) SignoVital
Paciente (1) ──── (N) Prescripcion
Paciente (1) ──── (N) Derivacion
Paciente (1) ──── (N) RegistroOffline

Cita (1) ──── (N) SignoVital
Cita (1) ──── (N) Prescripcion
SignoVital (1) ──── (N) Alerta
Prescripcion (1) ──── (N) DetallePrescripcion
Derivacion (1) ──── (N) AdjuntoDerivacion
RegistroLegacy (1) ──── (1) Paciente (vinculado)

CondicionCronica (1) ──── (N) RangoClinico
CentroSalud (1) ──── (N) PerfilMedico
CentroSalud (1) ──── (N) Paciente
CentroSalud (1) ──── (N) Cita
CentroSalud (1) ──── (N) Derivacion (origen y destino)
Especialidad (1) ──── (N) PerfilMedico
Especialidad (1) ──── (N) Derivacion (destino)
```

---

## 4. Lógica de Negocio por Módulo

### 4.1 Autenticación (accounts)

**Flujo de login en 2 pasos (RF-01):**

1. **Paso 1 — Credenciales:** `POST /api/v1/auth/login/` con `{username, password}`
   - Valida credenciales con `authenticate()`
   - Si la cuenta está bloqueada (3 intentos fallidos) → HTTP 423 LOCKED
   - Si `mfa_enabled = False` → enrola y emite JWT directamente (usuarios nuevos)
   - Si `mfa_enabled = True` → devuelve `{mfa_required: true, dev_code}` (dev_code solo en DEBUG)

2. **Paso 2 — MFA:** `POST /api/v1/auth/mfa/` con `{username, code}`
   - Valida código TOTP con `pyotp.TOTP.verify(code, valid_window=1)`
   - Si falla → `registrar_intento_fallido()` → bloqueo tras 3 intentos
   - Si OK → emite JWT (access 15 min + refresh 8h) + datos del usuario

**RBAC estricto:**
- `IsAdminRole` → solo ADMIN
- `IsOwnerOrMedico` → el paciente ve solo sus datos; el médico ve todos
- `IsAuthenticated` → cualquier usuario logueado

**Throttling:**
- `anon: 60/min` — peticiones sin token
- `user: 300/min` — peticiones autenticadas
- `auth: 12/min` — login y MFA (evita fuerza bruta)

### 4.2 Gestión de Pacientes (patients)

- **PacienteViewSet**: ORM con `annotate()` para calcular `total_citas` y `ultima_cita` por paciente.
- Si el usuario es PACIENTE → filtra `qs.filter(usuario=self.request.user)` (privacidad).
- **Búsqueda**: `search_fields = ["usuario__username", "usuario__first_name", "usuario__last_name", "usuario__dni"]`
- **HATEOAS**: el serializer incluye `links` con URLs a citas, signos, tendencias y derivaciones del paciente.

### 4.3 Agenda — Horarios y Citas (schedule + appointments)

**Cálculo de disponibilidad** (`calcular_disponibilidad(medico, fecha)`):

```python
1. Obtener dia_semana de la fecha (0=Lunes ... 6=Domingo)
2. Filtrar HorarioMedico activo del médico para ese día
3. Filtrar BloqueoAgenda que cubre esa fecha
4. Filtrar Citas activas (PENDIENTE/CONFIRMADA/REPROGRAMADA) del médico ese día
5. Para cada horario:
   - Si el día está bloqueado → omitir todo el rango
   - Generar slots con generar_slots(hora_inicio, hora_fin, duracion_min)
   - Para cada slot:
     - Si está en un bloqueo parcial → ocupado
     - Si hay una cita en esa hora → ocupado
     - Sino → libre
6. Devolver (libres, ocupados)
```

**Control de concurrencia:**
- `UniqueConstraint` parcial: (medico, fecha_hora) único para citas no canceladas
- `select_for_update()` en la transacción al crear cita (evita race condition)

**Transiciones de estado permitidas:**
```
PENDIENTE → CONFIRMADA | CANCELADA
CONFIRMADA → ATENDIDA | CANCELADA | REPROGRAMADA
REPROGRAMADA → CONFIRMADA | CANCELADA
ATENDIDA → (terminal)
CANCELADA → (terminal)
```

**Validación de cancelación:** solo con 4+ horas de anticipación.

### 4.4 Monitoreo Clínico (clinical)

**Registro de signos vitales:**
- Al crear un `SignoVital`, se evalúa automáticamente contra `RangoClinico.para(tipo, condiciones_ids)`.
- Si el valor está fuera del rango normal → genera `Alerta` con nivel MODERADO.
- Si el valor supera el umbral crítico → genera `Alerta` con nivel CRITICO.
- El nivel más grave prevalece (CRITICO > MODERADO > LEVE).

**Rangos por condición:**
- Glucosa genérica: 70-140 mg/dL
- Glucosa para diabéticos: 80-180 mg/dL (rango más amplio)
- SpO2: 92-100%
- Temperatura: 36.0-37.5 °C
- Presión sistólica: 90-140 mmHg
- Presión diastólica: 60-90 mmHg

**Modo offline:**
- El frontend guarda signos en `localStorage` (cola) cuando no hay conexión.
- Al recuperar conexión, envía los datos a `/api/v1/signos/` con `origen=OFFLINE`.
- El backend crea el `SignoVital` y marca el `RegistroOffline` como sincronizado.

### 4.5 Prescripciones (prescriptions)

**Generación de receta:**
1. El médico selecciona paciente + medicamentos (1..N detalles).
2. Al guardar, se genera automáticamente:
   - `codigo_verificacion`: UUID de 12 chars (ej: `A3F8B2C1D9E7`)
   - `firma_simulada`: SHA-256 de `{medico_id}|{paciente_id}|{codigo}|{fecha_emision}`
   - `vigente_hasta`: fecha_emision + 30 días
3. El frontend genera un QR con `react-qr-code` que contiene el código de verificación.
4. Cualquiera puede verificar la receta escaneando el QR o ingresando el código en `/verificar-qr`.

### 4.6 Derivaciones (referrals)

**Flujo:**
1. Médico de origen crea derivación con paciente, especialidad destino, centro destino, motivo y prioridad.
2. Estado inicial: PENDIENTE.
3. El especialista destino recibe notificación (campana de la app + browser notification).
4. El especialista puede: ACEPTAR → COMPLETADA, o RECHAZAR.
5. `fecha_respuesta` se registra al cambiar de PENDIENTE.

### 4.7 Auditoría (audit)

**3 mecanismos de registro:**

| Mecanismo | Archivo | Qué registra |
|-----------|---------|--------------|
| Middleware | `middleware.py` | Cada petición HTTP a `/api/` con método, IP, status, path |
| Signals | `signals.py` | post_save/post_delete en Cita, SignoVital, Prescripcion, Derivacion, Usuario |
| ViewSet | `views.py` | Exportaciones/respaldos del admin (accion=EXPORT) |

**Inmutabilidad garantizada en 3 niveles:**
1. **Modelo:** `save()` raise si `self.pk` existe; `delete()` raise siempre.
2. **Django Admin:** `has_add/change/delete_permission` = False.
3. **ViewSet:** `ReadOnlyModelViewSet` (no permite POST/PUT/DELETE vía API).

### 4.8 Legacy (legacy)

**Flujo de migración JSP:**
1. El módulo `patient-sync.jsp` lee `historiales.csv` y hace POST a `/api/v1/legacy/importar/`.
2. Cada registro se guarda como `RegistroLegacy` con `validado=False`.
3. El admin ve los registros pendientes en el panel.
4. El admin puede:
   - **Crear paciente** → crea `Paciente` + `Usuario` y vincula `paciente_vinculado`.
   - **Rechazar** → marca `validado=True` sin crear paciente.
5. Una vez validado, el registro no se puede modificar.

---

## 5. Frontend (React + Vite)

### 5.1 Páginas (9)

| Página | Archivo | Roles | Funcionalidad |
|--------|---------|-------|---------------|
| Login | `Login.jsx` | Público | Login 2 pasos (credenciales + MFA) |
| MFA Setup | `MFASetup.jsx` | Todos | Mostrar QR para Google Authenticator |
| Citas | `Citas.jsx` | Todos | Calendario semanal + lista + wizard de agendamiento |
| Horario | `Horario.jsx` | Médico/Admin | CRUD de horarios semanales + bloqueos |
| Monitoreo | `Monitoreo.jsx` | Médico/Admin | Registro de signos + alertas activas |
| Dashboard | `Dashboard.jsx` | Todos | Gráficos de tendencias (Canvas) + export PDF |
| Prescripciones | `Prescripciones.jsx` | Médico/Admin | Crear recetas + QR + verificar |
| Derivaciones | `Derivaciones.jsx` | Médico/Admin | Crear/aceptar/rechazar derivaciones |
| Admin | `Admin.jsx` | Admin | Crear usuarios + auditoría + respaldo + legacy |

### 5.2 Componentes

| Componente | Funcionalidad |
|------------|---------------|
| `Layout.jsx` | Sidebar con navegación por rol + campana de notificaciones (polling 30s) |
| `CanvasChart.jsx` | Gráficos de líneas en Canvas puro (sin librerías externas) |

### 5.3 Servicios

| Servicio | Funcionalidad |
|----------|---------------|
| `api.js` | Cliente HTTP con JWT, refresh automático, manejo de 401/429 |
| `offlineStore.js` | Cola de signos en localStorage para modo offline |

### 5.4 Context

| Context | Funcionalidad |
|---------|---------------|
| `AuthContext.jsx` | Estado global de usuario, login, verifyMfa, logout, timeout 15 min |

### 5.5 Características del frontend

- **Responsive:** sidebar colapsable, grids con `auto-fit`, tablas con scroll horizontal.
- **Timeout de sesión:** 15 min de inactividad → logout automático (RNF-05).
- **Notificaciones:** campana con badge + browser notifications (requiere permiso).
- **Throttle handling:** mensaje amigable con cuenta regresiva al recibir HTTP 429.
- **HATEOAS:** el serializer de paciente incluye links a recursos relacionados.

---

## 6. Requisitos No Funcionales (RNF)

| RNF | Descripción | Implementación |
|-----|-------------|----------------|
| RNF-01 | Cifrado TLS y headers de seguridad | nginx: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff. Django: SECURE_CONTENT_TYPE_NOSNIFF |
| RNF-03 | Rangos clínicos configurables | Variables de entorno + ConfigMap en K8s. `settings.RANGOS_CLINICOS` lee de env |
| RNF-04 | Auditoría inmutable | `LogAuditoria` con save/delete bloqueados + middleware + signals |
| RNF-05 | Sesión 15 min + bloqueo 3 intentos | JWT access 15 min + `intentos_fallidos` + `bloqueado_hasta` (15 min) |
| RNF-06 | Rendimiento < 1.5s | Paginación (PAGE_SIZE=10), `select_related`/`prefetch_related`, throttle |
| RNF-07 | Modo offline | `RegistroOffline` + `offlineStore.js` (cola en localStorage) |
| RNF-09 | Respaldo de datos | Endpoint `/admin-panel/auditoria/respaldo/` con resumen de conteos |

---

## 7. Infraestructura (Docker + Kubernetes)

### 7.1 Docker Compose (`docker-compose.yml`)

3 servicios:

| Servicio | Imagen | Puerto | Depende de |
|----------|--------|-------|------------|
| `db` | postgres:16-alpine | 5432 | — |
| `backend` | Build `./backend` (Django + gunicorn) | 8000 | db (healthy) |
| `frontend` | Build `./frontend` (nginx + SPA) | 8080→80 | backend |

**Volumen persistente:** `pgdata` para datos de PostgreSQL.

**Healthcheck de db:** `pg_isready -U salud` cada 5s, 10 reintentos.

**Variables de entorno del backend:**
- `DJANGO_DEBUG=1` (modo demo con dev_code MFA visible)
- `POSTGRES_HOST=db` (nombre del servicio Docker)
- `RANGO_GLUCOSA_MIN=70`, `RANGO_GLUCOSA_MAX=140` (RNF-03)

### 7.2 Dockerfiles

**Backend** (`backend/Dockerfile`):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate && python manage.py seed; gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2"]
```

**Frontend** (`frontend/Dockerfile`):
```dockerfile
# Multi-stage: build SPA + serve con nginx
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**nginx.conf:**
- Headers de seguridad (HSTS, X-Frame-Options, X-Content-Type-Options)
- SPA fallback (`try_files $uri /index.html`)
- Proxy `/api/` → `http://backend:8000`

### 7.3 Kubernetes (k8s/)

4 manifiestos:

| Archivo | Contenido |
|---------|-----------|
| `01-namespace-configmap.yaml` | Namespace `saludconnect` + ConfigMap (rangos clínicos, env) + Secret ( passwords) |
| `02-postgres.yaml` | PVC (1Gi) + Deployment (1 réplica) + Service. Probes: pg_isready |
| `03-backend.yaml` | Deployment (2 réplicas) + Service. Probes: HTTP /api/v1/auth/login. Resources: 100m-500m CPU, 256-512Mi |
| `04-frontend-network.yaml` | Deployment (2 réplicas) + Service NodePort 30080 + NetworkPolicy (ingress/egress) |

**ConfigMap (RNF-03):**
```yaml
data:
  RANGO_GLUCOSA_MIN: "70"
  RANGO_GLUCOSA_MAX: "140"
  RANGO_SPO2_MIN: "92"
  RANGO_SPO2_MAX: "100"
  ...
```

**Secret:**
```yaml
stringData:
  DJANGO_SECRET_KEY: "cambiar-en-produccion-clave-segura"
  POSTGRES_PASSWORD: "salud123"
```

**Probes:**
- **Readiness:** verifica que el pod está listo para recibir tráfico
- **Liveness:** verifica que el pod sigue sano (reinicia si falla)

**NetworkPolicy:**
- Ingress: solo pods del namespace
- Egress: pods del namespace + DNS (puerto 53 UDP)

---

## 8. Módulo Legacy (JSP)

### 8.1 Descripción

El módulo `patient-sync.jsp` es un componente legacy que migra historiales clínicos desde un sistema anterior (almacenado en CSV) hacia la API REST de SALUDCONNECT.

### 8.2 Funcionamiento

1. Se despliega en Tomcat (`<TOMCAT>/webapps/legacy/`)
2. Lee `historiales.csv` con formato: `dni,nombres,apellidos,fecha_nacimiento,sexo,condicion`
3. Para cada fila, hace `POST /api/v1/pacientes/` con el JSON correspondiente
4. Autenticación: recibe JWT de admin via parámetro `?token=JWT_ADMIN`
5. Devuelve JSON con `{migrados, errores, detalle}`

### 8.3 Flujo de validación (staging)

1. El JSP envía registros a `/api/v1/legacy/importar/`
2. Se guardan como `RegistroLegacy` con `validado=False`
3. El admin valida desde el panel:
   - **Crear paciente** → crea `Usuario` + `Paciente` + vincula
   - **Rechazar** → marca validado sin crear

### 8.4 Archivos

| Archivo | Descripción |
|---------|-------------|
| `legacy/patient-sync.jsp` | Script JSP que lee CSV y hace POST a la API |
| `legacy/historiales.csv` | CSV de ejemplo con historiales a migrar |

---

## 9. API REST — Endpoints Completos

### Autenticación (`/api/v1/auth/`)

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/auth/login/` | Credenciales → exige MFA | AllowAny |
| POST | `/auth/mfa/` | Valida TOTP → emite JWT | AllowAny |
| GET | `/auth/me/` | Datos del usuario actual | IsAuthenticated |
| GET | `/auth/me/mfa-setup/` | QR + secret para Google Auth | IsAuthenticated |
| POST | `/auth/refresh/` | Renueva access token | AllowAny |
| GET/POST | `/auth/usuarios/` | CRUD de usuarios | IsAdminRole |
| POST | `/auth/usuarios/{id}/desbloquear/` | Desbloquear usuario | IsAdminRole |

### Catálogos (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/centros/` | CRUD centros de salud |
| GET/POST | `/especialidades/` | CRUD especialidades |
| GET/POST | `/perfiles-medico/` | CRUD perfiles médicos |

### Pacientes (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/pacientes/` | CRUD pacientes (con search por DNI/nombre) |
| GET/POST | `/condiciones/` | CRUD condiciones crónicas |
| GET/POST | `/paciente-condicion/` | CRUD relación paciente-condición |

### Agenda (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/horarios/` | CRUD horarios médicos |
| GET/POST | `/bloqueos/` | CRUD bloqueos de agenda |
| GET | `/horarios/disponibilidad/?medico=X&fecha=YYYY-MM-DD` | Slots libres/ocupados |

### Citas (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/citas/` | CRUD citas |
| GET | `/citas/semana/` | Citas de la semana actual |
| POST | `/citas/{id}/cambiar_estado/` | Cambiar estado (valida transiciones) |
| POST | `/citas/{id}/cancelar/` | Cancelar (valida 4h anticipación) |
| POST | `/citas/{id}/reprogramar/` | Reprogramar fecha/hora |

### Monitoreo (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/signos/` | CRUD signos vitales |
| GET | `/signos/tendencias/?paciente=X` | Tendencias históricas |
| GET/POST | `/alertas/` | CRUD alertas |
| POST | `/alertas/{id}/atender/` | Marcar alerta como atendida |
| GET/POST | `/registros-offline/` | CRUD registros offline |
| POST | `/registros-offline/sincronizar/` | Sincronizar cola offline |

### Prescripciones (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/prescripciones/` | CRUD prescripciones |
| GET | `/prescripciones/{id}/pdf/` | Descargar receta en PDF |
| GET | `/prescripciones/verificar/{codigo}/` | Verificar receta por código QR |

### Derivaciones (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/derivaciones/` | CRUD derivaciones |
| POST | `/derivaciones/{id}/aceptar/` | Aceptar derivación |
| POST | `/derivaciones/{id}/rechazar/` | Rechazar derivación |
| POST | `/derivaciones/{id}/completar/` | Marcar como completada |

### Legacy (`/api/v1/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/legacy/` | Listar registros en staging |
| POST | `/legacy/importar/` | Importar registros desde JSP |
| POST | `/legacy/validar/` | Validar (crear paciente o rechazar) |

### Auditoría (`/api/v1/admin-panel/`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/admin-panel/auditoria/` | Listar logs (solo admin, read-only) |
| POST | `/admin-panel/auditoria/respaldo/` | Generar respaldo con resumen |

### Documentación API

| URL | Descripción |
|-----|-------------|
| `/api/docs/` | Swagger UI interactivo (probar endpoints con JWT) |
| `/api/redoc/` | ReDoc (documentación legible) |
| `/api/schema/` | Schema OpenAPI 3 en YAML |

---

## 10. Seguridad

### 10.1 Autenticación

- **JWT** con access token de 15 min (RNF-05) y refresh de 8h.
- **MFA TOTP** real con `pyotp` (compatible con Google Authenticator).
- **Bloqueo de cuenta** tras 3 intentos fallidos (15 min).
- **Throttling estricto** en login/MFA: 12/min.

### 10.2 Autorización (RBAC)

| Rol | Permisos |
|-----|----------|
| ADMIN | Todo: usuarios, auditoría, respaldo, legacy, citas, monitoreo |
| MEDICO | Sus citas, sus horarios, crear prescripciones/derivaciones, registrar signos |
| PACIENTE | Solo SUS datos: sus citas, sus signos, sus prescripciones, sus derivaciones |

### 10.3 Seguridad de datos

- **Auditoría inmutable:** no se puede editar ni borrar ningún log.
- **Headers de seguridad:** HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff.
- **CORS:** solo orígenes permitidos (localhost:5173, localhost:8080).
- **CSRF:** middleware activo.
- **Firma de prescripciones:** SHA-256 de datos del médico + paciente + código + fecha.
- **Contraseñas:** mínimo 8 caracteres (validator de Django).

### 10.4 Infraestructura

- **NetworkPolicy** en K8s: restringe tráfico entre pods.
- **Secrets** en K8s: secret_key y password no en texto plano en ConfigMap.
- **Probes** de salud: readiness y liveness en todos los deployments.
- **Recursos limitados:** CPU 100m-500m, memoria 256-512Mi por pod.

---

## 11. Reparto por Integrante

| Apellido | Nombre | Módulo | Apps backend | Rama Git |
|----------|--------|--------|--------------|----------|
| BARJA | Erick | Agenda: horarios + citas ⭐ | schedule, appointments | `feature/barja` |
| NAVARRO | Lesly | Pacientes + condiciones + legacy staging | patients, legacy | `feature/navarro` |
| SULLUCHUCO | Anyelo | Monitoreo + alertas + offline | clinical | `feature/sulluchuco` |
| TORIBIO | David Angel | Prescripciones (QR) + Derivaciones + notif ⭐ | prescriptions, referrals | `feature/toribio` |
| YAURI | Benjamín | Admin + Auditoría + Docker/K8s/legacy JSP | audit, core, k8s/, docker | `feature/yauri` |
| HUAYNATE | Angel Mitch | Autenticación + Perfil + MFA | accounts | `feature/huaynate` |

⭐ = módulos con más peso en la rúbrica.

---

## 12. Guía de Despliegue

### 12.1 Desarrollo local (sin Docker)

```powershell
# Terminal 1 — Backend (SQLite)
cd C:\salud\backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed
python manage.py runserver

# Terminal 2 — Frontend (Vite)
cd C:\salud\frontend
npm install
npm run dev
```

**URLs:** `http://localhost:5173` (frontend) + `http://localhost:8000` (backend)  
**Usuarios demo:** `admin/admin123`, `doctor1..3/doctor123`, `paciente1..3/paciente123`

### 12.2 Docker (WSL Ubuntu)

```bash
cd /mnt/c/salud
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

**URLs:** `http://localhost:8080` (frontend) + `http://localhost:8000` (backend) + `http://localhost:8000/admin/` (Django admin)

### 12.3 Kubernetes

```bash
kubectl apply -f k8s/
kubectl get pods -n saludconnect
kubectl get services -n saludconnect
```

**URL:** `http://<NODE_IP>:30080`

### 12.4 Módulo Legacy (JSP)

1. Copiar `patient-sync.jsp` + `historiales.csv` a `<TOMCAT>/webapps/legacy/`
2. Obtener JWT de admin: `POST http://localhost:8000/api/v1/auth/login/`
3. Acceder: `http://localhost:8080/legacy/patient-sync.jsp?token=JWT_ADMIN`

### 12.5 Comandos útiles

```bash
# Ver BD PostgreSQL en Docker
docker exec -it salud-db-1 psql -U salud -d saludconnect
\dt                                          # listar tablas
SELECT * FROM accounts_usuario;              # ver usuarios
SELECT * FROM audit_logauditoria ORDER BY timestamp DESC LIMIT 20;
\q

# Parar Docker
docker compose down          # detiene
docker compose down -v       # detiene + borra BD

# Reconstruir desde cero
docker compose down -v
docker compose up --build -d

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### 12.6 Conexión pgAdmin / DBeaver

| Campo | Valor |
|-------|-------|
| Host | `localhost` (o IP de WSL: `hostname -I`) |
| Port | `5432` |
| Database | `saludconnect` |
| Username | `salud` |
| Password | `salud123` |

---

## FIN DEL INFORME

*Documento generado para el equipo de SALUDCONNECT — Julio 2026*
