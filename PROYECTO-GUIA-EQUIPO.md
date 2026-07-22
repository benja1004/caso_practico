# 🧭 PROYECTO-GUIA-EQUIPO.md — SALUDCONNECT

Índice maestro para que el equipo de 6 personas trabaje en paralelo con git **sin pisarse**. Lee esto primero; luego abre [`guia-equipos.md`](./guia-equipos.md) para el detalle de tu módulo.

---

## 0. 👥 El equipo y su reparto (resumen para exposición)

Portal de **Telemedicina y Monitoreo de Pacientes Crónicos** para centros de salud rurales de la sierra central del Perú. Cada integrante es responsable de **un módulo end-to-end** (backend + frontend), trabajando en su propia rama git.

| # | Apellido | Nombre | Módulo | Rama Git |
|---|----------|--------|--------|----------|
| 1 | **BARJA** | BARJA ORTIZ, Erick | **Agenda: horarios del médico + citas (calendario y wizard)** ⭐ núcleo del caso | `feature/barja` |
| 2 | **NAVARRO** | NAVARRO SERVA, Lesly | **Pacientes + condiciones crónicas + staging del módulo legacy** | `feature/navarro` |
| 3 | **SULLUCHUCO** | SULLUCHUCO VILCAPOMA, Anyelo | **Monitoreo de signos vitales + alertas + modo offline** | `feature/sulluchuco` |
| 4 | **TORIBIO** | TORIBIO ANSELMO, David Angel | **Prescripciones (recetas + QR) + Derivaciones + notificaciones** ⭐ | `feature/toribio` |
| 5 | **YAURI** | YAURI TORRES, Benjamín | **Administración + Auditoría inmutable + Infraestructura (Docker/K8s/legacy JSP)** | `feature/yauri` |
| 6 | **HUAYNATE** | HUAYNATE CORIÑAUPA, Angel Mitch | **Autenticación multifactor (MFA TOTP) + Perfil de usuario** | `feature/huaynate` |

> ⭐ = módulos con más peso en la rúbrica (Agenda y Prescripciones+Derivaciones). Equivale al 35%+15% (implementación + defensa).

### 🎤 Qué dirá cada uno en la exposición (1 frase)

- **Erick (barja)** — *"Implementé el núcleo del sistema: la plantilla semanal recurrente del médico (HorarioMedico) y el agendamiento de citas, con cálculo cruzado de disponibilidad (horario + bloqueos + citas ya tomadas), control de concurrencia con `select_for_update` para evitar sobreventa, y gestión de estados con validación de transiciones permitidas."*

- **Lesly (navarro)** — *"Modelé los pacientes y sus condiciones crónicas con una tabla intermedia M2M, clave porque los rangos normativos varían por patología (el diabético usa 80-180 mg/dL de glucosa). Además implementé el staging del módulo legacy JSP, donde el admin valida cada registro importado antes de crear el paciente."*

- **Anyelo (sulluchuco)** — *"Construí el monitoreo de signos vitales con rangos adaptados por condición, alertas automáticas de 3 niveles (leve/moderado/crítico), modo offline con cola en localStorage y sincronización al recuperar conexión, y un dashboard con gráficos en Canvas puro y exportación a PDF con tabla de datos."*

- **David (toribio)** — *"Desarrollé las prescripciones digitales con firma simulada SHA-256 y código QR verificable (incluyendo escaneo por cámara desde el celular), y las derivaciones entre niveles de atención con notificaciones al especialista destino vía la campana de la app y browser notifications."*

- **Benjamín (yauri)** — *"Encargado del área de administración y auditoría: LogAuditoria **inmutable** (no puede editarse ni borrarse, poblado vía middleware + signals), respaldo de datos, y la infraestructura completa con Docker Compose (PostgreSQL+Django+nginx) y Kubernetes (ConfigMap, probes, NetworkPolicy), más el módulo legacy JSP."*

- **Angel Mitch (huaynate)** — *"Implementé la autenticación multifactor TOTP real con `pyotp` y Google Authenticator, el RBAC estricto con tres roles (Médico/Paciente/Admin), el bloqueo de cuenta tras 3 intentos fallidos, y la caducidad de sesión JWT a los 15 minutos de inactividad."*

---

## 1. Reparto de módulos detallado (apps y archivos por responsable)

| Apellido | Módulo | Apps backend (carpeta) | Páginas frontend |
|----------|--------|------------------------|------------------|
| **barja** | Agenda (horarios + citas) | `apps/schedule`, `apps/appointments` | `src/pages/Horario.jsx`, `src/pages/Citas.jsx` |
| **navarro** | Pacientes + condiciones + legacy staging | `apps/patients`, `apps/legacy` | (sin página propia; usa APIs desde Citas/Monitoreo/Admin) |
| **sulluchuco** | Monitoreo + alertas + offline | `apps/clinical` | `src/pages/Monitoreo.jsx`, `src/pages/Dashboard.jsx`, `src/components/CanvasChart.jsx` |
| **toribio** | Prescripciones (QR) + Derivaciones + notif | `apps/prescriptions`, `apps/referrals` | `src/pages/Prescripciones.jsx`, `src/pages/Derivaciones.jsx` |
| **yauri** | Admin + Auditoría + Docker/K8s/legacy JSP | `apps/audit`, `apps/core`, `legacy/`, `k8s/`, `docker-compose.yml`, `backend/Dockerfile`, `backend/config/settings.py` | `src/pages/Admin.jsx`, `src/components/Layout.jsx` (campana) |
| **huaynate** | Autenticación + Perfil + MFA | `apps/accounts` | `src/pages/Login.jsx`, `src/pages/MFASetup.jsx`, `src/context/AuthContext.jsx`, `src/services/api.js` |

> ⭐ = módulos con más peso en la rúbrica (Agenda y Prescripciones+Derivaciones). Equivale al 35%+15% (implementación + defensa).

---

## 2. 🌳 Cómo trabajar con git en equipo (sin pisarse)

### Configuración inicial (una sola vez — la hace un coordinador)

```powershell
# El coordinador crea el repo en GitHub (privado), sube el proyecto base:
cd C:\SALUDCONNECT
git init
git branch -M main
# (asegúrate de tener .gitignore — ya está creado en el proyecto)
git add .
git commit -m "Inicial: SALUDCONNECT base funcional"
git remote add origin https://github.com/USUARIO/saludconnect.git
git push -u origin main

# Invita a tus 5 compañeros: GitHub → Settings → Collaborators → Add people.
```

### Flujo de cada compañero (repetir cada vez que trabaja)

```powershell
# 1) Clonar (solo la 1ra vez en cada PC)
git clone https://github.com/USUARIO/saludconnect.git
cd saludconnect

# 2) Traer lo más reciente (SIEMPRE, antes de empezar)
git checkout main
git pull

# 3) Crear/cambiar a tu rama de trabajo (por la 1ra vez)
git checkout -b feature/agenda        # usa el nombre de tu módulo

# Si ya existía, sólo cámbiate y trae lo último rebaseándola contra main:
# git checkout feature/agenda
# git pull origin feature/agenda
# git rebase main

# 4) Trabaja… (edita, prueba con runserver + npm run dev)
# 5) Commits pequeños y descriptivos
git add .
git commit -m "schedule: validar que hora_inicio < hora_fin en HorarioMedico"

# 6) Subir tu rama
git push -u origin feature/agenda

# 7) Abre un Pull Request en GitHub (botón Compare & pull request)
#    Asigna a otro compañero como revisor. Tras aprobar, MERGE a main.
```

### Regla de oro para no pisarse
- **Cada quien trabaja solo en su rama y solo en sus archivos** (ver la columna "Apps/Páginas" de la tabla). Si necesitas tocar un archivo de otro módulo, **abre un issue/comenta en su PR**, no lo edites tú.
- **Haz commits pequeños y descriptivos**: empiezan con `<módulo>: <acción>`. Ej: `citas:`, `auth:`, `prescripciones:`, `monitoreo:`, `audit:`.
- **Sincronízate con `main` al menos 1 vez al día**: `git fetch origin && git rebase origin/main`.
- **Conflictos**: si tu `git push` o PR dice "conflict", haz `git pull origin main --rebase`, resuelve en tu editor y `git rebase --continue`. Si te atascas pídele ayuda al coordinador.

### Resolución rápida de conflictos
```powershell
git pull origin main --rebase
# Git marcará los archivos en conflicto (<<<<<<< ===== >>>>>>>)
# Abre el archivo, elige la versión correcta y Borra las marcas
git add <archivo>
git rebase --continue
git push --force-with-lease  # sólo tras rebase, si te toca forzar
```
> Nunca uses `git push -f` a main, solo `--force-with-lease` a tu propia rama tras rebase.

---

## 3. 🏗️ Arquitectura general (para que todos entiendan el panorama)

```
┌───────────────────────────────────────────────────────────────────────┐
│ FRONTEND  React 18 + Vite  (http://localhost:5173)                   │
│  Sidebar → páginas → axios por /api  (proxy Vite al backend)          │
│  Hooks obligatorios por el caso: useAuthContext, useHealthReducer     │
└──────────────┬────────────────────────────────────────────────────────┘
               │  JSON sobre HTTP (JWT Bearer + MFA TOTP)
┌──────────────▼───────────────────────────────────────────────────────┐
│ BACKEND  Django 5 + DRF  (http://localhost:8000)                      │
│  9 apps separadas (segun sección 1):                                   │
│   accounts · patients · schedule · appointments · clinical ·           │
│   prescriptions · referrals · audit · legacy · core                    │
│  Middleware AuditMiddleware (RNF-04) + signals para LogAuditoria       │
│  Settings: SQLite por defecto, PostgreSQL si hay POSTGRES_* (Docker)   │
└──────────────┬────────────────────────────────────────────────────────┘
               │  ORM (models.OneToOne / ForeignKey / M2M)
               ▼
         Base de Datos (SQLite dev / PostgreSQL prod)
```

- **Base de datos**: 20 entidades normalizadas. Cada app dueña de sus tablas.
- **API REST**: todo bajo `/api/v1/`. Permisos RBAC: `IsMedico / IsPaciente / IsAdminRole`. Paginación y throttling ya configurados.
- **Seguridad (RNF-01..05)**: JWT 15 min, MFA TOTP, bloqueo tras 3 intentos, headers de seguridad, contraseñas hasheadas.

### ¿Cómo se conectan los módulos entre sí?
- `accounts` define `Usuario` (con `rol`) → **todas las demás apps referencian** a él via `ForeignKey(settings.AUTH_USER_MODEL)`.
- `patients` define `Paciente` (1:1 con `Usuario`) y `CondicionCronica` → `clinical` usa los rangos por condición**.
- `schedule` define `HorarioMedico`/`BloqueoAgenda` → `appointments` calcula los slots disponibles cruzando ambas.
- `appointments` define `Cita` → `prescriptions` puede enlazar una prescripción a una cita.
- `clinical` define `Alerta` → notificaciones de la app (campana).
- `audit` registra todo vía signals → `LogAuditoria` inmutable.

---

## 4. 📂 Estructura rápida del proyecto

```
C:\SALUDCONNECT\
├── backend\
│   ├── apps\<cada app>\  models.py / serializers.py / views.py / urls.py / admin.py
│   ├── config\           settings.py / urls.py (router global)
│   ├── manage.py
│   └── requirements.txt
├── frontend\
│   ├── src\ context\  hooks\  services\  components\  pages\  styles.css
│   ├── package.json
│   └── vite.config.js proxy /api → :8000
├── legacy\          modulo JSP legacy (patient-sync.jsp)
├── k8s\            manifiestos Kubernetes
├── docker-compose.yml
├── requirements.txt
├── README.md / EJECUTAR.md / GIT.md / guia-equipos.md  (este + el de abajo)
```

Para regenerar datos de prueba en tu rama:
```powershell
cd backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed
```

---

## 5. ⚙️ Cómo correr el proyecto en tu rama

Las instrucciones completas están en [`EJECUTAR.md`](./EJECUTAR.md). Resumen:

```powershell
# Terminal 1 — backend
cd C:\SALUDCONNECT\backend
.\.venv\Scripts\python.exe manage.py runserver

# Terminal 2 — frontend
cd C:\SALUDCONNECT\frontend
npm run dev
# Abre http://localhost:5173
```
Usuarios: `admin/admin123`, `doctor1..3/doctor123`, `paciente1..3/paciente123`.
Login en 2 pasos: contraseña + **código TOTP** (en DEBUG lo verás en pantalla y en la consola del backend).

---

## 6. ✅ Reglas de commit (estilo]

Formato: `<módulo>: <descripción en presente>`

| Ejemplos correctos | Ejemplos incorrectos |
|--------------------|-----------------------|
| `citas: validar transiciones de estado (409 en invalidas)` | `cambios` |
| `monitoreo: agregar nivel critico al detectar SpO2 < 85` | `fix` |
| `audit: poblar modelo_afectado via signals` | `updates varios` |
| `prescripciones: modal de verificacion QR con documento` | `wip` |

---

## 7. 📝 Checklist de integración (antes de cada defensa/día de entrega)

Cada integrante confirma que housingó de su módulo:
- [ ] Mis endpoints compilan (`python manage.py check`)
- [ ] Mis tests (si los agregué) pasan
- [ ] Mi página renderiza sin errores en consola del navegador (F12)
- [ ] Hice al menos **3 commits** en mi rama y **abrí un PR** a main
- [ ] El coordinador (o un revisor) aprobó el merge
- [ ] Actualicé la sección de mi módulo en el README (matriz RF/RNF que toqué)

---

## 8. 🎯 Qué mejorar (tareas por módulo)

Mencionaste y acordamos estas mejoras con extras. Detalle y solución guiada: **en [`guia-equipos.md`](./guia-equipos.md)**, uno por módulo.

| Mejora | Módulo responsable |
|--------|--------------------|
| Derivaciones notifican al especialista (campana + browser notif + opcional Telegram) | Compañero 5 |
| QR de receta escaneable desde cámara → ver PDF en celular | Compañero 5 (con apoyo de Compañero 6 para la ruta pública del PDF) |
| Tests automatizados por módulo | TODOS (1 test mínimo cada uno) |
| Validaciones extra en modelos | CadaDueño |
| Accesibilidad/ARIA labels | CadaDueño del frontend |
| Endpoints extra para reportes | Compañero 6 (audit) + el de cada módulo |

---

## 9. 🆘 ¿Dudas o te atascas?

1. Lee tu sección en `guia-equipos.md`.
2. Revisa la consola del backend (`python manage.py runserver` 8000) y del navegador (F12).
3. Verifica que no rompiste migraciones: `python manage.py makemigrations --check`.
4. Pregunta en el grupo del equipo mostrando el error exacto + captura.

¡Manos a la obra! Lee ahora **`guia-equipos.md`** para los detalles de tu módulo y empieza por tu rama.