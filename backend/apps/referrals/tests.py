from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Usuario, Especialidad, CentroSalud, PerfilMedico
from apps.patients.models import Paciente
from .models import Derivacion


class DerivacionTests(TestCase):
    def setUp(self):
        self.esp1 = Especialidad.objects.create(nombre="Medicina General")
        self.esp2 = Especialidad.objects.create(nombre="Cardiologia")
        self.centro1 = CentroSalud.objects.create(nombre="Posta Central", nivel_atencion=1, ubicacion="Lima Central")
        self.centro2 = CentroSalud.objects.create(nombre="Hospital Regional", nivel_atencion=3, ubicacion="Lima Norte")

        self.medico_origen = Usuario.objects.create_user(
            username="medico_origen",
            email="origen@saludconnect.pe",
            password="Password123!",
            rol="MEDICO"
        )
        PerfilMedico.objects.create(usuario=self.medico_origen, especialidad=self.esp1, centro_salud=self.centro1, numero_colegiatura="CMP123")

        self.especialista = Usuario.objects.create_user(
            username="especialista_cardio",
            email="cardio@saludconnect.pe",
            password="Password123!",
            rol="MEDICO"
        )
        PerfilMedico.objects.create(usuario=self.especialista, especialidad=self.esp2, centro_salud=self.centro2, numero_colegiatura="CMP456")
        self.paciente_user = Usuario.objects.create_user(
            username="paciente_deriv",
            email="paciente_d@saludconnect.pe",
            password="Password123!",
            rol="PACIENTE"
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            fecha_nacimiento="1985-05-15"
        )
        self.client = APIClient()

    def test_crear_derivacion_y_notificar(self):
        self.client.force_authenticate(user=self.medico_origen)
        data = {
            "paciente": self.paciente.id,
            "especialista_destino": self.especialista.id,
            "especialidad_destino": self.esp2.id,
            "centro_origen": self.centro1.id,
            "centro_destino": self.centro2.id,
            "motivo": "Sospecha de arritmia severa",
            "prioridad": "ALTA"
        }
        res = self.client.post("/api/v1/derivaciones/", data=data, format="json")
        self.assertEqual(res.status_code, 201)
        
        deriv_id = res.data["id"]
        deriv = Derivacion.objects.get(id=deriv_id)
        self.assertEqual(deriv.estado, "PENDIENTE")

        # Test cambiar estado
        self.client.force_authenticate(user=self.especialista)
        res_cambio = self.client.post(f"/api/v1/derivaciones/{deriv_id}/cambiar_estado/", {"estado": "ACEPTADA"})
        self.assertEqual(res_cambio.status_code, 200)
        deriv.refresh_from_db()
        self.assertEqual(deriv.estado, "ACEPTADA")
