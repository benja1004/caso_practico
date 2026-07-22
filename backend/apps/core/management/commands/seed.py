"""Datos de demostracion para la defensa: python manage.py seed"""
import random
from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CentroSalud, Especialidad, PerfilMedico
from apps.patients.models import Paciente, CondicionCronica, PacienteCondicion
from apps.schedule.models import HorarioMedico, BloqueoAgenda
from apps.appointments.models import Cita
from apps.clinical.models import RangoClinico, SignoVital, RegistroOffline
from apps.prescriptions.models import Prescripcion, DetallePrescripcion
from apps.referrals.models import Derivacion

Usuario = get_user_model()


class Command(BaseCommand):
    help = "Carga datos de demostracion (usuarios, pacientes, signos, citas, etc.)."

    def handle(self, *args, **options):
        if Usuario.objects.filter(username="admin").exists():
            self.stdout.write(self.style.WARNING("Seed ya ejecutado."))
            return

        # --- Catalogos ---
        centro1 = CentroSalud.objects.create(
            nombre="Puesto Rural Sicaya", nivel_atencion=1,
            ubicacion="Sicaya - Junin", tiene_conectividad_estable=False)
        centro2 = CentroSalud.objects.create(
            nombre="Centro de Salud Chilca", nivel_atencion=2,
            ubicacion="Chilca - Huancayo", tiene_conectividad_estable=True)
        centro3 = CentroSalud.objects.create(
            nombre="Hospital El Carmen (Especializado)", nivel_atencion=3,
            ubicacion="El Carmen - Huancayo", tiene_conectividad_estable=True)

        especialidades = {n: Especialidad.objects.create(nombre=n) for n in
                          ["Medicina General", "Cardiologia", "Neumologia", "Endocrinologia"]}

        condiciones = {c: CondicionCronica.objects.create(nombre=n, codigo=c) for c, n in
                       [("DIABETES", "Diabetes"),
                        ("HIPERTENSION", "Hipertension"), ("EPOC", "EPOC")]}

        # --- Usuarios + perfiles ---
        admin = Usuario.objects.create_superuser(
            "admin", "admin@saludconnect.pe", "admin123", rol="ADMIN",
            first_name="Admin", last_name="Sistema", dni="00000001")
        admin.mfa_enabled = True
        admin.save()

        doctor1 = Usuario.objects.create_user(
            "doctor1", "doctor1@saludconnect.pe", "doctor123", rol="MEDICO",
            first_name="Maria", last_name="Quispe", dni="11111111", telefono="999888777")
        doctor1.mfa_enabled = True; doctor1.save()
        PerfilMedico.objects.create(usuario=doctor1, especialidad=especialidades["Medicina General"],
                                    centro_salud=centro2, numero_colegiatura="CMP-12345")

        doctor2 = Usuario.objects.create_user(
            "doctor2", "doctor2@saludconnect.pe", "doctor123", rol="MEDICO",
            first_name="Juan", last_name="Huaman", dni="22222222", telefono="999777666")
        doctor2.mfa_enabled = True; doctor2.save()
        PerfilMedico.objects.create(usuario=doctor2, especialidad=especialidades["Cardiologia"],
                                    centro_salud=centro3, numero_colegiatura="CMP-67890")

        doctor3 = Usuario.objects.create_user(
            "doctor3", "doctor3@saludconnect.pe", "doctor123", rol="MEDICO",
            first_name="Ana", last_name="Rojas", dni="33333333", telefono="999666555")
        doctor3.mfa_enabled = True; doctor3.save()
        PerfilMedico.objects.create(usuario=doctor3, especialidad=especialidades["Neumologia"],
                                    centro_salud=centro3, numero_colegiatura="CMP-11111")

        pacientes_info = [
            ("paciente1", "12345678", "Carlos", "Paredes", date(1965, 3, 12),
             centro1, "DIABETES"),
            ("paciente2", "87654321", "Rosa", "Llacta", date(1972, 7, 25),
             centro1, "HIPERTENSION"),
            ("paciente3", "45612378", "Andres", "Ticse", date(1958, 11, 3),
             centro2, "EPOC"),
        ]
        pacientes = []
        for username, dni, nom, ape, fnac, centro, cond in pacientes_info:
            u = Usuario.objects.create_user(username, f"{username}@mail.pe", "paciente123",
                                            rol="PACIENTE", first_name=nom, last_name=ape,
                                            dni=dni, telefono="999555444")
            u.mfa_enabled = True; u.save()
            p = Paciente.objects.create(usuario=u, fecha_nacimiento=fnac,
                                        direccion="Huancayo", centro_salud_asignado=centro,
                                        contacto_emergencia="Familiar")
            PacienteCondicion.objects.create(paciente=p, condicion=condiciones[cond],
                                             fecha_diagnostico=date(2020, 1, 1))
            pacientes.append(p)

        # --- Horarios medicos (plantilla semanal recurrente) ---
        for doctor, esp in [(doctor1, "Medicina General"), (doctor2, "Cardiologia"), (doctor3, "Neumologia")]:
            for dia in range(0, 5):  # lunes a viernes
                HorarioMedico.objects.create(
                    medico=doctor, dia_semana=dia, hora_inicio=time(8, 0),
                    hora_fin=time(13, 0), duracion_cita_min=30, activo=True)

        # Un bloqueo de agenda (sin motivo visible al paciente) -> lejos de la semana de demo
        BloqueoAgenda.objects.create(medico=doctor1, fecha_inicio=date.today() + timedelta(days=30),
                                     fecha_fin=date.today() + timedelta(days=33), motivo="Capacitacion ACLS")

        # --- Rangos clinicos (genericos + por condicion cronica) ---
        RangoClinico.objects.create(tipo_signo="GLUCOSA", valor_min=70, valor_max=140,
                                    valor_min_critico=40, valor_max_critico=250, unidad="mg/dL")
        RangoClinico.objects.create(tipo_signo="GLUCOSA", condicion_cronica=condiciones["DIABETES"],
                                    valor_min=80, valor_max=180, valor_min_critico=60,
                                    valor_max_critico=300, unidad="mg/dL")
        RangoClinico.objects.create(tipo_signo="SPO2", valor_min=92, valor_max=100,
                                    valor_min_critico=85, valor_max_critico=100, unidad="%")
        RangoClinico.objects.create(tipo_signo="SPO2", condicion_cronica=condiciones["EPOC"],
                                    valor_min=88, valor_max=100, valor_min_critico=82,
                                    valor_max_critico=100, unidad="%")
        RangoClinico.objects.create(tipo_signo="TEMPERATURA", valor_min=36.0, valor_max=37.5,
                                    valor_min_critico=35.0, valor_max_critico=39.5, unidad="°C")
        RangoClinico.objects.create(tipo_signo="PRESION", valor_min=90, valor_max=140,
                                    valor_min_critico=70, valor_max_critico=180, unidad="mmHg")
        # Presion diastolica con condicion generica (usa el mismo valor para el check)
        RangoClinico.objects.create(tipo_signo="PRESION", condicion_cronica=condiciones["HIPERTENSION"],
                                    valor_min=90, valor_max=150, valor_min_critico=70,
                                    valor_max_critico=200, unidad="mmHg")

        # --- Signos vitales historicos (14 dias, incluye presion sis/dia) ---
        for p in pacientes:
            for i in range(14):
                fecha = timezone.now() - timedelta(days=13 - i)
                SignoVital.objects.create(
                    paciente=p, tipo="GLUCOSA", valor=random.randint(85, 200),
                    unidad="mg/dL", registrado_por=doctor1, registrado_en=fecha)
                SignoVital.objects.create(
                    paciente=p, tipo="PRESION",
                    valor_sistolica=random.randint(105, 175),
                    valor_diastolica=random.randint(60, 105),
                    unidad="mmHg", registrado_por=doctor1, registrado_en=fecha)
                SignoVital.objects.create(
                    paciente=p, tipo="SPO2", valor=random.randint(86, 99),
                    unidad="%", registrado_por=doctor1, registrado_en=fecha)

        # --- Cita confirmada (creada por el paciente) ---
        cita = Cita.objects.create(
            paciente=pacientes[0], medico=doctor1, centro_salud=centro2,
            fecha_hora=timezone.now() + timedelta(days=1, hours=2),
            motivo="Control de diabetes", estado="CONFIRMADA", creado_por=pacientes[0].usuario)

        # --- Prescripcion con detalles ---
        pres = Prescripcion.objects.create(
            paciente=pacientes[0], medico=doctor1, cita=cita)
        DetallePrescripcion.objects.create(prescripcion=pres, medicamento="Metformina 850mg",
                                           dosis="1 tableta", frecuencia="cada 12 horas",
                                           duracion_dias=30)
        DetallePrescripcion.objects.create(prescripcion=pres, medicamento="Glibenclamida 5mg",
                                           dosis="1 tableta", frecuencia="en ayunas",
                                           duracion_dias=15)

        # --- Derivacion (a Neumologia) ---
        Derivacion.objects.create(
            paciente=pacientes[2], medico_origen=doctor1,
            especialidad_destino=especialidades["Neumologia"],
            especialista_destino=doctor3, centro_origen=centro2, centro_destino=centro3,
            motivo="EPOC con SpO2 persistentemente baja (<90%).", prioridad="ALTA")

        # --- Un registro offline ya sincronizado (evidencia RNF-03) ---
        RegistroOffline.objects.create(
            paciente=pacientes[0], dispositivo_id="web-demo",
            payload={"tipo": "GLUCOSA", "valor": 240, "capturado_en": timezone.now().isoformat()},
            capturado_en=timezone.now(), sincronizado=True, sincronizado_en=timezone.now())

        self.stdout.write(self.style.SUCCESS(
            "Seed OK. Usuarios: admin/admin123, doctor1..3/doctor123, paciente1..3/paciente123\n"
            "MFA TOTP activado (codigo actual en consola/DEBUG, o escanea el QR setup)."))