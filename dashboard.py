"""
Dashboard personal de salud con estética HUD futurista (tipo "Jarvis").
Lee datos.db (tablas garmin_metrics y tracker_manual) y los muestra con
Streamlit.

Uso:
    streamlit run dashboard.py
"""

import io
import os
import sqlite3
import subprocess
import sys
from datetime import date, datetime

import anthropic
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from dotenv import load_dotenv

import reportes

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "datos.db")
SYNC_SCRIPT = os.path.join(SCRIPT_DIR, "garmin_sync.py")
MASTER_PATH = os.path.join(SCRIPT_DIR, "historial_salud_maestro.xlsx")

load_dotenv(os.path.join(SCRIPT_DIR, ".env"))


def get_secret(name, default=None):
    """Lee una credencial desde st.secrets (Streamlit Community Cloud) si
    está disponible, y si no, desde variables de entorno / .env (uso local).
    Así el mismo código funciona sin cambios en ambos lugares."""
    try:
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        pass  # sin secrets.toml configurado (normal en local) -> sigue abajo
    return os.getenv(name, default)


ANTHROPIC_API_KEY = get_secret("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = "claude-sonnet-4-6"
DIAS_CONTEXTO_IA = 14
DASHBOARD_PASSWORD = get_secret("DASHBOARD_PASSWORD")

# --- Paleta HUD / Jarvis: cian, azul eléctrico, ámbar sobre fondo oscuro ---
CY = "#00d9ff"          # cian brillante (acento principal)
AMBER = "#ffa726"       # ámbar/naranja sci-fi
NEON_GREEN = "#39ff9e"  # verde neón (estado / readiness)
GRID = "rgba(0,217,255,0.08)"
AXIS_LINE = "rgba(0,217,255,0.28)"
TXT = "#8fb8cc"

COLOR_PESO = CY
COLOR_DOSIS = AMBER
COLOR_PASOS = CY
COLOR_SUENO = "#39d0c8"                 # teal
COLOR_FC = "#ff6b6b"                    # rojo-coral
COLOR_SLEEP_SCORE = AMBER
COLOR_TRAINING_READINESS = NEON_GREEN
COLOR_BODY_BATTERY_MAX = CY
COLOR_BODY_BATTERY_MIN = AMBER
COLOR_ESTRES = "#ff5ea8"               # magenta
# Métricas avanzadas
COLOR_CAL_ACTIVAS = AMBER
COLOR_CAL_REPOSO = "#1f6f8f"           # azul apagado
COLOR_TOTAL = NEON_GREEN
COLOR_AGUA = CY
COLOR_SUENO_PROFUNDO = "#4a3aa7"       # violeta
COLOR_SUENO_REM = "#e87ba4"            # magenta suave
COLOR_SUENO_LIGERO = "#39d0c8"         # teal
COLOR_RESP = AMBER
COLOR_CARGA = AMBER

# Color del estado de entrenamiento para la tarjeta HUD.
ESTADO_COLOR = {
    "Productivo": NEON_GREEN,
    "Mantenimiento": NEON_GREEN,
    "Punto máximo": NEON_GREEN,
    "Recuperación": CY,
    "Tensión": AMBER,
    "Sobreesfuerzo": "#ff6b6b",
    "Improductivo": "#ff6b6b",
    "Desentrenamiento": "#ff6b6b",
    "Sin estado": TXT,
}

ZONAS_INYECCION = ["abdomen", "muslo", "brazo"]

COLS_DETALLE_ACTIVIDAD = [
    "activity_id", "fecha", "nombre", "tipo_actividad", "duracion_min", "calorias",
    "fc_promedio", "fc_maxima",
    "fc_zona1_min", "fc_zona2_min", "fc_zona3_min", "fc_zona4_min", "fc_zona5_min",
    "distancia_km", "ritmo_min_km",
    "carga_entrenamiento", "efecto_aerobico", "efecto_anaerobico",
    "series_totales", "repeticiones_totales", "ejercicios_detectados",
]
COLOR_ZONAS_FC = [CY, "#39d0c8", AMBER, "#ff8a3d", "#ff5252"]

st.set_page_config(page_title="Health Monitoring System", layout="wide")


# ---------------------------------------------------------------------------
# CSS HUD
# ---------------------------------------------------------------------------

HUD_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Share+Tech+Mono&display=swap');

:root { --cy:#00d9ff; --amber:#ffa726; --neon:#39ff9e; }

.stApp {
  background:
    radial-gradient(circle at 50% -10%, #0d1728 0%, #0a0e1a 55%),
    #0a0e1a;
}
[data-testid="stHeader"] { background: transparent; }

/* Títulos */
h1, h2, h3 {
  font-family: 'Orbitron', monospace !important;
  color: #e6f7ff !important;
  letter-spacing: 1px;
  text-transform: uppercase;
}
h2, h3 {
  border-left: 3px solid var(--cy);
  padding-left: 10px;
  text-shadow: 0 0 8px rgba(0,217,255,0.35);
}

/* Encabezado de sistema */
.hud-header {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 10px;
  padding: 16px 22px; margin-bottom: 16px;
  background: linear-gradient(90deg, rgba(0,217,255,0.10), rgba(0,217,255,0.02));
  border: 1px solid rgba(0,217,255,0.30); border-radius: 2px; position: relative;
  box-shadow: 0 0 22px rgba(0,217,255,0.12), inset 0 0 34px rgba(0,217,255,0.03);
}
.hud-header::before, .hud-header::after {
  content: ""; position: absolute; width: 16px; height: 16px; border: 2px solid var(--cy);
}
.hud-header::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.hud-header::after  { bottom: -1px; right: -1px; border-left: none; border-top: none; }
.hud-title {
  font-family: 'Orbitron', monospace; font-weight: 700; font-size: 1.5rem;
  color: var(--cy); letter-spacing: 3px; text-shadow: 0 0 14px rgba(0,217,255,0.6);
}
.hud-sub {
  font-family: 'Share Tech Mono', monospace; font-size: 0.72rem;
  color: #5f8fb0; letter-spacing: 2px; margin-top: 3px;
}
.hud-header-right { text-align: right; }
.hud-clock {
  font-family: 'Share Tech Mono', monospace; font-size: 1.05rem;
  color: #cfe9ff; letter-spacing: 2px;
}
.hud-status {
  font-family: 'Share Tech Mono', monospace; font-size: 0.72rem;
  color: var(--neon); letter-spacing: 2px; margin-top: 3px;
}
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--neon); box-shadow: 0 0 8px var(--neon); margin-right: 4px;
  animation: hud-pulse 1.6s infinite;
}
@keyframes hud-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

/* Tarjetas de indicadores (st.metric) como paneles HUD */
[data-testid="stMetric"] {
  position: relative;
  background: linear-gradient(135deg, rgba(0,217,255,0.06), rgba(0,217,255,0.015));
  border: 1px solid rgba(0,217,255,0.25); border-radius: 2px;
  padding: 14px 16px 12px;
  box-shadow: 0 0 18px rgba(0,217,255,0.10), inset 0 0 22px rgba(0,217,255,0.03);
}
[data-testid="stMetric"]::before, [data-testid="stMetric"]::after {
  content: ""; position: absolute; width: 12px; height: 12px; border: 2px solid var(--cy);
}
[data-testid="stMetric"]::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
[data-testid="stMetric"]::after  { bottom: -1px; right: -1px; border-left: none; border-top: none; }
[data-testid="stMetricLabel"] p, [data-testid="stMetricLabel"] div {
  font-family: 'Share Tech Mono', monospace !important;
  letter-spacing: 2px; color: #6fa8c7 !important; text-transform: uppercase;
  font-size: 0.72rem;
}
[data-testid="stMetricValue"] {
  font-family: 'Share Tech Mono', monospace !important;
  color: var(--cy) !important; text-shadow: 0 0 12px rgba(0,217,255,0.55);
  font-size: 1.9rem;
}

/* Botones */
.stButton > button, .stDownloadButton > button {
  background: rgba(0,217,255,0.08); color: var(--cy);
  border: 1px solid rgba(0,217,255,0.5); border-radius: 2px;
  font-family: 'Share Tech Mono', monospace; letter-spacing: 1px; text-transform: uppercase;
  box-shadow: 0 0 10px rgba(0,217,255,0.12); transition: all 0.15s ease;
}
.stButton > button:hover, .stDownloadButton > button:hover {
  background: rgba(0,217,255,0.18); box-shadow: 0 0 18px rgba(0,217,255,0.45);
  color: #ffffff; border-color: var(--cy);
}
.stButton > button[kind="primary"],
[data-testid="stBaseButton-primary"], [data-testid="baseButton-primary"] {
  background: rgba(255,167,38,0.10); color: var(--amber);
  border-color: rgba(255,167,38,0.6); box-shadow: 0 0 10px rgba(255,167,38,0.15);
}
.stButton > button[kind="primary"]:hover,
[data-testid="stBaseButton-primary"]:hover, [data-testid="baseButton-primary"]:hover {
  background: rgba(255,167,38,0.22); box-shadow: 0 0 18px rgba(255,167,38,0.5);
  color: #ffffff; border-color: var(--amber);
}

/* Formularios y contenedores con borde -> paneles HUD */
[data-testid="stForm"],
[data-testid="stVerticalBlockBorderWrapper"] {
  background: linear-gradient(135deg, rgba(0,217,255,0.04), rgba(0,217,255,0.01));
  border: 1px solid rgba(0,217,255,0.22) !important; border-radius: 2px;
  box-shadow: 0 0 16px rgba(0,217,255,0.07);
}

.form-title {
  font-family: 'Orbitron', monospace; color: var(--cy);
  letter-spacing: 2px; font-size: 0.95rem; margin-bottom: 6px;
  text-shadow: 0 0 8px rgba(0,217,255,0.4);
}

/* Divisores */
hr { border-color: rgba(0,217,255,0.2) !important; }

/* Chat IA */
[data-testid="stChatMessage"] {
  background: rgba(0,217,255,0.03); border: 1px solid rgba(0,217,255,0.12);
  border-radius: 2px;
}

/* Tarjeta de Training Status */
.ts-card {
  position: relative;
  background: linear-gradient(135deg, rgba(0,217,255,0.05), rgba(0,217,255,0.01));
  border: 1px solid rgba(0,217,255,0.3); border-radius: 2px;
  padding: 16px 20px; margin-bottom: 12px;
}
.ts-card::before, .ts-card::after {
  content: ""; position: absolute; width: 14px; height: 14px; border: 2px solid var(--cy);
}
.ts-card::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.ts-card::after  { bottom: -1px; right: -1px; border-left: none; border-top: none; }
.ts-label {
  font-family: 'Share Tech Mono', monospace; letter-spacing: 2px;
  color: #6fa8c7; text-transform: uppercase; font-size: 0.72rem;
}
.ts-value {
  font-family: 'Orbitron', monospace; font-weight: 700; font-size: 2rem;
  letter-spacing: 2px; margin: 2px 0;
}
.ts-meta {
  font-family: 'Share Tech Mono', monospace; letter-spacing: 1px;
  color: #6fa8c7; font-size: 0.8rem;
}
</style>
"""


# ---------------------------------------------------------------------------
# Gráficos (tema Plotly oscuro / HUD)
# ---------------------------------------------------------------------------

def base_layout(fig, title, y_title):
    fig.update_layout(
        template="plotly_dark",
        title=dict(
            text=title.upper(),
            font=dict(color=CY, size=15, family="Share Tech Mono, monospace"),
        ),
        margin=dict(l=10, r=10, t=50, b=10),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TXT, family="Share Tech Mono, monospace"),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0e1a", bordercolor=CY,
            font=dict(color="#cfe9ff", family="Share Tech Mono, monospace"),
        ),
        xaxis=dict(
            showgrid=False, linecolor=AXIS_LINE, zeroline=False,
            tickfont=dict(color=TXT),
        ),
        yaxis=dict(
            title=y_title, gridcolor=GRID, linecolor=AXIS_LINE,
            zerolinecolor=AXIS_LINE, tickfont=dict(color=TXT),
        ),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0,
            font=dict(color=TXT),
        ),
    )
    return fig


@st.cache_data(ttl=30)
def load_data():
    conn = sqlite3.connect(DB_PATH)
    garmin = pd.read_sql_query(
        "SELECT * FROM garmin_metrics ORDER BY fecha", conn, parse_dates=["fecha"]
    )
    manual = pd.read_sql_query(
        "SELECT * FROM tracker_manual ORDER BY fecha", conn, parse_dates=["fecha"]
    )
    try:
        detalle = pd.read_sql_query(
            "SELECT * FROM actividades_detalle ORDER BY fecha DESC",
            conn,
            parse_dates=["fecha"],
        )
    except Exception:
        # Tabla todavía no existe: corre garmin_sync.py de nuevo para crearla.
        detalle = pd.DataFrame(columns=COLS_DETALLE_ACTIVIDAD)
    conn.close()
    return garmin, manual, detalle


def guardar_peso(fecha, peso_manual):
    """Registra SOLO el peso manual de una fecha. Si ya había una dosis/zona/
    notas en esa fecha, no se tocan (solo se actualiza la columna peso_manual)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO tracker_manual (fecha, peso_manual)
        VALUES (?, ?)
        ON CONFLICT(fecha) DO UPDATE SET peso_manual=excluded.peso_manual
        """,
        (fecha.isoformat(), peso_manual),
    )
    conn.commit()
    conn.close()


def guardar_inyeccion(fecha, dosis_mg, zona_inyeccion, notas):
    """Registra SOLO la inyección (dosis/zona/notas) de una fecha. Si ya había
    un peso_manual en esa fecha, no se toca."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO tracker_manual (fecha, dosis_mg, zona_inyeccion, notas)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(fecha) DO UPDATE SET
            dosis_mg=excluded.dosis_mg,
            zona_inyeccion=excluded.zona_inyeccion,
            notas=excluded.notas
        """,
        (fecha.isoformat(), dosis_mg, zona_inyeccion, notas),
    )
    conn.commit()
    conn.close()


def ensure_meta_table():
    """Crea la tabla meta_peso si no existe (fila única, id=1). No requiere
    correr garmin_sync.py -- es puramente del dashboard."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta_peso (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            peso_objetivo REAL,
            ritmo_objetivo_semanal REAL,
            peso_inicial REAL,
            fecha_inicio TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def cargar_meta():
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT peso_objetivo, ritmo_objetivo_semanal, peso_inicial, fecha_inicio "
        "FROM meta_peso WHERE id = 1"
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "peso_objetivo": row[0],
        "ritmo_objetivo_semanal": row[1],
        "peso_inicial": row[2],
        "fecha_inicio": row[3],
    }


def guardar_meta(peso_objetivo, ritmo_objetivo_semanal, peso_inicial, fecha_inicio):
    """Guarda/edita la meta. Editable las veces que quiera (upsert de la fila id=1)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO meta_peso (id, peso_objetivo, ritmo_objetivo_semanal, peso_inicial, fecha_inicio)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            peso_objetivo=excluded.peso_objetivo,
            ritmo_objetivo_semanal=excluded.ritmo_objetivo_semanal,
            peso_inicial=excluded.peso_inicial,
            fecha_inicio=excluded.fecha_inicio
        """,
        (peso_objetivo, ritmo_objetivo_semanal, peso_inicial, fecha_inicio),
    )
    conn.commit()
    conn.close()


# Umbrales de la proyección de meta (ver resumen final para la justificación):
HORIZONTE_TENDENCIA_DIAS = 21  # horizonte efectivo aprox. del filtro de Kalman (solo para textos de la UI)
UMBRAL_EN_LINEA_ABS = 0.15    # kg/semana de tolerancia absoluta para "en línea"
UMBRAL_EN_LINEA_REL = 0.25    # +/-25% del ritmo objetivo, lo que sea mayor
UMBRAL_AGRESIVO_MULT = 2.0    # más del doble del ritmo objetivo -> alerta de ritmo agresivo

# Parámetros del filtro de Kalman (modelo de "tendencia lineal local": un
# estado de nivel/peso real + un estado de pendiente/ritmo). Es el mismo tipo
# de enfoque que usan apps de referencia para esto -Libra, TrendWeight/Hacker's
# Diet- para separar el peso "real" del ruido diario (agua, sodio, comida,
# glucógeno) sin el corte abrupto de una ventana fija: cada lectura se pesa
# según la incertidumbre acumulada, así que el ritmo se adapta solo a cambios
# reales sin sobrerreaccionar a un mal día de la báscula.
KALMAN_R_OBS = 0.35        # kg^2: varianza del ruido de medición (~0.6 kg de desviación estándar)
KALMAN_Q_TENDENCIA = 2e-5  # (kg/día)^2 por día: cuánto puede variar el ritmo real de un día a otro


def calcular_ritmo_real(peso_df, r_obs=KALMAN_R_OBS, q_tendencia=KALMAN_Q_TENDENCIA):
    """Filtro de Kalman de tendencia lineal local sobre todo el historial de
    peso disponible: en cada paso predice nivel+pendiente, y los corrige con
    la ganancia de Kalman al llegar la siguiente lectura. Sin ventana fija:
    la influencia de una lectura antigua se desvanece sola en vez de caerse
    de golpe al salir de los últimos N días.

    Devuelve (kg_por_semana, num_puntos_usados, serie_suavizada), donde
    serie_suavizada es un DataFrame fecha/nivel con el peso "real" estimado
    día a día (para dibujar la línea de tendencia). kg_por_semana y
    serie_suavizada son None si hay menos de 3 lecturas."""
    if peso_df is None or peso_df.empty:
        return None, 0, None
    df = peso_df.dropna(subset=["peso"]).sort_values("fecha").reset_index(drop=True)
    if len(df) < 3:
        return None, len(df), None

    nivel = float(df["peso"].iloc[0])
    pendiente = 0.0
    P = np.array([[r_obs, 0.0], [0.0, 1.0]])  # covarianza inicial: pendiente muy incierta

    niveles = [nivel]
    for i in range(1, len(df)):
        dt = max((df["fecha"].iloc[i] - df["fecha"].iloc[i - 1]).days, 1)

        # Predicción: el nivel avanza según la pendiente actual; la pendiente
        # en sí hace un "paseo aleatorio" (puede cambiar de un día a otro).
        F = np.array([[1.0, dt], [0.0, 1.0]])
        Q = np.array([[0.0, 0.0], [0.0, q_tendencia * dt]])
        nivel_pred = nivel + pendiente * dt
        P_pred = F @ P @ F.T + Q

        # Corrección con la lectura real (ganancia de Kalman).
        innovacion = float(df["peso"].iloc[i]) - nivel_pred
        S = P_pred[0, 0] + r_obs
        K = P_pred[:, 0] / S

        nivel = nivel_pred + K[0] * innovacion
        pendiente = pendiente + K[1] * innovacion
        P = P_pred - np.outer(K, P_pred[0, :])

        niveles.append(nivel)

    serie_suavizada = pd.DataFrame({"fecha": df["fecha"], "nivel": niveles})
    return float(pendiente * 7), len(df), serie_suavizada


ESTADO_META_INFO = {
    "adelantado": ("ADELANTADO", NEON_GREEN),
    "en_linea": ("EN LÍNEA", CY),
    "atrasado": ("ATRASADO", AMBER),
    "agresivo": ("RITMO AGRESIVO", AMBER),
    "estancado": ("ESTANCADO", AMBER),
    "direccion_contraria": ("ALEJÁNDOSE DE LA META", "#ff6b6b"),
    "en_meta": ("¡META ALCANZADA!", NEON_GREEN),
    "sin_datos": ("DATOS INSUFICIENTES", TXT),
}


def evaluar_progreso_meta(peso_actual, meta, ritmo_real_semanal):
    """Evalúa peso actual vs meta, compara ritmo real vs objetivo y proyecta
    la fecha estimada de meta. Devuelve un dict, o None si no hay meta
    configurada o no hay peso actual."""
    if not meta or peso_actual is None or meta.get("peso_objetivo") is None:
        return None

    peso_objetivo = float(meta["peso_objetivo"])
    peso_inicial = float(meta.get("peso_inicial") or peso_actual)
    ritmo_objetivo_mag = abs(float(meta.get("ritmo_objetivo_semanal") or 0))

    diferencia = peso_actual - peso_objetivo  # >0: falta bajar, <0: falta subir
    if peso_objetivo < peso_inicial:
        direccion = -1
    elif peso_objetivo > peso_inicial:
        direccion = 1
    else:
        direccion = 0
    ritmo_objetivo_signed = direccion * ritmo_objetivo_mag

    # Progreso real "hacia la meta": positivo = acercándose, negativo = alejándose.
    ritmo_hacia_meta = None
    if ritmo_real_semanal is not None and direccion != 0:
        ritmo_hacia_meta = ritmo_real_semanal * direccion

    estado = "sin_datos"
    fecha_estimada = None
    semanas_restantes = None

    if abs(diferencia) <= 0.05:
        estado = "en_meta"
    elif ritmo_hacia_meta is not None and ritmo_objetivo_mag > 0:
        banda = max(UMBRAL_EN_LINEA_ABS, UMBRAL_EN_LINEA_REL * ritmo_objetivo_mag)
        if ritmo_hacia_meta <= 0.02:
            estado = "estancado" if ritmo_hacia_meta > -0.02 else "direccion_contraria"
        elif ritmo_hacia_meta > UMBRAL_AGRESIVO_MULT * ritmo_objetivo_mag:
            estado = "agresivo"
        elif ritmo_hacia_meta >= ritmo_objetivo_mag + banda:
            estado = "adelantado"
        elif ritmo_hacia_meta <= ritmo_objetivo_mag - banda:
            estado = "atrasado"
        else:
            estado = "en_linea"

        if ritmo_hacia_meta > 0.02:
            semanas_restantes = abs(diferencia) / ritmo_hacia_meta
            fecha_estimada = pd.Timestamp.today().normalize() + pd.Timedelta(weeks=semanas_restantes)

    return {
        "peso_actual": peso_actual,
        "peso_objetivo": peso_objetivo,
        "peso_inicial": peso_inicial,
        "diferencia": diferencia,
        "direccion": direccion,
        "ritmo_objetivo_signed": ritmo_objetivo_signed,
        "ritmo_objetivo_mag": ritmo_objetivo_mag,
        "ritmo_real_semanal": ritmo_real_semanal,
        "ritmo_hacia_meta": ritmo_hacia_meta,
        "fecha_estimada": fecha_estimada,
        "semanas_restantes": semanas_restantes,
        "estado": estado,
    }


def build_weight_df(garmin, manual):
    peso = pd.merge(
        garmin[["fecha", "peso_kg"]],
        manual[["fecha", "peso_manual"]],
        on="fecha",
        how="outer",
    ).sort_values("fecha")
    peso["peso"] = peso["peso_manual"].combine_first(peso["peso_kg"])
    peso["fuente"] = peso.apply(
        lambda r: "manual" if pd.notnull(r["peso_manual"]) else "garmin", axis=1
    )
    return peso.dropna(subset=["peso"])


def weight_chart(garmin, manual, meta=None, ritmo_real_semanal=None, serie_tendencia=None):
    peso_df = build_weight_df(garmin, manual)
    fig = go.Figure()

    if not peso_df.empty:
        fig.add_trace(
            go.Scatter(
                x=peso_df["fecha"],
                y=peso_df["peso"],
                mode="lines+markers",
                name="Peso (kg)",
                line=dict(color=COLOR_PESO, width=1, dash="dot"),
                opacity=0.55,
                marker=dict(
                    size=6,
                    symbol=peso_df["fuente"].map(
                        {"manual": "diamond", "garmin": "circle"}
                    ),
                ),
                customdata=peso_df["fuente"],
                hovertemplate="%{x|%Y-%m-%d}<br>Peso: %{y:.1f} kg (%{customdata})<extra></extra>",
            )
        )

    if serie_tendencia is not None and not serie_tendencia.empty:
        fig.add_trace(
            go.Scatter(
                x=serie_tendencia["fecha"],
                y=serie_tendencia["nivel"],
                mode="lines",
                name="Tendencia (Kalman)",
                line=dict(color=COLOR_PESO, width=3),
                hovertemplate="%{x|%Y-%m-%d}<br>Tendencia: %{y:.1f} kg<extra></extra>",
            )
        )

    dosis_df = manual.dropna(subset=["dosis_mg"])
    if not dosis_df.empty and not peso_df.empty:
        dosis_merged = pd.merge_asof(
            dosis_df.sort_values("fecha"),
            peso_df[["fecha", "peso"]].sort_values("fecha"),
            on="fecha",
            direction="nearest",
        )
        fig.add_trace(
            go.Scatter(
                x=dosis_merged["fecha"],
                y=dosis_merged["peso"],
                mode="markers",
                name="Dosis registrada",
                marker=dict(color=COLOR_DOSIS, size=12, symbol="triangle-up"),
                customdata=dosis_merged["dosis_mg"],
                hovertemplate="%{x|%Y-%m-%d}<br>Dosis: %{customdata} mg<extra></extra>",
            )
        )
        for d in dosis_merged["fecha"]:
            fig.add_vline(
                x=d, line_width=1, line_dash="dash",
                line_color="rgba(0,217,255,0.25)",
            )

    if meta and meta.get("peso_objetivo") is not None and not peso_df.empty:
        objetivo = float(meta["peso_objetivo"])
        fig.add_hline(
            y=objetivo, line_width=1.5, line_dash="dash", line_color=AMBER,
            annotation_text=f"Meta: {objetivo:.1f} kg", annotation_font_color=AMBER,
            annotation_position="top left",
        )

        ultima_fecha = peso_df["fecha"].max()
        if serie_tendencia is not None and not serie_tendencia.empty:
            # Arranca la proyección desde el nivel suavizado (Kalman), no del
            # último peso crudo, para que no "salte" al empalmar con su pendiente.
            ultimo_peso = float(serie_tendencia["nivel"].iloc[-1])
        else:
            ultimo_peso = float(peso_df.loc[peso_df["fecha"] == ultima_fecha, "peso"].iloc[0])

        # Línea de proyección: extiende el ritmo real hasta cruzar la meta
        # (tope de 365 días para no distorsionar el eje si el ritmo es casi plano).
        if ritmo_real_semanal is not None and abs(ritmo_real_semanal) > 0.02:
            pendiente_dia = ritmo_real_semanal / 7
            dias_a_meta = (objetivo - ultimo_peso) / pendiente_dia
            dias_a_meta = min(max(dias_a_meta, 0), 365)
            fecha_fin = ultima_fecha + pd.Timedelta(days=dias_a_meta)
            peso_fin = ultimo_peso + pendiente_dia * dias_a_meta
            fig.add_trace(
                go.Scatter(
                    x=[ultima_fecha, fecha_fin], y=[ultimo_peso, peso_fin],
                    mode="lines", name="Proyección (ritmo real)",
                    line=dict(color=NEON_GREEN, width=1.5, dash="dot"),
                    hovertemplate="%{x|%Y-%m-%d}<br>Proyección: %{y:.1f} kg<extra></extra>",
                )
            )

        # Línea de ritmo objetivo ideal, desde el peso/fecha inicial (tope 2 años).
        peso_inicial = meta.get("peso_inicial")
        fecha_inicio = meta.get("fecha_inicio")
        ritmo_obj_mag = abs(meta.get("ritmo_objetivo_semanal") or 0)
        if peso_inicial and fecha_inicio and ritmo_obj_mag > 0:
            fecha_inicio_ts = pd.Timestamp(fecha_inicio)
            direccion = -1 if objetivo < peso_inicial else (1 if objetivo > peso_inicial else 0)
            if direccion != 0:
                pendiente_ideal_dia = direccion * ritmo_obj_mag / 7
                dias_ideal = (objetivo - float(peso_inicial)) / pendiente_ideal_dia
                dias_ideal = min(max(dias_ideal, 0), 730)
                fecha_ideal_fin = fecha_inicio_ts + pd.Timedelta(days=dias_ideal)
                fig.add_trace(
                    go.Scatter(
                        x=[fecha_inicio_ts, fecha_ideal_fin], y=[float(peso_inicial), objetivo],
                        mode="lines", name="Ritmo objetivo ideal",
                        line=dict(color=AMBER, width=1.2, dash="dashdot"),
                        hovertemplate="%{x|%Y-%m-%d}<br>Ideal: %{y:.1f} kg<extra></extra>",
                    )
                )

    return base_layout(fig, "Peso en el tiempo", "kg")


def bar_chart(df, x_col, y_col, title, y_title, color):
    fig = go.Figure(
        go.Bar(
            x=df[x_col],
            y=df[y_col],
            marker=dict(color=color),
            hovertemplate="%{x|%Y-%m-%d}<br>%{y}<extra></extra>",
        )
    )
    return base_layout(fig, title, y_title)


def line_chart(df, x_col, y_col, title, y_title, color):
    fig = go.Figure(
        go.Scatter(
            x=df[x_col],
            y=df[y_col],
            mode="lines+markers",
            line=dict(color=color, width=2),
            marker=dict(size=6),
            hovertemplate="%{x|%Y-%m-%d}<br>%{y}<extra></extra>",
        )
    )
    return base_layout(fig, title, y_title)


def body_battery_chart(garmin):
    df = garmin.dropna(subset=["body_battery_max", "body_battery_min"], how="all")
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=df["fecha"],
            y=df["body_battery_max"],
            mode="lines+markers",
            name="Máximo",
            line=dict(color=COLOR_BODY_BATTERY_MAX, width=2),
            marker=dict(size=6),
            hovertemplate="%{x|%Y-%m-%d}<br>Máx: %{y}<extra></extra>",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=df["fecha"],
            y=df["body_battery_min"],
            mode="lines+markers",
            name="Mínimo",
            line=dict(color=COLOR_BODY_BATTERY_MIN, width=2),
            marker=dict(size=6),
            hovertemplate="%{x|%Y-%m-%d}<br>Mín: %{y}<extra></extra>",
        )
    )
    return base_layout(fig, "Body Battery (máximo / mínimo diario)", "nivel (0-100)")


def metabolism_chart(garmin):
    """Barras apiladas de calorías activas + reposo (BMR), con línea del total quemado."""
    df = garmin.dropna(subset=["calorias_activas", "calorias_reposo"], how="all").copy()
    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=df["fecha"], y=df["calorias_reposo"], name="Reposo (BMR)",
            marker=dict(color=COLOR_CAL_REPOSO),
            hovertemplate="%{x|%Y-%m-%d}<br>BMR: %{y} kcal<extra></extra>",
        )
    )
    fig.add_trace(
        go.Bar(
            x=df["fecha"], y=df["calorias_activas"], name="Activas",
            marker=dict(color=COLOR_CAL_ACTIVAS),
            hovertemplate="%{x|%Y-%m-%d}<br>Activas: %{y} kcal<extra></extra>",
        )
    )
    total = df["calorias_activas"].fillna(0) + df["calorias_reposo"].fillna(0)
    fig.add_trace(
        go.Scatter(
            x=df["fecha"], y=total, name="Total quemado", mode="lines",
            line=dict(color=COLOR_TOTAL, width=2, dash="dot"),
            hovertemplate="%{x|%Y-%m-%d}<br>Total: %{y} kcal<extra></extra>",
        )
    )
    fig.update_layout(barmode="stack")
    return base_layout(fig, "Metabolismo: calorías activas vs reposo", "kcal")


def sleep_composition_chart(garmin):
    """Barras apiladas de las fases del sueño (profundo + REM + ligero)."""
    df = garmin.dropna(
        subset=["sueno_profundo_h", "sueno_rem_h", "sueno_ligero_h"], how="all"
    ).copy()
    fig = go.Figure()
    for col, nombre, color in (
        ("sueno_profundo_h", "Profundo", COLOR_SUENO_PROFUNDO),
        ("sueno_rem_h", "REM", COLOR_SUENO_REM),
        ("sueno_ligero_h", "Ligero", COLOR_SUENO_LIGERO),
    ):
        fig.add_trace(
            go.Bar(
                x=df["fecha"], y=df[col], name=nombre, marker=dict(color=color),
                hovertemplate="%{x|%Y-%m-%d}<br>" + nombre + ": %{y:.1f} h<extra></extra>",
            )
        )
    fig.update_layout(barmode="stack")
    return base_layout(fig, "Composición del sueño por fase", "horas")


def hr_zone_chart(fila):
    """Barras horizontales con el tiempo en cada zona de FC de una actividad."""
    zonas = [fila.get(f"fc_zona{i}_min") for i in range(1, 6)]
    etiquetas = [f"Zona {i}" for i in range(1, 6)]
    fig = go.Figure(
        go.Bar(
            x=zonas, y=etiquetas, orientation="h",
            marker=dict(color=COLOR_ZONAS_FC),
            hovertemplate="%{y}: %{x:.1f} min<extra></extra>",
        )
    )
    return base_layout(fig, "Tiempo en zonas de FC", "minutos")


def render_activity_detail(fila):
    """Panel HUD con el detalle completo de una actividad: FC, zonas,
    calorías/duración y métricas específicas del deporte (distancia/ritmo
    o series/repeticiones)."""
    nombre = fila.get("nombre") or fila.get("tipo_actividad")
    st.markdown(
        f"**{nombre}** &nbsp;·&nbsp; {fila['fecha'].date()} "
        f"&nbsp;·&nbsp; `{fila.get('tipo_actividad')}`"
    )

    d1, d2, d3, d4 = st.columns(4)
    with d1:
        st.metric(
            "FC promedio",
            f"{int(fila['fc_promedio'])} lpm" if pd.notnull(fila.get("fc_promedio")) else "—",
        )
    with d2:
        st.metric(
            "FC máxima",
            f"{int(fila['fc_maxima'])} lpm" if pd.notnull(fila.get("fc_maxima")) else "—",
        )
    with d3:
        st.metric(
            "Calorías",
            f"{int(fila['calorias'])} kcal" if pd.notnull(fila.get("calorias")) else "—",
        )
    with d4:
        st.metric(
            "Duración",
            f"{fila['duracion_min']:.0f} min" if pd.notnull(fila.get("duracion_min")) else "—",
        )

    hay_zonas = any(pd.notnull(fila.get(f"fc_zona{i}_min")) for i in range(1, 6))
    if hay_zonas:
        st.plotly_chart(hr_zone_chart(fila), use_container_width=True)
    else:
        st.caption("Sin datos de zonas de FC para esta actividad.")

    if pd.notnull(fila.get("distancia_km")) and fila["distancia_km"] > 0:
        e1, e2 = st.columns(2)
        with e1:
            st.metric("Distancia", f"{fila['distancia_km']:.2f} km")
        with e2:
            st.metric(
                "Ritmo",
                f"{fila['ritmo_min_km']:.2f} min/km" if pd.notnull(fila.get("ritmo_min_km")) else "—",
            )

    if pd.notnull(fila.get("series_totales")):
        reps = int(fila["repeticiones_totales"]) if pd.notnull(fila.get("repeticiones_totales")) else "—"
        st.caption(
            f"🏋️ Series: {int(fila['series_totales'])} · Repeticiones: {reps} · "
            f"Principales ejercicios: {fila.get('ejercicios_detectados') or '—'}"
        )

    if pd.notnull(fila.get("carga_entrenamiento")) or pd.notnull(fila.get("efecto_aerobico")):
        carga = fila.get("carga_entrenamiento")
        aerob = fila.get("efecto_aerobico")
        anaerob = fila.get("efecto_anaerobico")
        st.caption(
            f"Carga de entrenamiento: {carga if pd.notnull(carga) else '—'} · "
            f"Efecto aeróbico: {aerob if pd.notnull(aerob) else '—'} · "
            f"Efecto anaeróbico: {anaerob if pd.notnull(anaerob) else '—'}"
        )


def build_excel_export(garmin, manual):
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        garmin.to_excel(writer, sheet_name="garmin_metrics", index=False)
        manual.to_excel(writer, sheet_name="tracker_manual", index=False)
    buffer.seek(0)
    return buffer


# Wrappers cacheados: los .xlsx solo se regeneran cuando cambian los datos
# (o cada 30 s), no en cada interacción con la página.
@st.cache_data(ttl=30)
def reporte_diario_bytes(garmin, manual):
    buf, _fecha = reportes.build_daily_report(garmin, manual)
    return buf.getvalue()


@st.cache_data(ttl=30)
def reporte_semanal_bytes(garmin, manual):
    return reportes.build_weekly_report(garmin, manual).getvalue()


@st.cache_data(ttl=30)
def reporte_maestro_bytes(garmin, manual):
    return reportes.build_master(garmin, manual).getvalue()


def run_garmin_sync():
    """Corre garmin_sync.py como subproceso. Le pasamos explícitamente las
    credenciales desde get_secret() -- en Streamlit Community Cloud no existe
    un .env, así que garmin_sync.py (que solo sabe leer variables de entorno)
    necesita recibirlas por env=... en vez de encontrarlas solo."""
    env = os.environ.copy()
    for nombre in (
        "GARMIN_EMAIL", "GARMIN_PASSWORD",
        "GARMIN_VAULT_TOKEN", "GARMIN_VAULT_REPO",
    ):
        valor = get_secret(nombre)
        if valor:
            env[nombre] = valor

    result = subprocess.run(
        [sys.executable, SYNC_SCRIPT],
        cwd=SCRIPT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
        env=env,
    )
    return result


def ultimo_previo(df, col):
    """Devuelve (último valor no nulo, valor anterior, fecha del último)."""
    s = df.dropna(subset=[col]).sort_values("fecha")
    if s.empty:
        return None, None, None
    last = s.iloc[-1][col]
    prev = s.iloc[-2][col] if len(s) >= 2 else None
    fecha = s.iloc[-1]["fecha"]
    return last, prev, fecha


def ultimo_texto(df, col):
    """Devuelve (último texto no nulo, fecha) de una columna de texto."""
    s = df.dropna(subset=[col]).sort_values("fecha")
    if s.empty:
        return None, None
    return s.iloc[-1][col], s.iloc[-1]["fecha"]


def build_context_summary(garmin, manual):
    lines = [
        f"Últimos {DIAS_CONTEXTO_IA} días de métricas (Garmin):",
        "fecha | peso_kg | pasos | horas_sueno | fc_reposo",
    ]
    recientes = garmin.sort_values("fecha").tail(DIAS_CONTEXTO_IA)
    for _, row in recientes.iterrows():
        lines.append(
            f"{row['fecha'].date()} | "
            f"{row['peso_kg'] if pd.notnull(row['peso_kg']) else '-'} | "
            f"{int(row['pasos']) if pd.notnull(row['pasos']) else '-'} | "
            f"{row['horas_sueno'] if pd.notnull(row['horas_sueno']) else '-'} | "
            f"{int(row['fc_reposo']) if pd.notnull(row['fc_reposo']) else '-'}"
        )

    lines.append("")
    lines.append("Historial completo del tracker manual (dosis, peso manual, notas):")
    if manual.empty:
        lines.append("(sin registros)")
    else:
        lines.append("fecha | dosis_mg | zona_inyeccion | peso_manual | notas")
        for _, row in manual.sort_values("fecha").iterrows():
            lines.append(
                f"{row['fecha'].date()} | "
                f"{row['dosis_mg'] if pd.notnull(row['dosis_mg']) else '-'} | "
                f"{row['zona_inyeccion'] or '-'} | "
                f"{row['peso_manual'] if pd.notnull(row['peso_manual']) else '-'} | "
                f"{row['notas'] or '-'}"
            )

    return "\n".join(lines)


def preguntar_ia(garmin, manual, historial_mensajes):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    contexto = build_context_summary(garmin, manual)
    system_prompt = (
        "Eres un asistente que ayuda a una persona a interpretar sus propios datos "
        "personales de salud (Garmin y un registro manual de dosis/inyecciones). "
        "Responde en español, de forma breve y clara, basándote únicamente en los "
        "datos que se te dan a continuación. Si algo no está en los datos, dilo "
        "explícitamente en vez de inventarlo.\n\n" + contexto
    )
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=historial_mensajes,
        thinking={"type": "disabled"},
        output_config={"effort": "low"},
    )
    return next((b.text for b in response.content if b.type == "text"), "")


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

st.markdown(HUD_CSS, unsafe_allow_html=True)


def check_password():
    """Si DASHBOARD_PASSWORD está configurada (secrets/.env), exige login
    antes de mostrar nada. Si no está configurada (uso local en tu red),
    no bloquea nada -- se mantiene el comportamiento de siempre."""
    if not DASHBOARD_PASSWORD:
        return True
    if st.session_state.get("autenticado"):
        return True

    st.markdown(
        """
        <div class="hud-header" style="justify-content:center; text-align:center;">
          <div>
            <div class="hud-title">HEALTH MONITORING SYSTEM</div>
            <div class="hud-sub">ACCESO RESTRINGIDO // INGRESA TU CLAVE</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    _c1, c2, _c3 = st.columns([1, 2, 1])
    with c2:
        with st.form("form_login"):
            clave = st.text_input("Contraseña", type="password")
            if st.form_submit_button("ACCEDER", type="primary"):
                if clave == DASHBOARD_PASSWORD:
                    st.session_state["autenticado"] = True
                    st.rerun()
                else:
                    st.error("Contraseña incorrecta.")
    return False


if not check_password():
    st.stop()

ahora = datetime.now()
st.markdown(
    f"""
    <div class="hud-header">
      <div class="hud-header-left">
        <div class="hud-title">HEALTH MONITORING SYSTEM</div>
        <div class="hud-sub">PANEL PERSONAL DE SALUD // ENLACE GARMIN</div>
      </div>
      <div class="hud-header-right">
        <div class="hud-clock">{ahora.strftime('%Y-%m-%d')} · {ahora.strftime('%H:%M:%S')}</div>
        <div class="hud-status"><span class="status-dot"></span>SISTEMA ACTIVO</div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

if not os.path.exists(DB_PATH):
    st.warning(
        "No se encontró datos.db. Corre `python garmin_sync.py` al menos una vez, "
        "o sincroniza ahora."
    )
    if st.button("SINCRONIZAR AHORA", type="primary"):
        with st.spinner("Descargando datos de Garmin Connect..."):
            result = run_garmin_sync()
        if result.returncode == 0:
            st.session_state["last_sync_log"] = result.stdout
            st.cache_data.clear()
            st.toast("Datos actualizados.", icon="✅")
            st.rerun()
        else:
            st.error("Falló la sincronización.")
            st.code(result.stdout + "\n" + result.stderr)
    st.stop()

ensure_meta_table()
garmin, manual, detalle = load_data()

# --- Indicadores HUD del día ---
peso_df = build_weight_df(garmin, manual)
if not peso_df.empty:
    peso_last = peso_df.iloc[-1]["peso"]
    peso_prev = peso_df.iloc[-2]["peso"] if len(peso_df) >= 2 else None
    peso_fecha = peso_df.iloc[-1]["fecha"]
else:
    peso_last = peso_prev = peso_fecha = None

# --- Meta de peso: ritmo real (regresión suavizada) y proyección ---
meta_actual = cargar_meta()
ritmo_real_semanal, ritmo_real_puntos, serie_tendencia_peso = calcular_ritmo_real(peso_df)
progreso_meta = evaluar_progreso_meta(peso_last, meta_actual, ritmo_real_semanal)

pasos_last, pasos_prev, pasos_fecha = ultimo_previo(garmin, "pasos")
sueno_last, sueno_prev, sueno_fecha = ultimo_previo(garmin, "horas_sueno")
hrv_last, hrv_prev, hrv_fecha = ultimo_previo(garmin, "hrv_ms")
tr_last, tr_prev, tr_fecha = ultimo_previo(garmin, "training_readiness")

m1, m2, m3, m4, m5 = st.columns(5)
with m1:
    st.metric(
        "Peso",
        f"{peso_last:.1f} kg" if peso_last is not None else "—",
        delta=(f"{peso_last - peso_prev:+.1f} kg" if peso_last is not None and peso_prev is not None else None),
        delta_color="off",
        help=(f"Último registro: {peso_fecha.date()}" if peso_fecha is not None else None),
    )
with m2:
    st.metric(
        "Pasos",
        f"{int(pasos_last):,}" if pasos_last is not None else "—",
        delta=(f"{int(pasos_last - pasos_prev):+,}" if pasos_last is not None and pasos_prev is not None else None),
        help=(f"Último registro: {pasos_fecha.date()}" if pasos_fecha is not None else None),
    )
with m3:
    st.metric(
        "Sueño",
        f"{sueno_last:.1f} h" if sueno_last is not None else "—",
        delta=(f"{sueno_last - sueno_prev:+.1f} h" if sueno_last is not None and sueno_prev is not None else None),
        help=(f"Último registro: {sueno_fecha.date()}" if sueno_fecha is not None else None),
    )
with m4:
    st.metric(
        "HRV",
        f"{int(hrv_last)} ms" if hrv_last is not None else "—",
        delta=(f"{int(hrv_last - hrv_prev):+} ms" if hrv_last is not None and hrv_prev is not None else None),
        help=(f"Último registro: {hrv_fecha.date()}" if hrv_fecha is not None else None),
    )
with m5:
    st.metric(
        "Readiness",
        f"{int(tr_last)}/100" if tr_last is not None else "—",
        delta=(f"{int(tr_last - tr_prev):+}" if tr_last is not None and tr_prev is not None else None),
        help=(f"Último registro: {tr_fecha.date()}" if tr_fecha is not None else None),
    )

# --- Barra de control ---
b1, b2, _ = st.columns([1, 1, 3])
with b1:
    if st.button("ACTUALIZAR GARMIN", type="primary"):
        with st.spinner("Descargando datos de Garmin Connect..."):
            result = run_garmin_sync()
        if result.returncode == 0:
            st.session_state["last_sync_log"] = result.stdout
            st.cache_data.clear()
            st.toast("Datos actualizados.", icon="✅")
            st.rerun()
        else:
            st.error("Falló la actualización. Revisa el detalle abajo.")
            with st.expander("Detalle del error", expanded=True):
                st.code(result.stdout + "\n" + result.stderr)
with b2:
    st.download_button(
        "DESCARGAR DATOS",
        data=build_excel_export(garmin, manual),
        file_name="mis_datos_salud.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

if "last_sync_log" in st.session_state:
    with st.expander("Detalle de la última sincronización"):
        st.code(st.session_state["last_sync_log"] or "(sin salida)")

st.divider()

with st.container(border=True):
    st.subheader("Exportaciones para análisis con IA")
    st.caption(
        "Archivos .xlsx estructurados (hojas separadas, encabezados claros, fechas ISO, "
        "una fila por día) para subir a tu Proyecto de Claude como base de conocimiento."
    )
    fref = reportes.fecha_referencia(garmin).strftime("%Y-%m-%d")
    x1, x2, x3 = st.columns(3)
    with x1:
        st.download_button(
            "Exportar Reporte Diario a Excel",
            data=reporte_diario_bytes(garmin, manual),
            file_name=f"reporte_diario_{fref}.xlsx",
            mime=reportes.XLSX_MIME,
            help="RESUMEN_HOY, ANOMALIAS_HOY, EVENTOS_RECIENTES (7 días).",
        )
    with x2:
        st.download_button(
            "Exportar Reporte Semanal a Excel",
            data=reporte_semanal_bytes(garmin, manual),
            file_name=f"reporte_semanal_{fref}.xlsx",
            mime=reportes.XLSX_MIME,
            help="Datos diarios (30d), comparativa, promedios móviles, ventana dosis, eventos, carga.",
        )
    with x3:
        if st.button("Actualizar Excel Maestro"):
            with open(MASTER_PATH, "wb") as f:
                f.write(reporte_maestro_bytes(garmin, manual))
            st.session_state["master_saved"] = MASTER_PATH
        st.download_button(
            "Descargar Excel Maestro",
            data=reporte_maestro_bytes(garmin, manual),
            file_name="historial_salud_maestro.xlsx",
            mime=reportes.XLSX_MIME,
            help="HISTORICO_COMPLETO: todos tus días con todas las métricas.",
        )
    if st.session_state.get("master_saved"):
        st.success(
            f"Excel maestro guardado/actualizado en: {st.session_state['master_saved']}"
        )

with st.container(border=True):
    st.subheader("Peso")
    st.plotly_chart(
        weight_chart(garmin, manual, meta_actual, ritmo_real_semanal, serie_tendencia_peso),
        use_container_width=True,
    )

with st.container(border=True):
    st.subheader("Mi meta de peso")

    with st.expander("Configurar / editar meta", expanded=(meta_actual is None)):
        with st.form("form_meta"):
            mc1, mc2 = st.columns(2)
            with mc1:
                peso_objetivo_input = st.number_input(
                    "Peso objetivo (kg)", min_value=0.0, step=0.5, format="%.1f",
                    value=float(meta_actual["peso_objetivo"]) if meta_actual else 80.0,
                )
            with mc2:
                ritmo_objetivo_input = st.number_input(
                    "Ritmo objetivo (kg/semana, siempre positivo)",
                    min_value=0.0, step=0.05, format="%.2f",
                    value=float(meta_actual["ritmo_objetivo_semanal"]) if meta_actual else 0.5,
                )
            auto_inicio = st.checkbox(
                "Usar mi primer peso registrado como punto de partida",
                value=(meta_actual is None),
            )
            st.caption(
                "Si está marcado, los dos campos de abajo se ignoran al guardar y se usa "
                "automáticamente tu primer peso registrado y su fecha."
            )
            mc3, mc4 = st.columns(2)
            with mc3:
                peso_inicial_default = (
                    float(meta_actual["peso_inicial"])
                    if meta_actual and meta_actual.get("peso_inicial")
                    else 0.0
                )
                peso_inicial_input = st.number_input(
                    "Peso inicial (kg) - opcional", min_value=0.0, step=0.1, format="%.1f",
                    value=peso_inicial_default,
                )
            with mc4:
                fecha_inicio_default = (
                    pd.Timestamp(meta_actual["fecha_inicio"]).date()
                    if meta_actual and meta_actual.get("fecha_inicio")
                    else date.today()
                )
                fecha_inicio_input = st.date_input(
                    "Fecha de inicio - opcional", value=fecha_inicio_default,
                )
            if st.form_submit_button("Guardar meta"):
                if peso_objetivo_input <= 0:
                    st.warning("Ingresa un peso objetivo mayor que 0.")
                else:
                    if auto_inicio or peso_inicial_input <= 0:
                        if not peso_df.empty:
                            peso_inicial_final = float(peso_df.iloc[0]["peso"])
                            fecha_inicio_final = peso_df.iloc[0]["fecha"].date().isoformat()
                        else:
                            peso_inicial_final = None
                            fecha_inicio_final = None
                    else:
                        peso_inicial_final = peso_inicial_input
                        fecha_inicio_final = fecha_inicio_input.isoformat()
                    guardar_meta(
                        peso_objetivo_input, ritmo_objetivo_input,
                        peso_inicial_final, fecha_inicio_final,
                    )
                    st.cache_data.clear()
                    st.toast("Meta guardada.", icon="🎯")
                    st.rerun()

    if meta_actual is None:
        st.info("Todavía no configuraste tu meta de peso. Ábrela arriba para definirla.")
    elif progreso_meta is None:
        st.info("Aún no hay suficiente peso registrado para calcular tu progreso.")
    else:
        etiqueta_estado, color_estado_meta = ESTADO_META_INFO.get(
            progreso_meta["estado"], ("—", TXT)
        )
        if progreso_meta["diferencia"] > 0.05:
            falta_txt = "para bajar"
        elif progreso_meta["diferencia"] < -0.05:
            falta_txt = "para subir"
        else:
            falta_txt = ""

        g1, g2, g3 = st.columns(3)
        with g1:
            st.markdown(
                f"""
                <div class="ts-card">
                  <div class="ts-label">PESO ACTUAL → META</div>
                  <div class="ts-value" style="color:{CY}; text-shadow:0 0 14px {CY}88;">
                    {progreso_meta['peso_actual']:.1f} → {progreso_meta['peso_objetivo']:.1f} kg
                  </div>
                  <div class="ts-meta">Faltan {abs(progreso_meta['diferencia']):.1f} kg {falta_txt}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with g2:
            if progreso_meta["ritmo_real_semanal"] is not None:
                ritmo_txt = (
                    f"{progreso_meta['ritmo_real_semanal']:+.2f} / "
                    f"{progreso_meta['ritmo_objetivo_signed']:+.2f} kg/sem"
                )
            else:
                ritmo_txt = "—"
            st.markdown(
                f"""
                <div class="ts-card" style="border-color:{color_estado_meta}55; box-shadow:0 0 20px {color_estado_meta}22;">
                  <div class="ts-label">RITMO REAL / OBJETIVO</div>
                  <div class="ts-value" style="color:{color_estado_meta}; text-shadow:0 0 14px {color_estado_meta}88;">
                    {ritmo_txt}
                  </div>
                  <div class="ts-meta">{etiqueta_estado} · Kalman · {ritmo_real_puntos} lecturas</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with g3:
            if progreso_meta["fecha_estimada"] is not None:
                fecha_txt2 = progreso_meta["fecha_estimada"].date().isoformat()
                meta_txt2 = f"en ~{progreso_meta['semanas_restantes']:.0f} semanas"
            elif progreso_meta["estado"] == "en_meta":
                fecha_txt2 = "¡LOGRADA!"
                meta_txt2 = "Ya estás en tu peso objetivo"
            else:
                fecha_txt2 = "—"
                meta_txt2 = "Sin proyección posible con el ritmo actual"
            st.markdown(
                f"""
                <div class="ts-card">
                  <div class="ts-label">FECHA ESTIMADA DE META</div>
                  <div class="ts-value" style="color:{color_estado_meta}; text-shadow:0 0 14px {color_estado_meta}88;">
                    {fecha_txt2}
                  </div>
                  <div class="ts-meta">{meta_txt2}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        # Alerta de tendencia de peso (ritmo real desviado del objetivo,
        # calculado con un filtro de Kalman de horizonte efectivo ~3 semanas,
        # no con el peso de un solo día).
        estado_actual_meta = progreso_meta["estado"]
        if estado_actual_meta == "agresivo":
            st.warning(
                f"⚠️ Tu ritmo real ({progreso_meta['ritmo_real_semanal']:+.2f} kg/sem) es "
                f"más del doble de tu objetivo ({progreso_meta['ritmo_objetivo_signed']:+.2f} kg/sem). "
                f"Un cambio de peso muy rápido y sostenido no siempre es saludable ni sostenible "
                f"— considera ajustar el ritmo objetivo o revisarlo con un profesional."
            )
        elif estado_actual_meta == "direccion_contraria":
            st.warning(
                f"⚠️ En las últimas ~{HORIZONTE_TENDENCIA_DIAS} días tu peso se mueve en dirección "
                f"contraria a tu meta ({progreso_meta['ritmo_real_semanal']:+.2f} kg/sem)."
            )
        elif estado_actual_meta == "estancado":
            st.warning(
                f"⚠️ Tu peso está estancado en las últimas ~{HORIZONTE_TENDENCIA_DIAS} días, "
                f"sin avance claro hacia la meta."
            )
        elif estado_actual_meta == "atrasado":
            st.warning(
                f"⚠️ Vas más lento que tu ritmo objetivo desde hace ~{HORIZONTE_TENDENCIA_DIAS} días "
                f"({progreso_meta['ritmo_real_semanal']:+.2f} kg/sem vs "
                f"{progreso_meta['ritmo_objetivo_signed']:+.2f} kg/sem objetivo)."
            )

with st.container(border=True):
    st.subheader("Actividad diaria (últimos 30 días)")
    recientes = garmin.sort_values("fecha").tail(30)
    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(
            bar_chart(recientes, "fecha", "pasos", "Pasos diarios", "pasos", COLOR_PASOS),
            use_container_width=True,
        )
    with c2:
        st.plotly_chart(
            bar_chart(
                recientes, "fecha", "horas_sueno", "Horas de sueño", "horas", COLOR_SUENO
            ),
            use_container_width=True,
        )

with st.container(border=True):
    st.subheader("Frecuencia cardíaca en reposo")
    fc_df = garmin.dropna(subset=["fc_reposo"])
    st.plotly_chart(
        line_chart(fc_df, "fecha", "fc_reposo", "FC en reposo en el tiempo", "lpm", COLOR_FC),
        use_container_width=True,
    )

with st.container(border=True):
    st.subheader("Recuperación y disposición para entrenar")
    r1, r2 = st.columns(2)
    with r1:
        sleep_score_df = garmin.dropna(subset=["sleep_score"])
        st.plotly_chart(
            line_chart(
                sleep_score_df, "fecha", "sleep_score", "Sleep Score", "puntos (0-100)",
                COLOR_SLEEP_SCORE,
            ),
            use_container_width=True,
        )
    with r2:
        tr_df = garmin.dropna(subset=["training_readiness"])
        st.plotly_chart(
            line_chart(
                tr_df, "fecha", "training_readiness", "Training Readiness", "puntos (0-100)",
                COLOR_TRAINING_READINESS,
            ),
            use_container_width=True,
        )

    r3, r4 = st.columns(2)
    with r3:
        st.plotly_chart(body_battery_chart(garmin), use_container_width=True)
    with r4:
        estres_df = garmin.dropna(subset=["estres_promedio"])
        st.plotly_chart(
            line_chart(
                estres_df, "fecha", "estres_promedio", "Estrés promedio diario", "puntos (0-100)",
                COLOR_ESTRES,
            ),
            use_container_width=True,
        )

with st.container(border=True):
    st.subheader("Metabolismo")
    cal_df = garmin.dropna(subset=["calorias_activas", "calorias_reposo"], how="all")
    if cal_df.empty:
        st.info("No hay datos de calorías todavía.")
    else:
        total_prom = int(
            (cal_df["calorias_activas"].fillna(0) + cal_df["calorias_reposo"].fillna(0)).mean()
        )
        st.caption(
            f"Barras apiladas: reposo (BMR) + activas. La línea punteada marca el total "
            f"quemado por día. Promedio total del periodo: {total_prom:,} kcal/día."
        )
        st.plotly_chart(metabolism_chart(garmin), use_container_width=True)

with st.container(border=True):
    st.subheader("Hidratación")
    agua_df = garmin.dropna(subset=["perdida_liquidos_ml"])
    if agua_df.empty:
        st.info("No hay datos de pérdida de líquidos (sweat loss) todavía.")
    else:
        st.caption("Pérdida estimada de líquidos (sweat loss) en los días con actividad.")
        st.plotly_chart(
            bar_chart(
                agua_df, "fecha", "perdida_liquidos_ml",
                "Pérdida de líquidos por día", "ml", COLOR_AGUA,
            ),
            use_container_width=True,
        )

with st.container(border=True):
    st.subheader("Sueño detallado")
    fases_df = garmin.dropna(
        subset=["sueno_profundo_h", "sueno_rem_h", "sueno_ligero_h"], how="all"
    )
    if fases_df.empty:
        st.info("No hay datos de fases del sueño todavía.")
    else:
        s1, s2 = st.columns([2, 1])
        with s1:
            st.plotly_chart(sleep_composition_chart(garmin), use_container_width=True)
        with s2:
            resp_df = garmin.dropna(subset=["respiracion_nocturna"])
            st.plotly_chart(
                line_chart(
                    resp_df, "fecha", "respiracion_nocturna",
                    "Respiración nocturna", "resp/min", COLOR_RESP,
                ),
                use_container_width=True,
            )

with st.container(border=True):
    st.subheader("Carga de entrenamiento")
    estado_actual, estado_fecha = ultimo_texto(garmin, "estado_entrenamiento")
    carga_last, _carga_prev, carga_fecha = ultimo_previo(garmin, "carga_entrenamiento")
    color_estado = ESTADO_COLOR.get(estado_actual, CY)
    estado_txt = estado_actual if estado_actual else "—"
    carga_txt = f"{int(carga_last)}" if carga_last is not None else "—"
    fecha_txt = estado_fecha.date().isoformat() if estado_fecha is not None else ""
    st.markdown(
        f"""
        <div class="ts-card" style="border-color:{color_estado}55; box-shadow:0 0 20px {color_estado}22;">
          <div class="ts-label">TRAINING STATUS ACTUAL</div>
          <div class="ts-value" style="color:{color_estado}; text-shadow:0 0 14px {color_estado}88;">{estado_txt}</div>
          <div class="ts-meta">CARGA AGUDA: {carga_txt} · {fecha_txt}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    carga_df = garmin.dropna(subset=["carga_entrenamiento"])
    if carga_df.empty:
        st.info("No hay datos de carga de entrenamiento todavía.")
    else:
        st.plotly_chart(
            line_chart(
                carga_df, "fecha", "carga_entrenamiento",
                "Carga aguda (acute load) en el tiempo", "carga", COLOR_CARGA,
            ),
            use_container_width=True,
        )

with st.container(border=True):
    st.subheader("Actividades / entrenamientos recientes")
    actividades = garmin.dropna(subset=["tipo_actividad"]).sort_values("fecha", ascending=False)
    if actividades.empty:
        st.info("No hay actividades registradas todavía.")
    else:
        st.dataframe(
            actividades[
                ["fecha", "tipo_actividad", "duracion_actividad_min", "calorias_actividad"]
            ].rename(
                columns={
                    "fecha": "Fecha",
                    "tipo_actividad": "Tipo(s) de actividad",
                    "duracion_actividad_min": "Duración (min)",
                    "calorias_actividad": "Calorías",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )

        if detalle.empty:
            st.caption(
                "Corre `python garmin_sync.py` de nuevo para descargar el detalle completo "
                "(zonas de FC, series/repeticiones, ritmo) de cada entrenamiento."
            )
        else:
            detalle_reciente = detalle.sort_values("fecha", ascending=False).head(30)
            opciones = {
                f"{row['fecha'].date()} · {row['nombre'] or row['tipo_actividad']} "
                f"({row['tipo_actividad']})": row["activity_id"]
                for _, row in detalle_reciente.iterrows()
            }
            etiqueta_sel = st.selectbox(
                "Ver detalle de un entrenamiento", list(opciones.keys()), key="sel_actividad"
            )
            if etiqueta_sel:
                fila_sel = detalle[detalle["activity_id"] == opciones[etiqueta_sel]].iloc[0]
                with st.container(border=True):
                    render_activity_detail(fila_sel)

with st.container(border=True):
    st.subheader("Historial de dosis")
    if manual.empty:
        st.info("Todavía no hay registros manuales.")
    else:
        historial = manual.sort_values("fecha", ascending=False)
        st.dataframe(
            historial.rename(
                columns={
                    "fecha": "Fecha",
                    "dosis_mg": "Dosis (mg)",
                    "zona_inyeccion": "Zona",
                    "peso_manual": "Peso manual (kg)",
                    "notas": "Notas",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )

st.divider()

st.subheader("Registro manual")
fcol1, fcol2 = st.columns(2)

with fcol1:
    with st.form("form_peso", clear_on_submit=True):
        st.markdown('<div class="form-title">⚖ REGISTRO DE PESO</div>', unsafe_allow_html=True)
        st.caption("Para uso diario. Solo actualiza el peso de esa fecha.")
        fecha_peso = st.date_input("Fecha", value=date.today(), key="fecha_peso")
        peso_input = st.number_input(
            "Peso (kg)", min_value=0.0, step=0.1, format="%.1f", key="peso_input"
        )
        if st.form_submit_button("Guardar peso"):
            if peso_input > 0:
                guardar_peso(fecha_peso, peso_input)
                st.cache_data.clear()
                st.toast("Peso guardado.", icon="⚖️")
                st.rerun()
            else:
                st.warning("Ingresa un peso mayor que 0.")

with fcol2:
    with st.form("form_inyeccion", clear_on_submit=True):
        st.markdown('<div class="form-title">💉 REGISTRO DE INYECCIÓN</div>', unsafe_allow_html=True)
        st.caption("Solo los días que te inyectes. No toca el peso de esa fecha.")
        fecha_iny = st.date_input("Fecha", value=date.today(), key="fecha_iny")
        dosis_input = st.number_input(
            "Dosis (mg)", min_value=0.0, step=0.1, format="%.2f", key="dosis_input"
        )
        zona_input = st.selectbox("Zona de inyección", ZONAS_INYECCION, key="zona_input")
        notas_input = st.text_area("Notas (opcional)", key="notas_input")
        if st.form_submit_button("Guardar inyección"):
            if dosis_input > 0:
                guardar_inyeccion(fecha_iny, dosis_input, zona_input, notas_input or None)
                st.cache_data.clear()
                st.toast("Inyección registrada.", icon="💉")
                st.rerun()
            else:
                st.warning("Ingresa una dosis mayor que 0.")

st.divider()

st.subheader("Pregúntale a la IA sobre tus datos")

if "ai_chat_history" not in st.session_state:
    st.session_state.ai_chat_history = []

for mensaje in st.session_state.ai_chat_history:
    with st.chat_message(mensaje["role"]):
        st.markdown(mensaje["content"])

pregunta = st.chat_input("Escribe tu pregunta (ej. ¿cómo va mi peso últimamente?)")
if pregunta:
    if not ANTHROPIC_API_KEY:
        st.error(
            "Falta ANTHROPIC_API_KEY en el archivo .env. Agrega tu clave de la API "
            "de Anthropic ahí (ANTHROPIC_API_KEY=sk-ant-...) y vuelve a intentar."
        )
    else:
        st.session_state.ai_chat_history.append({"role": "user", "content": pregunta})
        with st.chat_message("user"):
            st.markdown(pregunta)

        with st.chat_message("assistant"):
            with st.spinner("Pensando..."):
                try:
                    respuesta = preguntar_ia(garmin, manual, st.session_state.ai_chat_history)
                except anthropic.AuthenticationError:
                    respuesta = (
                        "Error de autenticación: revisa que ANTHROPIC_API_KEY en .env "
                        "sea correcta."
                    )
                except anthropic.RateLimitError:
                    respuesta = (
                        "Se alcanzó el límite de solicitudes a la API. Intenta de nuevo "
                        "en un momento."
                    )
                except anthropic.APIConnectionError:
                    respuesta = (
                        "No se pudo conectar con la API de Anthropic. Revisa tu conexión "
                        "a internet."
                    )
                except anthropic.APIStatusError as exc:
                    respuesta = f"Error de la API de Anthropic: {exc.message}"
            st.markdown(respuesta)

        st.session_state.ai_chat_history.append({"role": "assistant", "content": respuesta})
