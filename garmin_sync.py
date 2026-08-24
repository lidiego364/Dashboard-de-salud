"""
Descarga los últimos 30 días de datos de Garmin Connect (peso, pasos,
sueño, frecuencia cardíaca en reposo, actividades, sleep score, HRV,
training readiness, body battery, estrés y VO2 Max) y los guarda en
datos.db (SQLite).

Uso:
    python garmin_sync.py
"""

import base64
import os
import re
import sqlite3
from datetime import date, timedelta

import requests
from dotenv import load_dotenv
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
from garth.exc import GarthHTTPError

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "datos.db")
TOKEN_STORE = os.path.join(SCRIPT_DIR, ".garmin_tokens")
DAYS_BACK = 30


GARMIN_TOKEN_FILES = ("oauth1_token.json", "oauth2_token.json")


def _vault_config():
    """Credenciales del repo privado de GitHub usado como bóveda del token
    (ver GARMIN_VAULT_TOKEN / GARMIN_VAULT_REPO). Devuelve None si no está
    configurado (ej. uso local sin necesidad de bóveda)."""
    token = os.getenv("GARMIN_VAULT_TOKEN")
    repo = os.getenv("GARMIN_VAULT_REPO")
    if not token or not repo:
        return None
    return token, repo


def bootstrap_token_desde_vault():
    """En hosting con disco efímero (ej. Streamlit Community Cloud) el
    directorio TOKEN_STORE no sobrevive un reinicio. Si no hay token en
    disco, lo descarga del repo privado de GitHub que actúa de bóveda
    (actualizado por el refresh local periódico) para evitar tener que
    resolver MFA de nuevo o depender de un secret estático vencido."""
    t1 = os.path.join(TOKEN_STORE, "oauth1_token.json")
    t2 = os.path.join(TOKEN_STORE, "oauth2_token.json")
    if os.path.exists(t1) and os.path.exists(t2):
        return
    cfg = _vault_config()
    if not cfg:
        return
    vault_token, vault_repo = cfg
    os.makedirs(TOKEN_STORE, exist_ok=True)
    try:
        for nombre in GARMIN_TOKEN_FILES:
            resp = requests.get(
                f"https://api.github.com/repos/{vault_repo}/contents/{nombre}",
                headers={
                    "Authorization": f"token {vault_token}",
                    "Accept": "application/vnd.github.raw+json",
                },
                timeout=15,
            )
            resp.raise_for_status()
            with open(os.path.join(TOKEN_STORE, nombre), "wb") as f:
                f.write(resp.content)
    except requests.exceptions.RequestException as exc:
        # No cortamos el script: sin token de la bóveda, sigue el flujo
        # normal de abajo (token local si hay, si no login con contraseña).
        # Limpiamos archivos a medio escribir para no dejar un token roto.
        for nombre in GARMIN_TOKEN_FILES:
            ruta = os.path.join(TOKEN_STORE, nombre)
            if os.path.exists(ruta):
                os.remove(ruta)
        print(
            f"Aviso: no se pudo leer la bóveda ({exc}). Revisá que "
            "GARMIN_VAULT_TOKEN tenga acceso de 'Contents: Read and write' "
            f"al repo {vault_repo} en GitHub."
        )
        return
    print("Token de Garmin descargado desde la bóveda privada de GitHub.")


def push_token_a_vault():
    """Sube el token recién refrescado a la bóveda privada de GitHub, para
    que la próxima vez que Streamlit Cloud reinicie (disco vacío) arranque
    ya con el token fresco en vez de uno vencido."""
    cfg = _vault_config()
    if not cfg:
        return
    vault_token, vault_repo = cfg
    headers = {
        "Authorization": f"token {vault_token}",
        "Accept": "application/vnd.github+json",
    }
    for nombre in GARMIN_TOKEN_FILES:
        ruta_local = os.path.join(TOKEN_STORE, nombre)
        if not os.path.exists(ruta_local):
            continue
        try:
            with open(ruta_local, "rb") as f:
                contenido_b64 = base64.b64encode(f.read()).decode()
            url = f"https://api.github.com/repos/{vault_repo}/contents/{nombre}"
            actual = requests.get(url, headers=headers, timeout=15)
            sha = actual.json().get("sha") if actual.status_code == 200 else None
            payload = {"message": "Refresh automático de token de Garmin", "content": contenido_b64}
            if sha:
                payload["sha"] = sha
            resp = requests.put(url, headers=headers, json=payload, timeout=15)
            if resp.status_code not in (200, 201):
                print(f"Aviso: no se pudo subir {nombre} a la bóveda ({resp.status_code}).")
        except requests.exceptions.RequestException as exc:
            print(f"Aviso: no se pudo subir {nombre} a la bóveda ({exc}).")


def init_api():
    """Inicia sesión en Garmin Connect, reutilizando el token guardado
    en TOKEN_STORE si existe, para no pedir usuario/contraseña (ni MFA)
    en cada ejecución."""
    load_dotenv(os.path.join(SCRIPT_DIR, ".env"))
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        raise SystemExit(
            "Falta GARMIN_EMAIL y/o GARMIN_PASSWORD en el archivo .env"
        )

    bootstrap_token_desde_vault()

    try:
        api = Garmin()
        api.login(TOKEN_STORE)
        # login() puede refrescar el access token internamente (en memoria)
        # sin guardarlo en disco. Lo volvemos a guardar para que la próxima
        # ejecución reutilice el token fresco en vez de pedirle a Garmin un
        # intercambio oauth1->oauth2 nuevo cada vez (eso agota el límite
        # de solicitudes rápido).
        api.garth.dump(TOKEN_STORE)
        push_token_a_vault()
        print("Sesión iniciada usando el token guardado.")
        return api
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status == 429:
            # Límite de tasa de Garmin: no sirve reintentar con usuario/
            # contraseña de inmediato, solo empeora el bloqueo.
            raise SystemExit(
                "Garmin Connect está limitando las solicitudes ahora mismo "
                "(error 429 al refrescar el token). Es temporal: espera unos "
                "15-30 minutos y vuelve a intentar."
            )
        print(f"Aviso: token guardado inválido ({exc}).")
    except (FileNotFoundError, GarthHTTPError, GarminConnectAuthenticationError) as exc:
        print(f"Aviso: no hay token válido guardado ({exc}).")

    print("Iniciando sesión con email/contraseña...")
    api = Garmin(email=email, password=password)
    api.login()
    api.garth.dump(TOKEN_STORE)
    push_token_a_vault()
    print("Sesión iniciada y token guardado para próximas ejecuciones.")
    return api


NUEVAS_COLUMNAS_GARMIN_METRICS = {
    "sleep_score": "INTEGER",
    "hrv_ms": "INTEGER",
    "training_readiness": "INTEGER",
    "body_battery_max": "INTEGER",
    "body_battery_min": "INTEGER",
    "estres_promedio": "INTEGER",
    "vo2max": "REAL",
    # --- Métricas avanzadas (metabolismo, hidratación, sueño, carga) ---
    "calorias_activas": "INTEGER",
    "calorias_reposo": "INTEGER",
    "perdida_liquidos_ml": "INTEGER",
    "sueno_profundo_h": "REAL",
    "sueno_rem_h": "REAL",
    "sueno_ligero_h": "REAL",
    "respiracion_nocturna": "REAL",
    "carga_entrenamiento": "INTEGER",
    "estado_entrenamiento": "TEXT",
}

# Traducción del estado de entrenamiento (prefijo de trainingStatusFeedbackPhrase).
ESTADO_ENTRENAMIENTO_ES = {
    "PRODUCTIVE": "Productivo",
    "MAINTAINING": "Mantenimiento",
    "RECOVERY": "Recuperación",
    "STRAINED": "Tensión",
    "OVERREACHING": "Sobreesfuerzo",
    "UNPRODUCTIVE": "Improductivo",
    "DETRAINING": "Desentrenamiento",
    "PEAKING": "Punto máximo",
    "NO_STATUS": "Sin estado",
    "UNRECOGNIZED": "Sin estado",
}


def init_db(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS garmin_metrics (
            fecha TEXT PRIMARY KEY,
            peso_kg REAL,
            pasos INTEGER,
            horas_sueno REAL,
            fc_reposo INTEGER,
            tipo_actividad TEXT,
            duracion_actividad_min REAL,
            calorias_actividad INTEGER,
            sleep_score INTEGER,
            hrv_ms INTEGER,
            training_readiness INTEGER,
            body_battery_max INTEGER,
            body_battery_min INTEGER,
            estres_promedio INTEGER,
            vo2max REAL,
            calorias_activas INTEGER,
            calorias_reposo INTEGER,
            perdida_liquidos_ml INTEGER,
            sueno_profundo_h REAL,
            sueno_rem_h REAL,
            sueno_ligero_h REAL,
            respiracion_nocturna REAL,
            carga_entrenamiento INTEGER,
            estado_entrenamiento TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracker_manual (
            fecha TEXT PRIMARY KEY,
            dosis_mg REAL,
            zona_inyeccion TEXT,
            peso_manual REAL,
            creatina_g REAL,
            notas TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS actividades_detalle (
            activity_id INTEGER PRIMARY KEY,
            fecha TEXT,
            nombre TEXT,
            tipo_actividad TEXT,
            duracion_min REAL,
            calorias INTEGER,
            fc_promedio INTEGER,
            fc_maxima INTEGER,
            fc_zona1_min REAL,
            fc_zona2_min REAL,
            fc_zona3_min REAL,
            fc_zona4_min REAL,
            fc_zona5_min REAL,
            distancia_km REAL,
            ritmo_min_km REAL,
            carga_entrenamiento REAL,
            efecto_aerobico REAL,
            efecto_anaerobico REAL,
            series_totales INTEGER,
            repeticiones_totales INTEGER,
            ejercicios_detectados TEXT
        )
        """
    )
    conn.commit()
    ensure_columns(conn)


def ensure_columns(conn):
    """Agrega columnas nuevas a garmin_metrics con ALTER TABLE si faltan,
    sin tocar los datos ya guardados (para bases de datos creadas antes
    de que estas métricas existieran)."""
    existentes = {row[1] for row in conn.execute("PRAGMA table_info(garmin_metrics)")}
    for columna, tipo in NUEVAS_COLUMNAS_GARMIN_METRICS.items():
        if columna not in existentes:
            conn.execute(f"ALTER TABLE garmin_metrics ADD COLUMN {columna} {tipo}")
    conn.commit()


def fetch_weights_by_date(api, start, end):
    """Devuelve un dict {fecha: peso_kg} usando una sola llamada de rango."""
    weights = {}
    body_comp = api.get_body_composition(start.isoformat(), end.isoformat())
    for entry in body_comp.get("dateWeightList", []) or []:
        weight_grams = entry.get("weight")
        cal_date = entry.get("calendarDate")
        if weight_grams is not None and cal_date:
            weights[cal_date] = round(weight_grams / 1000, 2)
    return weights


def aggregate_activities_by_day(activities):
    """Devuelve {fecha: {tipos, duracion_min, calorias, agua_ml}} a partir de
    una lista de actividades ya descargada (get_activities_by_date).
    agua_ml es la suma de la pérdida estimada de líquidos (waterEstimated,
    sweat loss) de todas las actividades de ese día."""
    activities_by_day = {}
    for act in activities or []:
        start_local = act.get("startTimeLocal", "")
        act_date = start_local.split(" ")[0] if start_local else None
        if not act_date:
            continue
        day = activities_by_day.setdefault(
            act_date,
            {"tipos": [], "duracion_min": 0.0, "calorias": 0, "agua_ml": 0.0},
        )
        activity_type = (act.get("activityType") or {}).get("typeKey", "desconocido")
        duration_sec = act.get("duration") or 0
        calories = act.get("calories") or 0
        agua = act.get("waterEstimated") or 0
        day["tipos"].append(activity_type)
        day["duracion_min"] += duration_sec / 60
        day["calorias"] += calories
        day["agua_ml"] += agua
    return activities_by_day


def fetch_exercise_sets(api, activity_id):
    """Para entrenamientos de fuerza: series totales, repeticiones totales y
    los ejercicios principales detectados, vía get_activity_exercise_sets.
    Devuelve (series_totales, repeticiones_totales, ejercicios_detectados),
    todo None si el método falla o no hay datos (p.ej. no es de fuerza)."""
    try:
        datos = api.get_activity_exercise_sets(activity_id)
        sets = (datos or {}).get("exerciseSets") or []
        activos = [s for s in sets if s.get("setType") == "ACTIVE"]
        if not activos:
            return None, None, None
        series_totales = len(activos)
        repeticiones_totales = sum(s.get("repetitionCount") or 0 for s in activos)
        conteo = {}
        for s in activos:
            ejercicios = s.get("exercises") or []
            if not ejercicios:
                continue
            principal = max(ejercicios, key=lambda e: e.get("probability") or 0)
            categoria = principal.get("category")
            if categoria:
                conteo[categoria] = conteo.get(categoria, 0) + 1
        principales = sorted(conteo.items(), key=lambda kv: kv[1], reverse=True)
        nombres = [c for c, _n in principales if c != "UNKNOWN"][:3]
        if not nombres:
            nombres = [c for c, _n in principales[:3]]
        ejercicios_detectados = ", ".join(nombres) if nombres else None
        return series_totales, repeticiones_totales, ejercicios_detectados
    except Exception as exc:
        print(f"  Aviso: no se pudieron obtener series de la actividad {activity_id}: {exc}")
        return None, None, None


def build_activity_details(api, activities):
    """Arma una fila de detalle por actividad: FC promedio/máxima, tiempo en
    cada zona de FC, distancia/ritmo (deportes de cardio) y series/repeticiones
    (fuerza). La mayoría de los campos ya vienen en el resumen de
    get_activities_by_date -- solo las series de fuerza requieren una llamada
    adicional por actividad (get_activity_exercise_sets).
    Devuelve (filas_para_insertar, stats_de_disponibilidad)."""
    filas = []
    stats = {
        "fc_promedio": 0,
        "fc_zonas": 0,
        "distancia_o_ritmo": 0,
        "series_repeticiones": 0,
        "carga_o_efecto": 0,
    }
    for act in activities or []:
        activity_id = act.get("activityId")
        start_local = act.get("startTimeLocal", "")
        fecha = start_local.split(" ")[0] if start_local else None
        if not activity_id or not fecha:
            continue

        tipo = (act.get("activityType") or {}).get("typeKey", "desconocido")
        nombre = act.get("activityName")
        duracion_min = round((act.get("duration") or 0) / 60, 1)
        calorias = int(act["calories"]) if act.get("calories") else None
        fc_promedio = int(act["averageHR"]) if act.get("averageHR") else None
        fc_maxima = int(act["maxHR"]) if act.get("maxHR") else None

        zonas = []
        for i in range(1, 6):
            seg = act.get(f"hrTimeInZone_{i}")
            zonas.append(round(seg / 60, 2) if seg is not None else None)

        distancia_m = act.get("distance") or 0
        distancia_km = round(distancia_m / 1000, 2) if distancia_m else None
        velocidad = act.get("averageSpeed") or 0
        ritmo_min_km = round((1000 / velocidad) / 60, 2) if velocidad > 0 else None

        carga = act.get("activityTrainingLoad")
        efecto_aerobico = act.get("aerobicTrainingEffect")
        efecto_anaerobico = act.get("anaerobicTrainingEffect")

        series_totales = repeticiones_totales = ejercicios_detectados = None
        if tipo == "strength_training":
            series_totales, repeticiones_totales, ejercicios_detectados = fetch_exercise_sets(
                api, activity_id
            )

        if fc_promedio is not None:
            stats["fc_promedio"] += 1
        if any(z is not None for z in zonas):
            stats["fc_zonas"] += 1
        if distancia_km is not None or ritmo_min_km is not None:
            stats["distancia_o_ritmo"] += 1
        if series_totales is not None:
            stats["series_repeticiones"] += 1
        if carga is not None or efecto_aerobico is not None:
            stats["carga_o_efecto"] += 1

        filas.append(
            (
                activity_id,
                fecha,
                nombre,
                tipo,
                duracion_min,
                calorias,
                fc_promedio,
                fc_maxima,
                zonas[0],
                zonas[1],
                zonas[2],
                zonas[3],
                zonas[4],
                distancia_km,
                ritmo_min_km,
                round(carga, 1) if carga is not None else None,
                round(efecto_aerobico, 1) if efecto_aerobico is not None else None,
                round(efecto_anaerobico, 1) if efecto_anaerobico is not None else None,
                series_totales,
                repeticiones_totales,
                ejercicios_detectados,
            )
        )
    return filas, stats


def fetch_day_metrics(api, day_str):
    """Pasos, FC en reposo y calorías (activas y en reposo/BMR) del día.
    Devuelve (pasos, fc_reposo, calorias_activas, calorias_reposo)."""
    pasos = fc_reposo = calorias_activas = calorias_reposo = None
    try:
        summary = api.get_user_summary(day_str)
        pasos = summary.get("totalSteps")
        fc_reposo = summary.get("restingHeartRate")
        activas = summary.get("activeKilocalories")
        reposo = summary.get("bmrKilocalories")
        calorias_activas = int(activas) if activas is not None else None
        calorias_reposo = int(reposo) if reposo is not None else None
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener resumen diario de {day_str}: {exc}")
    return pasos, fc_reposo, calorias_activas, calorias_reposo


def fetch_sleep_metrics(api, day_str):
    """Extrae de get_sleep_data: horas totales, sleep score, fases (profundo,
    REM, ligero en horas) y respiración nocturna promedio.
    Devuelve (horas, score, profundo_h, rem_h, ligero_h, respiracion)."""
    try:
        sleep_data = api.get_sleep_data(day_str)
        dto = sleep_data.get("dailySleepDTO") or {}
        seconds = dto.get("sleepTimeSeconds")
        horas_sueno = round(seconds / 3600, 2) if seconds else None
        sleep_score = (dto.get("sleepScores") or {}).get("overall", {}).get("value")

        def a_horas(campo):
            s = dto.get(campo)
            return round(s / 3600, 2) if s else None

        profundo_h = a_horas("deepSleepSeconds")
        rem_h = a_horas("remSleepSeconds")
        ligero_h = a_horas("lightSleepSeconds")
        respiracion = dto.get("averageRespirationValue")
        return horas_sueno, sleep_score, profundo_h, rem_h, ligero_h, respiracion
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener sueño de {day_str}: {exc}")
        return None, None, None, None, None, None


def fetch_training_status(api, day_str):
    """Carga de entrenamiento aguda (número) y estado de entrenamiento (texto
    en español) desde get_training_status. Devuelve (carga, estado)."""
    try:
        ts = api.get_training_status(day_str) or {}
        latest = (
            (ts.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData")
            or {}
        )
        carga = None
        estado = None
        for _dev, data in latest.items():
            acute = (data.get("acuteTrainingLoadDTO") or {}).get(
                "dailyTrainingLoadAcute"
            )
            if acute is not None:
                carga = int(acute)
            phrase = data.get("trainingStatusFeedbackPhrase")
            if phrase:
                prefijo = re.sub(r"_\d+$", "", phrase)  # STRAINED_4 -> STRAINED
                estado = ESTADO_ENTRENAMIENTO_ES.get(prefijo, prefijo.capitalize())
            break  # dispositivo principal
        return carga, estado
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener training status de {day_str}: {exc}")
        return None, None


def fetch_hrv(api, day_str):
    """HRV promedio de la última noche, en ms (get_hrv_data)."""
    try:
        hrv_data = api.get_hrv_data(day_str)
        resumen = (hrv_data or {}).get("hrvSummary") or {}
        return resumen.get("lastNightAvg")
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener HRV de {day_str}: {exc}")
        return None


def fetch_training_readiness(api, day_str):
    """Training Readiness (0-100)."""
    try:
        datos = api.get_training_readiness(day_str)
        if isinstance(datos, list) and datos:
            return datos[0].get("score")
        if isinstance(datos, dict):
            return datos.get("score")
        return None
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener training readiness de {day_str}: {exc}")
        return None


def fetch_stress(api, day_str):
    """Nivel de estrés promedio del día (0-100)."""
    try:
        datos = api.get_stress_data(day_str)
        valor = (datos or {}).get("avgStressLevel")
        return valor if valor is not None and valor >= 0 else None
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener estrés de {day_str}: {exc}")
        return None


def fetch_vo2max(api, day_str):
    """VO2 Max, si la cuenta/dispositivo lo calcula (get_max_metrics)."""
    try:
        datos = api.get_max_metrics(day_str)
        if isinstance(datos, list) and datos:
            entrada = datos[0]
        elif isinstance(datos, dict):
            entrada = datos
        else:
            return None
        generico = entrada.get("generic") or {}
        return generico.get("vo2MaxPreciseValue") or generico.get("vo2MaxValue")
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener VO2 Max de {day_str}: {exc}")
        return None


def fetch_body_battery_by_day(api, start, end):
    """Devuelve {fecha: (max, min)} de Body Battery, en una sola llamada
    de rango. Los valores diarios vienen dentro de bodyBatteryValuesArray."""
    resultado = {}
    try:
        datos = api.get_body_battery(start.isoformat(), end.isoformat())
        for entrada in datos or []:
            fecha = entrada.get("date")
            valores = [
                v[1]
                for v in entrada.get("bodyBatteryValuesArray", []) or []
                if isinstance(v, list) and len(v) > 1 and v[1] is not None
            ]
            if fecha and valores:
                resultado[fecha] = (max(valores), min(valores))
    except Exception as exc:
        print(f"  Aviso: no se pudo obtener Body Battery: {exc}")
    return resultado


def sync():
    api = init_api()

    end = date.today()
    start = end - timedelta(days=DAYS_BACK - 1)

    print(f"Descargando datos del {start.isoformat()} al {end.isoformat()}...")

    weights_by_date = fetch_weights_by_date(api, start, end)
    activities = api.get_activities_by_date(start.isoformat(), end.isoformat()) or []
    activities_by_day = aggregate_activities_by_day(activities)
    body_battery_by_date = fetch_body_battery_by_day(api, start, end)

    print(f"Descargando detalle de {len(activities)} entrenamiento(s)...")
    detalle_rows, detalle_stats = build_activity_details(api, activities)

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    metricas_con_dato = {
        "sleep_score": 0,
        "hrv_ms": 0,
        "training_readiness": 0,
        "body_battery_max": 0,
        "estres_promedio": 0,
        "vo2max": 0,
        "calorias_activas": 0,
        "calorias_reposo": 0,
        "perdida_liquidos_ml": 0,
        "sueno_profundo_h": 0,
        "sueno_rem_h": 0,
        "sueno_ligero_h": 0,
        "respiracion_nocturna": 0,
        "carga_entrenamiento": 0,
        "estado_entrenamiento": 0,
    }

    current = start
    while current <= end:
        day_str = current.isoformat()
        print(f"Procesando {day_str}...")

        pasos, fc_reposo, calorias_activas, calorias_reposo = fetch_day_metrics(api, day_str)
        (
            horas_sueno,
            sleep_score,
            sueno_profundo_h,
            sueno_rem_h,
            sueno_ligero_h,
            respiracion_nocturna,
        ) = fetch_sleep_metrics(api, day_str)
        hrv_ms = fetch_hrv(api, day_str)
        training_readiness = fetch_training_readiness(api, day_str)
        estres_promedio = fetch_stress(api, day_str)
        vo2max = fetch_vo2max(api, day_str)
        carga_entrenamiento, estado_entrenamiento = fetch_training_status(api, day_str)
        peso_kg = weights_by_date.get(day_str)

        bb = body_battery_by_date.get(day_str)
        body_battery_max, body_battery_min = bb if bb else (None, None)

        act_info = activities_by_day.get(day_str)
        tipo_actividad = ", ".join(act_info["tipos"]) if act_info else None
        duracion_actividad_min = round(act_info["duracion_min"], 1) if act_info else None
        calorias_actividad = act_info["calorias"] if act_info else None
        perdida_liquidos_ml = int(act_info["agua_ml"]) if act_info and act_info["agua_ml"] else None

        for nombre, valor in (
            ("sleep_score", sleep_score),
            ("hrv_ms", hrv_ms),
            ("training_readiness", training_readiness),
            ("body_battery_max", body_battery_max),
            ("estres_promedio", estres_promedio),
            ("vo2max", vo2max),
            ("calorias_activas", calorias_activas),
            ("calorias_reposo", calorias_reposo),
            ("perdida_liquidos_ml", perdida_liquidos_ml),
            ("sueno_profundo_h", sueno_profundo_h),
            ("sueno_rem_h", sueno_rem_h),
            ("sueno_ligero_h", sueno_ligero_h),
            ("respiracion_nocturna", respiracion_nocturna),
            ("carga_entrenamiento", carga_entrenamiento),
            ("estado_entrenamiento", estado_entrenamiento),
        ):
            if valor is not None:
                metricas_con_dato[nombre] += 1

        conn.execute(
            """
            INSERT INTO garmin_metrics (
                fecha, peso_kg, pasos, horas_sueno, fc_reposo,
                tipo_actividad, duracion_actividad_min, calorias_actividad,
                sleep_score, hrv_ms, training_readiness,
                body_battery_max, body_battery_min, estres_promedio, vo2max,
                calorias_activas, calorias_reposo, perdida_liquidos_ml,
                sueno_profundo_h, sueno_rem_h, sueno_ligero_h,
                respiracion_nocturna, carga_entrenamiento, estado_entrenamiento
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fecha) DO UPDATE SET
                peso_kg=excluded.peso_kg,
                pasos=excluded.pasos,
                horas_sueno=excluded.horas_sueno,
                fc_reposo=excluded.fc_reposo,
                tipo_actividad=excluded.tipo_actividad,
                duracion_actividad_min=excluded.duracion_actividad_min,
                calorias_actividad=excluded.calorias_actividad,
                sleep_score=excluded.sleep_score,
                hrv_ms=excluded.hrv_ms,
                training_readiness=excluded.training_readiness,
                body_battery_max=excluded.body_battery_max,
                body_battery_min=excluded.body_battery_min,
                estres_promedio=excluded.estres_promedio,
                vo2max=excluded.vo2max,
                calorias_activas=excluded.calorias_activas,
                calorias_reposo=excluded.calorias_reposo,
                perdida_liquidos_ml=excluded.perdida_liquidos_ml,
                sueno_profundo_h=excluded.sueno_profundo_h,
                sueno_rem_h=excluded.sueno_rem_h,
                sueno_ligero_h=excluded.sueno_ligero_h,
                respiracion_nocturna=excluded.respiracion_nocturna,
                carga_entrenamiento=excluded.carga_entrenamiento,
                estado_entrenamiento=excluded.estado_entrenamiento
            """,
            (
                day_str,
                peso_kg,
                pasos,
                horas_sueno,
                fc_reposo,
                tipo_actividad,
                duracion_actividad_min,
                calorias_actividad,
                sleep_score,
                hrv_ms,
                training_readiness,
                body_battery_max,
                body_battery_min,
                estres_promedio,
                vo2max,
                calorias_activas,
                calorias_reposo,
                perdida_liquidos_ml,
                sueno_profundo_h,
                sueno_rem_h,
                sueno_ligero_h,
                respiracion_nocturna,
                carga_entrenamiento,
                estado_entrenamiento,
            ),
        )
        conn.commit()

        current += timedelta(days=1)

    if detalle_rows:
        conn.executemany(
            """
            INSERT OR REPLACE INTO actividades_detalle (
                activity_id, fecha, nombre, tipo_actividad, duracion_min, calorias,
                fc_promedio, fc_maxima,
                fc_zona1_min, fc_zona2_min, fc_zona3_min, fc_zona4_min, fc_zona5_min,
                distancia_km, ritmo_min_km,
                carga_entrenamiento, efecto_aerobico, efecto_anaerobico,
                series_totales, repeticiones_totales, ejercicios_detectados
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            detalle_rows,
        )
        conn.commit()

    conn.close()
    print(f"Listo. Datos guardados en {DB_PATH}")

    print("\nResumen de métricas (días con dato de los últimos 30):")
    for nombre, cuenta in metricas_con_dato.items():
        estado = "OK" if cuenta > 0 else "SIN DATOS para tu cuenta/dispositivo"
        print(f"  {nombre}: {cuenta}/{DAYS_BACK} días - {estado}")

    print(f"\nResumen de detalle de entrenamientos ({len(activities)} actividades en {DAYS_BACK} días):")
    for nombre, cuenta in detalle_stats.items():
        estado = "OK" if cuenta > 0 else "SIN DATOS para tu cuenta/dispositivo"
        print(f"  {nombre}: {cuenta}/{len(activities)} - {estado}")


if __name__ == "__main__":
    try:
        sync()
    except GarminConnectAuthenticationError:
        print("Error de autenticación: revisa GARMIN_EMAIL y GARMIN_PASSWORD en .env")
    except GarminConnectTooManyRequestsError:
        print("Garmin Connect está limitando las solicitudes. Intenta de nuevo más tarde.")
    except GarminConnectConnectionError as exc:
        print(f"Error de conexión con Garmin Connect: {exc}")
