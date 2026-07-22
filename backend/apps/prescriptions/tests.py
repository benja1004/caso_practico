from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Usuario
from apps.patients.models import Paciente
from .models import Prescripcion, DetallePrescripcion


class PrescripcionTests(TestCase):
    def setUp(self):
        self.medico = Usuario.objects.create_user(
            username="medico_test",
            email="medico@saludconnect.pe",
            password="Password123!",
            rol="MEDICO"
        )
        self.paciente_user = Usuario.objects.create_user(
            username="paciente_test",
            email="paciente@saludconnect.pe",
            password="Password123!",
            rol="PACIENTE"
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            fecha_nacimiento="1990-01-01"
        )
        self.client = APIClient()

    def test_creacion_prescripcion_con_detalles(self):
        pres = Prescripcion.objects.create(paciente=self.paciente, medico=self.medico)
        DetallePrescripcion.objects.create(
            prescripcion=pres,
            medicamento="Paracetamol 500mg",
            dosis="1 tableta",
            frecuencia="Cada 8 horas",
            duracion_dias=7
        )
        self.assertEqual(pres.detalles.count(), 1)
        self.assertEqual(len(pres.codigo_verificacion), 12)
        self.assertTrue(bool(pres.firma_simulada))

    def test_verificar_endpoint_publico(self):
        pres = Prescripcion.objects.create(paciente=self.paciente, medico=self.medico)
        url = f"/api/v1/prescripciones/verificar/?codigo={pres.codigo_verificacion}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("valida"))
        self.assertEqual(res.data["receta"]["codigo_verificacion"], pres.codigo_verificacion)

    def test_pdf_endpoint_publico(self):
        pres = Prescripcion.objects.create(paciente=self.paciente, medico=self.medico)
        url = f"/api/v1/prescripciones/{pres.id}/pdf/?codigo={pres.codigo_verificacion}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
