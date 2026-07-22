# 🚀 Cómo ejecutar SALUDCONNECT

Guía paso a paso para levantar el proyecto en tu máquina (Windows) y dejarlo listo para la defensa.

---

## 📋 Requisitos previos

Verifica que tengas instalado (en tu terminal):

```powershell
python --version   # 3.10 o superior
node --version      # 18 o superior
npm --version
docker --version    # solo si vas a usar Docker
```

Si falta algo:
- **Python:** <https://www.python.org/downloads/>
- **Node.js:** <https://nodejs.org/>
- **Docker (opcional):** <https://www.docker.com/products/docker-desktop/>

---

## ⚡ Opción A — Ejecución local (recomendada para la demo)

Usa **SQLite** (ya configurado por defecto). No necesita Docker. Solo dos terminales.

### 1) Backend (Django + DRF)

Abre una terminal en `C:\SALUDCONNECT\backend`:

```powershell
# Solo la primera vez: crear entorno virtual e instalar dependencias
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt

# Crear la base de datos y cargar datos de demostración
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed

# Levantar el servidor (deja la terminal abierta)
.\.venv\Scripts\python.exe manage.py runserver
```

Saldrá algo como:
```
Starting development server at http://127.0.0.1:8000/
```

### 2) Frontend (React + Vite)

Abre **otra terminal** en `C:\SALUDCONNECT\frontend`:

```powershell
# Solo la primera vez: instalar dependencias
npm install

# Levantar el servidor de desarrollo (deja la terminal abierta)
npm run dev
```

Saldrá algo como:
```
VITE  ready in 300 ms
➜  Local:   http://localhost:5173/
```

### 3) Abrir el portal

Ve a **<http://localhost:5173>** y entra con uno de los usuarios de demo:

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |
| `doctor1` | `doctor123` | Médico (Medicina General) |
| `doctor2` | `doctor123` | Médico (Cardiología) |
| `doctor3` | `doctor123` | Médico (Neumología) |
| `paciente1` | `paciente123` | Paciente (Diabetes) |
| `paciente2` | `paciente123` | Paciente (Hipertensión) |
| `paciente3` | `paciente123` | Paciente (EPOC) |

Al ingresar usuario y contraseña, el sistema pide un **código TOTP de 6 dígitos** (MFA).
Como estás en modo DEBUG, ese código aparece en la propia pantalla y en la consola
del backend Django.

---

## 🐳 Opción B — Ejecutar con Docker (PostgreSQL)

Sólo si quieres mostrar el despliegue completo con base de datos PostgreSQL.

```powershell
cd C:\SALUDCONNECT
docker compose up --build
```

Esto levanta tres contenedores:
- `db` → PostgreSQL 16 (puerto 5432)
- `backend` → Django + gunicorn (puerto 8000), migraciones y seed automáticos
- `frontend` → nginx sirviendo la SPA + proxy `/api` (puerto 80)

Abre **<http://localhost>**. El backend queda en **<http://localhost:8000/api/v1/>**.

Para detener:
```powershell
docker compose down          # detiene contenedores
docker compose down -v       # además borra el volumen de la base de datos
```

> Si cambias código, vuelve a ejecutar `docker compose up --build` para recompilar.

---

## ☸️ Opción C — Kubernetes (minikube), opcional

Solo si quieres evidenciar despliegue en K8s para la rúbrica.

```powershell
minikube start

# Construir las imágenes dentro de minikube (para que estén disponibles localmente)
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t saludconnect-backend:latest ./backend
docker build -t saludconnect-frontend:latest ./frontend

kubectl apply -f k8s/
kubectl get pods -n saludconnect -w
minikube service frontend -n saludconnect   # abre el navegador
```

---

## 🔄 Comandos útiles

| Tarea | Comando (en `backend\`) |
|------|--------------------------|
| Crear admin/superusuario | `.\.venv\Scripts\python.exe manage.py createsuperuser` |
| Regenerar datos demo | `.\.venv\Scripts\python.exe manage.py migrate && .\.venv\Scripts\python.exe manage.py seed` |
| Borrar BD y empezar de cero | borra `db.sqlite3` y vuelve a ejecutar `migrate` + `seed` |
| Admin de Django | `.\.venv\Scripts\python.exe manage.py runserver` → <http://localhost:8000/admin/> (login admin/admin123) |
| Reinstalar dependencias front | en `frontend\`: `rm -r node_modules; npm install` |

---

## 🧪 Flujo sugerido para probar todo (defensa)

1. **Login `doctor1`** + código TOTP → entra como médico.
2. Abre **Mi Horario** → revisa sus bloques L-V 08-13h (ya vienen del seed).
3. **Citas** → "+ Nueva cita" → busca paciente por DNI `87654321` → siguiente →
   elige fecha futura → verás los **slots libres reales** (calculados del horario).
4. Repite el mismo slot → recibes **409 "Horario ya no disponible"** (concurrencia).
5. **Monitoreo** → registra Glucosa `280` para el paciente1 (diabético) → genera
   alerta MODERADA (rango 80-180 por la condición). Prueba el **Offline** de DevTools.
6. **Mis tendencias** → gráfico Canvas (prueba cambiar a **Presión arterial**)
   → botón **Exportar PDF** ⊳ RF-04.
7. **Prescripciones** → emite una con 2 medicamentos → aparece el QR y el PDF.
8. **Derivaciones** → crea una a Cardiología, cambia estado a ACEPTADA.
9. Sal, entra como **`admin`**:
   - **Administración → Migración legacy (JSP)** → "Simular import JSP" → valida
     los registros (crear paciente / rechazar).
   - **Auditoría inmutable**: verás CREATE de `Cita`, `SignoVital`, `Prescripcion`
     con modelo_afectado y objeto_id (signals).
   - **Generar respaldo**.
10. Sal, entra como **`paciente1`** → solo verás TUS citas, signos, recetas y
    derivaciones → evidencia el **RBAC estricto** (RF-08 / privacidad).

---

## 🛠️ Problemas comunes

| Síntoma | Solución |
|--------|----------|
| `Cannot read "db.sqlite3"` en `migrate` | Revisa que estés en la carpeta `backend\` |
| El frontend abre pero falla `/api/...` (CORS o 404) | Verifica que el backend corra en `:8000` (`python manage.py runserver`) |
| Login marca "Codigo TOTP invalido" | El código cambia cada 30 s; vuelve a pedirlo con un POST a `/auth/login/` |
| `pip install` lento | Cierra otros procesos; prueba `pip install --no-cache-dir -r requirements.txt` |
| Cambié un modelo Django | `python manage.py makemigrations && python manage.py migrate` |
| Puerto en uso (`:8000` o `:5173`) | Mata el proceso: `Get-Process node -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| Quiero resetear todo | Borra `backend\db.sqlite3` y `frontend\dist`, vuelve a hacer `migrate` + `seed` y `npm run dev` |

---

## 📁 Estructura del proyecto

```
C:\SALUDCONNECT\
├── backend\            Django 5 + DRF (9 apps: accounts, patients, schedule,
│   │                   appointments, clinical, prescriptions, referrals,
│   │                   audit, legacy, core)
│   ├── manage.py
│   ├── requirements.txt
│   ├── .venv\          entorno virtual (no se sube a git)
│   └── db.sqlite3      base de datos local (no se sube a git)
├── frontend\          React 18 + Vite
│   ├── package.json
│   ├── vite.config.js  proxy /api -> :8000
│   └── src\            App, context, hooks, services, components, pages
├── legacy\             modulo JSP legacy (patient-sync.jsp + historiales.csv)
├── k8s\                manifiestos Kubernetes (namespace, configmap, deploy...)
├── docker-compose.yml  stack completo con PostgreSQL
├── .gitignore
└── README.md           documentación + matriz de requerimientos
```

> 🔒 Los archivos `backend\.venv\`, `backend\db.sqlite3`, `frontend\node_modules\`
> y `frontend\dist\` **no se deben subir a git** — ya están en `.gitignore`.