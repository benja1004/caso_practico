# 🔧 Cómo subir SALUDCONNECT a Git y GitHub

Guía paso a paso desde cero (asume que todavía NO tienes un repo local).

---

## 1) Instalar Git (si no lo tienes)

Descárgalo de <https://git-scm.com/downloads> y comprueba:

```powershell
git --version
```

Configúralo **una sola vez** con tu nombre y correo (los que usarás en GitHub):

```powershell
git config --global user.name  "Tu Nombre"
git config --global user.email "tu_correo@ejemplo.com"
```

---

## 2) Crear un repositorio vacío en GitHub

1. Entra a <https://github.com/new>
2. **Repository name:** `saludconnect` (o el nombre que prefieras)
3. **Description:** *Portal de telemedicina y monitoreo de pacientes crónicos – UNCP FIS*
4. Marca **Private** (recomendado para trabajo académico) o **Public** si tu docente lo pide
5. **NO marques** *Add a README*, *Add .gitignore* ni *Choose a license* (ya los tenemos)
6. Haz clic en **Create repository**

GitHub te mostrará una URL como:
```
https://github.com/TU_USUARIO/saludconnect.git
```
Cópiala — la usarás en el paso 5.

---

## 3) Inicializar el repo local

Abre una terminal en la **raíz del proyecto**:

```powershell
cd C:\SALUDCONNECT
git init
git branch -M main        # renombra la rama por defecto a 'main'
```

---

## 4) Revisar el `.gitignore`

El proyecto ya incluye un `.gitignore` en la raíz. Verifica que contenga:

```gitignore
# Python / Django
.venv/
__pycache__/
*.pyc
db.sqlite3
media/
staticfiles/

# Node / Frontend
node_modules/
dist/
.env

# IDE
.vscode/
.idea/
*.log

# Sistema operativo
Thumbs.db
.DS_Store
```

Si no existe créalo con:
```powershell
notepad .gitignore
```
y pega el contenido anterior.

> ⚠ Es **crítico** no subir `node_modules/`, `.venv/` ni `db.sqlite3` (pesan decenas de MB y algunos MB respectivamente, y son regenerables).

---

## 5) Primer commit

```powershell
# Ver qué se va a subir (revisa que NO aparezcan node_modules, .venv ni db.sqlite3)
git status

# Agregar TODO el proyecto (respeta el .gitignore)
git add .

# Hacer el primer commit
git commit -m "Inicial: SALUDCONNECT - portal de telemedicina (React + Django + DRF)"
```

Si en `git status` ves que se están agregando carpetas pesadas, **no hagas el commit todavía**:
- Revisa el `.gitignore`
- Quita de la zona de staging con: `git reset`
- Añade las rutas a `.gitignore` y vuelve a `git add .`

---

## 6) Conectar el repo local con GitHub y subir

```powershell
# Reemplaza TU_USUARIO por el tuyo
git remote add origin https://github.com/TU_USUARIO/saludconnect.git

# Subir la rama main
git push -u origin main
```

La primera vez te pedirá autenticarte en GitHub:
- Se abrirá una ventana del navegador → **Sign in with browser** → autoriza.
- O si usas token: pega un **Personal Access Token** (Generarlo en
  GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  → Generate new token, con scope `repo`).

---

## 7) Alternativa: usar GitHub CLI (recomendado si no quieres pelear con tokens)

```powershell
# Instala GitHub CLI: https://cli.github.com/
winget install --id GitHub.cli

# Autentica (abre el navegador):
gh auth login

# Crea el repo y sube en un solo comando desde C:\SALUDCONNECT:
gh repo create saludconnect --private --source=. --remote=origin --push
```

---

## 8) A partir de ahora: ciclo de trabajo diario

```powershell
# Ver qué cambiaste
git status
git diff

# Agregar cambios específicos
git add backend/apps/clinical/views.py
git add frontend/src/pages/Citas.jsx

# O agregar TODO lo modificado (respeta el .gitignore)
git add .

# Commit con mensaje descriptivo
git commit -m "Agregar validacion de rango por condicion en SignoVital"

# Subir a GitHub
git push
```

---

## 9) Trabajar en equipo (ramas + Pull Requests)

Para que cada integrante añada su módulo sin pisar el trabajo del otro:

```powershell
# Crear y cambiar a una rama nueva (ej. para el módulo de recetas)
git checkout -b feature/prescripciones

# ... trabaja, haz commits ...

# Subir la rama
git push -u origin feature/prescripciones

# En GitHub se abrirá un botón "Compare & pull request" → crear PR
# Otro integrante revisa y hace "Merge pull request"
```

Para traerte los cambios del resto del equipo:
```powershell
git pull                 # baja y fusiona origin/main en tu rama actual
git checkout main        # volver a la rama principal
```

---

## 10) Si ya subiste algo pesado por error (node_modules, db.sqlite3)

Si olvidaste el `.gitignore` y subiste archivos pesados, corrígelo así:

```powershell
# Eliminar de git pero conservar en disco
git rm -r --cached backend\.venv
git rm -r --cached frontend\node_modules
git rm --cached backend\db.sqlite3

# Asegúrate de que estén en .gitignore, luego commit + push
git commit -m "Quitar archivos pesados del versionamiento"
git push
```

Si ya está en GitHub y quieres borrar el historial del archivo grande,
usa `git filter-repo` o BFG Repo-Cleaner (más avanzado).

---

## 11) Buenas prácticas para la defensa

- **Commits claros**: mensajes que empiecen con verbo en presente
  ("Agregar…", "Corregir…", "Documentar…") y describan qué + por qué.
- **Un commit por cambio lógico**: no mezcles movimientos de carpetas con
  cambios de código.
- **Ramas por feature**: `feature/monitoreo`, `feature/derivaciones`, etc.
- **README actualizado**: el `README.md` del proyecto y `EJECUTAR.md` ya incluyen
  todo lo que el docente necesita para clonar y correr el proyecto.
- **.env fuera de git**: cualquier secreto va en variables de entorno (Docker,
  K8s Secrets), nunca commiteado. Ya lo tenemos cubierto con `.gitignore`.

---

## 12) Tu docente/clonar y ejecutar (resumen para el README del repo)

Cuando alguien clone tu proyecto, lo que debe ejecutar es:

```powershell
git clone https://github.com/TU_USUARIO/saludconnect.git
cd saludconnect

# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed
.\.venv\Scripts\python.exe manage.py runserver

# Frontend (otra terminal)
cd ..\frontend
npm install
npm run dev
# => http://localhost:5173  (admin/admin123, doctor1/doctor123, paciente1/paciente123)
```

Estas instrucciones ya están en `EJECUTAR.md` y `README.md` del proyecto.

---

## 🚨 Checklist final antes de push

- [ ] `.gitignore` en la raíz y revisado
- [ ] `git status` no muestra `node_modules/`, `.venv/`, `db.sqlite3`, `media/`, `dist/`
- [ ] README.md con la matriz de requerimientos actualizada
- [ ] EJECUTAR.md con las instrucciones
- [ ] Primer commit con proyecto completo
- [ ] Repo creado en GitHub y `git push` correcto
- [ ] Cada integrante con acceso al repo (Settings → Collaborators → Add)
- [ ] Cada integrante con su rama o trabajando vía PR

¡Listo! Con esto el docente puede clonar, ejecutar y revisar el historial completo de commits de tu equipo.