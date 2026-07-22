"""
Tests del modulo NAVARRO: patients + condiciones crónicas + legacy staging.
Corre con: python manage.py test apps.patients.tests
"""
from datetime import date
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Usuario
from .models import Paciente, CondicionCronica, PacienteCondicion

# Para evitar dependencia de whitenoise en tests locales
TEST_MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'apps.audit.middleware.AuditMiddleware',
]


class PacienteTests(TestCase):
    """Mejora 2.D — Tests de modelos de pacientes."""

    def setUp(self):
        self.medico = Usuario.objects.create_user(
            "medico1", "medico@pe.pe", "med1234567", rol="MEDICO",
            first_name="Ana", last_name="Torres"
        )
        self.usuario_p = Usuario.objects.create_user(
            "p1", "p@pe.pe", "p1234567", rol="PACIENTE",
            first_name="Juan", last_name="Lopez"
        )
        self.paciente = Paciente.objects.create(
            usuario=self.usuario_p,
            fecha_nacimiento=date(1980, 1, 15)
        )
        self.diabetes = CondicionCronica.objects.create(
            nombre="Diabetes", codigo="DIABETES"
        )
        self.hipertension = CondicionCronica.objects.create(
            nombre="Hipertensión", codigo="HIPERTENSION"
        )

    def test_paciente_tiene_condicion(self):
        """Un paciente puede tener una condición crónica asignada."""
        PacienteCondicion.objects.create(
            paciente=self.paciente,
            condicion=self.diabetes,
            fecha_diagnostico="2020-01-01"
        )
        self.assertEqual(self.paciente.condiciones.count(), 1)

    def test_paciente_puede_tener_multiples_condiciones(self):
        """Un paciente puede tener varias condiciones crónicas."""
        PacienteCondicion.objects.create(
            paciente=self.paciente, condicion=self.diabetes,
            fecha_diagnostico="2020-01-01"
        )
        PacienteCondicion.objects.create(
            paciente=self.paciente, condicion=self.hipertension,
            fecha_diagnostico="2021-06-01"
        )
        self.assertEqual(self.paciente.condiciones.count(), 2)

    def test_paciente_unique_condicion(self):
        """No se puede asignar la misma condición dos veces al mismo paciente."""
        from django.db import IntegrityError
        PacienteCondicion.objects.create(
            paciente=self.paciente, condicion=self.diabetes,
            fecha_diagnostico="2020-01-01"
        )
        with self.assertRaises(IntegrityError):
            PacienteCondicion.objects.create(
                paciente=self.paciente, condicion=self.diabetes,
                fecha_diagnostico="2022-01-01"
            )

    def test_nombre_completo(self):
        """La propiedad nombre_completo devuelve el nombre del usuario vinculado."""
        self.assertEqual(self.paciente.nombre_completo, "Juan Lopez")

    def test_edad_calculada(self):
        """La edad se calcula como propiedad derivada correctamente."""
        hoy = date.today()
        edad_esperada = (hoy.year - 1980
                         - ((hoy.month, hoy.day) < (1, 15)))
        self.assertEqual(self.paciente.edad, edad_esperada)


@override_settings(MIDDLEWARE=TEST_MIDDLEWARE)
class PacienteAPITests(TestCase):
    """Tests de los endpoints REST de pacientes."""

    def setUp(self):
        self.client = APIClient()
        self.admin = Usuario.objects.create_superuser(
            "admin1", "admin@pe.pe", "admin12345", rol="ADMIN"
        )
        self.medico = Usuario.objects.create_user(
            "doctor1", "doc@pe.pe", "doc12345", rol="MEDICO"
        )
        self.u_pac = Usuario.objects.create_user(
            "pac1", "pac@pe.pe", "pac12345", rol="PACIENTE",
            first_name="Carlos", last_name="Rios"
        )
        self.paciente = Paciente.objects.create(
            usuario=self.u_pac, fecha_nacimiento="1990-05-20"
        )

    def _login(self, usuario):
        """Autentica con JWT directamente (sin MFA en tests)."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(usuario)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

    def test_medico_puede_listar_pacientes(self):
        self._login(self.medico)
        r = self.client.get("/api/v1/pacientes/")
        self.assertEqual(r.status_code, 200)

    def test_paciente_solo_se_ve_a_si_mismo(self):
        self._login(self.u_pac)
        r = self.client.get("/api/v1/pacientes/")
        self.assertEqual(r.status_code, 200)
        ids = [p["id"] for p in r.data.get("results", r.data)]
        self.assertIn(self.paciente.id, ids)
        self.assertEqual(len(ids), 1)

    def test_filtrar_por_condicion(self):
        """GET /pacientes/?condiciones__codigo=DIABETES filtra correctamente."""
        diab = CondicionCronica.objects.create(nombre="Diabetes", codigo="DIABETES")
        PacienteCondicion.objects.create(
            paciente=self.paciente, condicion=diab, fecha_diagnostico="2020-01-01"
        )
        self._login(self.medico)
        r = self.client.get("/api/v1/pacientes/?condiciones__codigo=DIABETES")
        self.assertEqual(r.status_code, 200)
        resultados = r.data.get("results", r.data)
        self.assertTrue(len(resultados) >= 1)

    def test_catalogo_condiciones_autenticado(self):
        """GET /condiciones/ devuelve el catálogo."""
        self._login(self.medico)
        r = self.client.get("/api/v1/condiciones/")
        self.assertEqual(r.status_code, 200)

    def test_historial_endpoint(self):
        """GET /pacientes/{id}/historial/ devuelve datos consolidados."""
        self._login(self.medico)
        r = self.client.get(f"/api/v1/pacientes/{self.paciente.id}/historial/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("paciente", r.data)
        self.assertIn("citas", r.data)
        self.assertIn("signos", r.data)
