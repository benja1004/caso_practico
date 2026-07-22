# SALUDCONNECT — Portal de Telemedicina y Monitoreo de Pacientes Crónicos

**Curso:** Desarrollo de Aplicaciones Web (IS093A) — Evaluación Final Semana 15
**Universidad Nacional del Centro del Perú — FIS**

Portal web seguro y responsivo para centros de salud rurales de la sierra central:
agendamiento de citas basado en horarios, monitoreo de signos vitales (diabetes,
hipertensión, EPOC), prescripciones digitales con QR, derivaciones entre niveles
de atención y auditoría completa.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite, Canvas puro, Hooks (`useAuthContext`, `useHealthReducer`), React Router |
| Backend | Django 5 (MTV) + DRF: JWT-TOTP, permisos granulares, throttling, paginación, HATEOAS |
| BD | SQLite (demo local) / PostgreSQL 16 (Docker/K8s, conmutación automática por entorno) |
| Legacy | `legacy/patient-sync.jsp` (migra CSV → API REST → staging con validación) |
| Infra | Docker Compose + Kubernetes (ConfigMap, probes, NetworkPolicy) |

## Modelo de datos (20 entidades)

```
Usuario (AbstractUser: rol MEDICO/PACIENTE/ADMIN, mfa_secret TOTP, bloqueo tras 3 intentos)
├─ PerfilMedico (1:1) → Especialidad, CentroSalud, numero_colegiatura
├─ Paciente (1:1) → fecha_nacimiento, CentroSalud, contacto_emergencia
│   └─ PacienteCondicion (M2M) → CondicionCronica (Diabetes/Hipertension/EPOC)
├─ HorarioMedico (plantilla semanal recurrente: dia_semana, hora_inicio/fin, duracion_cita_min)
├─ BloqueoAgenda (excepciones: fecha_inicio/fin + hora opcional, motivo privado)
├─ Cita (paciente, medico, centro_salud, creado_por [trazabilidad], concurrencia select_for_update)
├─ RangoClinico (tipo_signo + condicion_cronica opcional → valor_min/max + criticos)
├─ SignoVital (paciente, cita opcional, valor o valor_sistolica/diastolica, registrado_por, origen)
│   └─ Alerta (nivel leve/moderado/critico, generada automáticamente fuera de rango)
├─ RegistroOffline (staging offline: payload, capturado_en, sincronizado_en)
├─ Prescripcion (cita opcional, firma_simulada SHA-256, codigo_verificacion QR, vigente_hasta 30d)
│   └─ DetallePrescripcion (medicamento, dosis, frecuencia, duracion_dias)
├─ Derivacion (paciente, medico_origen, especialista_destino [filtrado por especialidad],
│   │          centro_origen/destino, prioridad alta/media/baja, estado 4 valores)
│   └─ AdjuntoDerivacion (archivo, tipo_documento)
├─ LogAuditoria (inmutable: usuario, accion, modelo_afectado, objeto_id, ip, timestamp)
└─ RegistroLegacy (staging JSP: datos_csv, validado, paciente_vinculado)
```

## Ejecución rápida (demo local)

Los servidores ya están corriendo. Abre:

### http://localhost:5173

**Login en 2 pasos (MFA TOTP):** usuario + contraseña → código TOTP de 6 dígitos
(en DEBUG el código se muestra en pantalla y en la consola del backend; para MFA
real, escanea el QR `otpauth://` con Google Authenticator usando el `mfa_secret` del usuario).

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | ADMIN |
| `doctor1` | `doctor123` | MEDICO (Medicina General) |
| `doctor2` | `doctor123` | MEDICO (Cardiología) |
| `doctor3` | `doctor123` | MEDICO (Neumología) |
| `paciente1` | `paciente123` | PACIENTE (Diabetes) |
| `paciente2` | `paciente123` | PACIENTE (Hipertensión) |
| `paciente3` | `paciente123` | PACIENTE (EPOC) |

Reiniciar servidores si los cierras:
```powershell
# Backend (terminal 1, en C:\SALUDCONNECT\backend)
.\.venv\Scripts\python.exe manage.py runserver
# Frontend (terminal 2, en C:\SALUDCONNECT\frontend)
npm run dev
```
Regenerar datos: `python manage.py migrate && python manage.py seed`

## Guion de la defensa (cubre el flujo de validación del PDF)

1. **Login `doctor1`** + código TOTP → **RF-01 / RNF-05**
2. **Mi Horario** → define plantilla semanal recurrente (Lun-Vie 08-13, 30 min) → Fla.B
3. **Citas** → agendar (valida fecha futura + 2h de anticipación) → **RF-02 / Fla.B**
   - Prueba agendar el mismo slot dos veces → 2do recibe **409 "Horario ya no disponible"** (concurrencia `select_for_update`)
   - Prueba fecha pasada → **400** (regla de fecha futura)
   - Vista **Calendario semanal** + Tabla (Fla.D)
4. **Monitoreo** → registra **Glucosa 280** al paciente1 (diabético) → rango aplicado 80-180, **alerta MODERADA** → **RF-03 / Fla.E**
   - Registra **Presión 175/100** al paciente2 (hipertenso) → dos valores sis/dia, alerta
   - DevTools → Network → **Offline** → registra otro signo → vuelve Online → **Sincronizar ahora** → **RNF-03 / Fla.E**
5. **Dashboard** → gráfico Canvas (presión: líneas sis+día; otros: banda verde de rango) + **Exportar PDF** → **RF-04**
6. **Prescripciones** → emitir con 1+ medicamentos anidados → aparece **QR** + firma SHA-256 → **RF-05 / Fla.F**
7. **Derivaciones** → crear (filtra especialista por **Cardiología**, centros origen/destino, prioridad) → cambiar estado → **RF-06 / Fla.G**
8. Salir y entrar como **`admin`** → **Administración**:
   - **Migración legacy (JSP)** → "Simular import JSP" → valida cada registro (crear paciente o rechazar) → **RF-09 / Fla.H**
   - **Auditoría inmutable**: log con `modelo_afectado` y `objeto_id` (poblado por signals) → **RNF-04**
   - **Respaldo de datos** → **RF-07**
9. Salir y entrar como **`paciente1`** → solo ve **SUS** citas/signos/recetas/prescripciones/derivaciones → **RBAC / RF-08 / Fla.D (privacidad)**

## Reglas del flujo implementadas (Fla)

- **Fla.A:** el médico define `HorarioMedico` (sin superposición). `BloqueoAgenda` cubre excepciones; el **motivo nunca se muestra al paciente** (privacidad).
- **Fla.B:** el paciente solo elige fecha futura (mín. **2 h** de anticipación). Disponibilidad cruza **HorarioMedico + Cita + BloqueoAgenda**. Solo ve booleanos (sin nombres de otros pacientes ni motivos de bloqueo).
- **Fla.C:** personal médico agenda con `creado_por = personal_medico` (trazabilidad).
- **Fla.D:** calendario semanal (medico ve todo) + tabla paginada con filtros; paciente solo lo suyo.
- **Fla.E:** signo autorregistrado genera `Alerta` (nivel leve/moderado/crítico) si está fuera de rango considerando la condición crónica, pero no se marca "validado": el médico decide la acción clínica. Offline vía `RegistroOffline`.
- **Fla.F:** consulta médica + `Prescripcion` con `DetallePrescripcion` N medicamentos + QR.
- **Fla.G:** derivación al especialista filtrado por **especialidad** (no rol aparte), con `AdjuntoDerivacion`.
- **Fla.H:** sesión expira a **15 min** de inactividad en cualquier paso.

## Docker (PostgreSQL)

```powershell
cd C:\SALUDCONNECT
docker compose up --build
# Frontend: http://localhost  |  API: http://localhost:8000/api/v1/
```

## Kubernetes (minikube)

```powershell
docker build -t saludconnect-backend:latest ./backend
docker build -t saludconnect-frontend:latest ./frontend
kubectl apply -f k8s/
minikube service frontend -n saludconnect
```

## Módulo legacy (JSP)

`legacy/patient-sync.jsp` publica filas de `historiales.csv` en `POST /api/v1/legacy/importar/`
(staging). El admin valida cada `RegistroLegacy` desde el panel: **crear paciente vinculado**
o **rechazar**. Despliegue en Tomcat: `webapps/legacy/` → `http://localhost:8080/legacy/patient-sync.jsp?token=<JWT_ADMIN>`.

---

## MATRIZ DE ELICITACIÓN DE REQUERIMIENTOS

| ID | Tipo | Descripción | Prioridad | Módulo | Criterio de Aceptación (Dado/Cuando/Entonces) | Semana(s) Sílabo | Validación Técnica |
|----|------|-------------|-----------|--------|-----------------------------------------------|------------------|--------------------|
| RF-01 | Funcional | Autenticación multifactor TOTP (contraseña + token temporal) y sesión 15 min | Alta | Auth | Dado un usuario, cuando ingresa credenciales válidas, entonces exige un código TOTP de 6 dígitos y bloquea tras 3 intentos fallidos | S05-S07 | Postman /auth/login + /auth/mfa |
| RF-02 | Funcional | Agendamiento con validación de disponibilidad cruzada (HorarioMedico+Cita+BloqueoAgenda), recordatorio y reprogramación | Alta | Citas | Dado un slot ocupado, cuando se intenta agendar, entonces el sistema rechaza (409) revalidando en transacción | S05-S07 | Postman POST /citas (409) |
| RF-03 | Funcional | Registro de signos vitales (presion sis/dia, glucosa, SpO₂, temperatura) con alertas por rango según condición crónica | Alta | Monitoreo | Dado un valor fuera de rango del paciente, cuando se registra, entonces se genera Alerta con nivel leve/moderado/crítico | S03-S04, S08 | Postman + DevTools |
| RF-04 | Funcional | Visualización de tendencias históricas con Canvas (incluye presión dual) y exportación PDF | Media | Dashboard | Dado el historial, cuando se grafica, entonces se muestra la banda de rango saludable y los puntos en alerta en rojo | S01-S04 | DevTools, Lighthouse |
| RF-05 | Funcional | Prescripción digital con firma simulada (SHA-256), DetallePrescripcion anidado y código QR de verificación | Media | Prescripción | Dada una prescripción, cuando se emite, entonces incluye código único, firma hash, N medicamentos y QR verificable | S08-S10 | GET /prescripciones/verificar |
| RF-06 | Funcional | Flujo de derivación con especialista filtrado por especialidad, adjuntos, estados y notificación | Alta | Derivaciones | Dada una derivación ENVIADA, cuando el especialista cambia su estado, entonces se registra fecha_respuesta y se notifica | S08-S10 | POST /derivaciones/{id}/cambiar_estado |
| RF-07 | Funcional | Panel administrativo: gestión de usuarios, auditoría de accesos y respaldo de datos | Alta | Admin | Dado un ADMIN, cuando accede al panel, entonces crea usuarios, ve el log inmutable y genera respaldo | S11-S12 | Navegador + Postman |
| RF-08 | Funcional | El paciente solo ve sus propios datos (citas, signos, recetas, derivaciones) | Alta | Todos | Dado un paciente, cuando consulta la API, entonces solo recibe registros vinculados a su cuenta | S05-S07 | Postman con token paciente |
| RF-09 | Funcional | Migración de historiales CSV desde módulo legacy JSP hacia staging con validación administrativa | Media | Legacy | Dado un CSV importado, cuando el admin valida, entonces crea el Paciente vinculado o lo rechaza | S13-S14 | Tomcat + Postman |
| RF-10 | Funcional | Disponibilidad de horarios por médico y fecha (slots calculados de la plantilla semanal) | Media | Citas | Dado un médico con horario y bloqueos, cuando se consulta disponibilidad, entonces retorna slots libres/ocupados | S05-S07 | GET /horarios/disponibilidad |
| RF-11 | Funcional | Gestión de plantilla semanal recurrente del médico (HorarioMedico) y excepciones (BloqueoAgenda) | Alta | Horario | Dado un médico, cuando configura sus horarios, entonces se calculan los slots disponibles sin superposición | S05-S07 | Navegador + Postman |
| RF-12 | Funcional | Sincronización de signos registrados en modo offline al recuperar conexión (RegistroOffline) | Alta | Monitoreo | Dado un registro en cola offline, cuando vuelve la red, entonces se envía a la API con origen OFFLINE vía /signos/sincronizar_offline/ | S02-S04 | DevTools offline |
| RNF-01 | No Funcional | Seguridad/Privacidad: TLS en tránsito, headers X-Content-Type-Options y HSTS, contraseñas hasheadas, motivo de BloqueoAgenda nunca expuesto al paciente | — | Infra | Headers presentes en 100% de respuestas; el paciente nunca ve el motivo del bloqueo | S13-S14 | DevTools Network, Postman |
| RNF-02 | No Funcional | Rendimiento: dashboard < 1.5 s, renderizado de gráficos < 500 ms | — | Frontend | Lighthouse ≥ 90 en Performance | S01-S04 | Lighthouse |
| RNF-03 | No Funcional | Resiliencia: modo offline para registro de signos con cola local y sincronización automática | — | Monitoreo | 100% de registros offline sincronizados al volver la red | S02-S04 | DevTools offline + localStorage |
| RNF-04 | No Funcional | Auditoría: log inmutable de accesos y operaciones con timestamp, IP, modelo_afectado y objeto_id (vía signals) | — | Backend | Toda operación sensible genera LogAuditoria sin opción a edición/borrado | S11-S12 | GET /admin-panel/auditoria |
| RNF-05 | No Funcional | Cumplimiento: sesión 15 min, bloqueo tras 3 intentos fallidos, RBAC estricto (IsMedico/IsPaciente/IsAdmin) | — | Auth | 4º intento fallido → cuenta bloqueada 15 min (HTTP 423) | S05-S07 | Postman (intentos) |
| RNF-06 | No Funcional | Compatibilidad: Chrome, Firefox, móvil/desktop, 320px–4K | — | Frontend | Layout usable en 320px sin scroll horizontal | S01-S04 | DevTools Responsive |
| RNF-07 | No Funcional | Disponibilidad: probes readiness/liveness y reinicio automático en K8s | — | Infra | Pods reiniciados automáticamente al fallar el probe | S13-S14 | kubectl describe pod |
| RNF-08 | No Funcional | Escalabilidad: API stateless (JWT) con réplicas horizontales, paginación y throttling | — | Infra | 2 réplicas del backend atendiendo sin sesión en servidor | S13-S14 | kubectl scale + Postman |

## Arquitectura y cobertura del sílabo (S01–S14)

```
React SPA (Vite)  ──HTTPS──▶  nginx  ──▶  Django MTV + DRF  ──▶  PostgreSQL/SQLite
 S01-S04: SPA, Hooks,               S05-S07: MVC/MTV, ORM, Auth,         S11-S12:
 Canvas, offline,                   concurrencia select_for_update       Admin, auditoría (signals),
 responsive                         S08-S10: DRF, permisos granulares,    S13-S14: Docker, K8s,
 (320px-4K)                         throttling, HATEOAS, JWT-TOTP         legacy JSP (staging+validación)
```

## Métricas de éxito y ODS 3 (Salud y Bienestar)

- **Meta ODS 3.8**: reducción simulada del 30% en tiempos de derivación — medición:
  días entre `fecha_solicitud` y `fecha_respuesta` (estado COMPLETADA) vs. 15 días del proceso manual.
- **Adherencia +40%**: % de pacientes con ≥ 1 registro de SignoVital por semana
  (conteo por paciente/semana en el periodo de prueba, considerando sincronización offline).

## Uso de IA (declaración ética)

El equipo utilizó asistencia de IA (OpenCode) para el scaffolding del proyecto, la
normalización del modelo de datos (20 entidades) y la generación de código base; cada
módulo fue revisado, ejecutado y comprendido por los integrantes para la defensa oral.