<%@ page contentType="application/json; charset=UTF-8" %>
<%@ page import="java.io.*, java.net.*, java.nio.file.*, java.util.*" %>
<%--
  SALUDCONNECT - Modulo legacy: patient-sync.jsp
  --------------------------------------------------------------
  Migra historiales clinicos desde CSV (historiales.csv) y los
  publica en la API REST de SALUDCONNECT (POST /api/v1/pacientes/).

  Despliegue: copiar este archivo a <TOMCAT>/webapps/legacy/ junto
  con historiales.csv y acceder a:
    http://localhost:8080/legacy/patient-sync.jsp?token=JWT_ADMIN

  Formato CSV: dni,nombres,apellidos,fecha_nacimiento,sexo,condicion
--%>
<%
String apiBase = application.getInitParameter("API_BASE");
if (apiBase == null) apiBase = "http://localhost:8000/api/v1";
String token = request.getParameter("token");
if (token == null) token = "";

String csvPath = application.getRealPath("/") + "historiales.csv";
List<String> resultado = new ArrayList<String>();
int migrados = 0, errores = 0;

File csv = new File(csvPath);
if (!csv.exists()) {
    out.print("{\"error\": \"No se encontro historiales.csv en \" + csvPath}");
    return;
}

BufferedReader br = new BufferedReader(new FileReader(csv));
String linea = br.readLine(); // cabecera

while ((linea = br.readLine()) != null) {
    String[] c = linea.split(",");
    if (c.length < 6) continue;
    String json = "{"
        + "\"dni\":\"" + c[0].trim() + "\","
        + "\"nombres\":\"" + c[1].trim() + "\","
        + "\"apellidos\":\"" + c[2].trim() + "\","
        + "\"fecha_nacimiento\":\"" + c[3].trim() + "\","
        + "\"sexo\":\"" + c[4].trim() + "\","
        + "\"condicion_cronica\":\"" + c[5].trim().toUpperCase() + "\""
        + "}";
    try {
        URL url = new URL(apiBase + "/pacientes/");
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type", "application/json");
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setDoOutput(true);
        OutputStream os = con.getOutputStream();
        os.write(json.getBytes("UTF-8"));
        os.close();
        int status = con.getResponseCode();
        if (status == 201) { migrados++; }
        else { errores++; resultado.add(c[0] + " -> HTTP " + status); }
        con.disconnect();
    } catch (Exception ex) {
        errores++;
        resultado.add(c[0] + " -> " + ex.getMessage());
    }
}
br.close();

out.print("{"
    + "\"modulo\": \"patient-sync legacy (JSP)\","
    + "\"migrados\": " + migrados + ","
    + "\"errores\": " + errores + ","
    + "\"detalle\": \"" + String.join(" | ", resultado) + "\""
    + "}");
%>
