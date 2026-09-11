"""
Generación de reportes Excel (.xlsx) estructurados para análisis por IA.

Tres productos:
  - build_daily_report(garmin, manual)  -> (BytesIO, fecha_ref)   Reporte diario
  - build_weekly_report(garmin, manual) -> BytesIO                Reporte semanal
  - build_master(garmin, manual)        -> BytesIO                Histórico completo

Diseño pensado para lectura por IA:
  - Una hoja por tipo de dato, encabezados claros en la primera fila.
  - Una fila por día (o por métrica en las tablas verticales).
  - Fechas en ISO (YYYY-MM-DD), decimales redondeados, sin celdas combinadas.
"""

import io

import pandas as pd

import health_analytics as ha

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Extiende el config de health_analytics con las métricas que ese módulo no
# cubre pero que sí interesan en los reportes (el peso se maneja aparte, con
# su propio filtro de Kalman, en _resumen_meta). Así los reportes reusan el
# mismo motor de baseline/zscore/percentil que ya está probado en el dashboard
# en vez de duplicar el cálculo con una lógica distinta.
METRIC_CONFIG_REPORTES = {
    **ha.METRIC_CONFIG,
    "calorias_activas": ha.MetricConfig("Calorías activas", "kcal", "neutral", 0),
    "calorias_reposo": ha.MetricConfig("Calorías reposo", "kcal", "neutral", 0),
    "carga_entrenamiento": ha.MetricConfig("Carga entrenamiento", "pts", "neutral", 0),
    "pasos": ha.MetricConfig("Pasos", "pasos", "higher", 0),
    "sleep_need_min": ha.MetricConfig("Sleep Need", "min", "neutral", 0),
    "body_battery_max": ha.MetricConfig("Body Battery máx", "pts", "higher", 0),
}

# Columnas de detalle de entrenamiento (actividades_detalle) para las hojas
# de actividades de los reportes.
COLS_ACTIVIDADES = [
    ("fecha", "fecha"), ("nombre", "nombre"), ("tipo_actividad", "tipo"),
    ("duracion_min", "duración (min)"), ("calorias", "calorías"),
    ("fc_promedio", "FC promedio"), ("fc_maxima", "FC máxima"),
    ("fc_zona1_min", "FC zona1 (min)"), ("fc_zona2_min", "FC zona2 (min)"),
    ("fc_zona3_min", "FC zona3 (min)"), ("fc_zona4_min", "FC zona4 (min)"),
    ("fc_zona5_min", "FC zona5 (min)"),
    ("distancia_km", "distancia (km)"), ("ritmo_min_km", "ritmo (min/km)"),
    ("carga_entrenamiento", "carga entrenamiento"),
    ("efecto_aerobico", "efecto aeróbico"), ("efecto_anaerobico", "efecto anaeróbico"),
    ("series_totales", "series"), ("repeticiones_totales", "repeticiones"),
    ("ejercicios_detectados", "ejercicios detectados"),
]

# Métricas clave: (etiqueta legible, columna en el DataFrame). "peso" es la
# columna combinada (manual con prioridad sobre Garmin).
METRICAS_CLAVE = [
    ("HRV (ms)", "hrv_ms"),
    ("FC reposo (lpm)", "fc_reposo"),
    ("Sueño total (h)", "horas_sueno"),
    ("Sueño profundo (h)", "sueno_profundo_h"),
    ("REM (h)", "sueno_rem_h"),
    ("Respiración nocturna (rpm)", "respiracion_nocturna"),
    ("SpO2 sueño promedio (%)", "spo2_promedio_sueno"),
    ("Body Battery (máx)", "body_battery_max"),
    ("Body Battery recharge", "body_battery_recharge"),
    ("Sleep Need (min)", "sleep_need_min"),
    ("Temperatura piel (°C)", "skin_temp_c"),
    ("Estrés promedio", "estres_promedio"),
    ("Calorías activas (kcal)", "calorias_activas"),
    ("Calorías reposo (kcal)", "calorias_reposo"),
    ("Carga entrenamiento", "carga_entrenamiento"),
    ("Peso (kg)", "peso"),
]

# Tabla ancha diaria (DATOS_DIARIOS del semanal): (columna, encabezado).
COLS_DIARIOS = [
    ("fecha", "fecha"),
    ("hrv_ms", "HRV (ms)"),
    ("fc_reposo", "FC reposo (lpm)"),
    ("horas_sueno", "Sueño total (h)"),
    ("sueno_profundo_h", "Sueño profundo (h)"),
    ("sueno_rem_h", "REM (h)"),
    ("respiracion_nocturna", "Respiración nocturna (rpm)"),
    ("spo2_promedio_sueno", "SpO2 sueño promedio (%)"),
    ("spo2_minimo_sueno", "SpO2 sueño mínimo (%)"),
    ("sleep_need_min", "Sleep Need (min)"),
    ("body_battery_recharge", "Body Battery recharge"),
    ("body_battery_max", "Body Battery (máx)"),
    ("estres_promedio", "Estrés promedio"),
    ("pasos", "Pasos"),
    ("calorias_activas", "Calorías activas (kcal)"),
    ("calorias_reposo", "Calorías reposo (kcal)"),
    ("carga_entrenamiento", "Carga entrenamiento"),
    ("peso", "Peso (kg)"),
]

# Histórico completo (maestro): todo lo útil por día + eventos manuales.
COLS_HISTORICO = [
    ("fecha", "fecha"),
    ("peso", "Peso (kg)"),
    ("peso_kg", "Peso Garmin (kg)"),
    ("pasos", "Pasos"),
    ("hrv_ms", "HRV (ms)"),
    ("fc_reposo", "FC reposo (lpm)"),
    ("horas_sueno", "Sueño total (h)"),
    ("sueno_profundo_h", "Sueño profundo (h)"),
    ("sueno_rem_h", "REM (h)"),
    ("sueno_ligero_h", "Sueño ligero (h)"),
    ("sleep_score", "Sleep score"),
    ("respiracion_nocturna", "Respiración nocturna (rpm)"),
    ("respiracion_min_nocturna", "Respiración nocturna mínima (rpm)"),
    ("respiracion_max_nocturna", "Respiración nocturna máxima (rpm)"),
    ("spo2_promedio_sueno", "SpO2 sueño promedio (%)"),
    ("spo2_minimo_sueno", "SpO2 sueño mínimo (%)"),
    ("sleep_need_min", "Sleep Need (min)"),
    ("sleep_start_local", "Inicio sueño local"),
    ("sleep_end_local", "Fin sueño local"),
    ("body_battery_bedtime", "Body Battery al dormir"),
    ("body_battery_wake", "Body Battery al despertar"),
    ("body_battery_recharge", "Body Battery recharge"),
    ("body_battery_daily_drain", "Body Battery daily drain"),
    ("skin_temp_c", "Temperatura piel (°C)"),
    ("skin_temp_available", "Temperatura piel disponible"),
    ("skin_temp_calibration_days", "Calibración temperatura (días)"),
    ("source_device_id", "Dispositivo origen"),
    ("body_battery_max", "Body Battery máx"),
    ("body_battery_min", "Body Battery mín"),
    ("estres_promedio", "Estrés promedio"),
    ("calorias_activas", "Calorías activas (kcal)"),
    ("calorias_reposo", "Calorías reposo (kcal)"),
    ("perdida_liquidos_ml", "Pérdida líquidos (ml)"),
    ("training_readiness", "Training readiness"),
    ("carga_entrenamiento", "Carga entrenamiento"),
    ("estado_entrenamiento", "Estado entrenamiento"),
    ("vo2max", "VO2 Max"),
    ("tipo_actividad", "Tipo(s) actividad"),
    ("duracion_actividad_min", "Duración actividad (min)"),
    ("calorias_actividad", "Calorías actividad (kcal)"),
    ("dosis_mg", "Dosis Mounjaro (mg)"),
    ("zona_inyeccion", "Zona inyección"),
    ("peso_manual", "Peso manual (kg)"),
    ("notas", "Notas"),
]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _fecha_iso(v):
    if v is None or pd.isnull(v):
        return None
    return pd.Timestamp(v).strftime("%Y-%m-%d")


def _num(v, dec=2):
    """Redondea a `dec` decimales; devuelve int si es entero; None si es nulo."""
    if v is None:
        return None
    try:
        if pd.isnull(v):
            return None
    except (TypeError, ValueError):
        pass
    try:
        f = float(v)
    except (TypeError, ValueError):
        return v
    r = round(f, dec)
    if r == int(r):
        return int(r)
    return r


def _daily_metrics(garmin, manual):
    """DataFrame por día (todas las filas de garmin) con la columna combinada
    `peso` (manual con prioridad sobre Garmin). Ordenado por fecha ascendente."""
    g = garmin.copy()
    if manual is not None and not manual.empty and "peso_manual" in manual:
        g = g.merge(manual[["fecha", "peso_manual"]], on="fecha", how="left")
    else:
        g["peso_manual"] = pd.NA
    peso_kg = g["peso_kg"] if "peso_kg" in g else pd.Series([pd.NA] * len(g))
    g["peso"] = g["peso_manual"].combine_first(peso_kg)
    return g.sort_values("fecha").reset_index(drop=True)


def fecha_referencia(garmin):
    """Fecha más reciente presente en los datos (para nombres de archivo)."""
    if garmin is None or garmin.empty:
        return pd.Timestamp.today().normalize()
    return pd.Timestamp(garmin["fecha"].max())


def _cambio_pct(valor, base):
    if valor is None or base is None:
        return None
    try:
        if pd.isnull(valor) or pd.isnull(base) or float(base) == 0:
            return None
    except (TypeError, ValueError):
        return None
    return (float(valor) - float(base)) / float(base) * 100.0


def _eventos(manual, fecha_ref, dias):
    """Dosis, creatina y registros de peso de tracker_manual en los últimos
    `dias` días."""
    columnas = [
        "fecha", "tipo", "dosis_mg", "zona_inyeccion", "creatina_g",
        "peso_manual", "notas",
    ]
    if manual is None or manual.empty:
        return pd.DataFrame([{"estado": "Sin eventos en el periodo"}])
    inicio = pd.Timestamp(fecha_ref) - pd.Timedelta(days=dias - 1)
    win = manual[
        (manual["fecha"] >= inicio) & (manual["fecha"] <= pd.Timestamp(fecha_ref))
    ].sort_values("fecha")
    filas = []
    for _, r in win.iterrows():
        tipos = []
        if pd.notnull(r.get("dosis_mg")):
            tipos.append("dosis")
        if pd.notnull(r.get("peso_manual")):
            tipos.append("peso")
        if pd.notnull(r.get("creatina_g")):
            tipos.append("creatina")
        filas.append(
            {
                "fecha": _fecha_iso(r["fecha"]),
                "tipo": "+".join(tipos) if tipos else "otro",
                "dosis_mg": _num(r.get("dosis_mg")),
                "zona_inyeccion": r.get("zona_inyeccion"),
                "creatina_g": _num(r.get("creatina_g")),
                "peso_manual": _num(r.get("peso_manual")),
                "notas": r.get("notas"),
            }
        )
    if not filas:
        return pd.DataFrame([{"estado": "Sin eventos en el periodo"}])
    return pd.DataFrame(filas, columns=columnas)


def _resumen_meta(progreso_meta):
    """Progreso hacia la meta de peso (calculado en dashboard.py con el
    filtro de Kalman) como tabla campo/valor, para que quede en el reporte
    en vez de solo visible en la UI."""
    if not progreso_meta:
        return pd.DataFrame([{"estado": "Sin meta configurada o datos insuficientes"}])
    fecha_estimada = progreso_meta.get("fecha_estimada")
    filas = [
        {"campo": "Peso actual (kg)", "valor": _num(progreso_meta.get("peso_actual"))},
        {"campo": "Peso objetivo (kg)", "valor": _num(progreso_meta.get("peso_objetivo"))},
        {"campo": "Peso inicial (kg)", "valor": _num(progreso_meta.get("peso_inicial"))},
        {"campo": "Diferencia a la meta (kg)", "valor": _num(progreso_meta.get("diferencia"))},
        {"campo": "Ritmo real (kg/semana, Kalman)", "valor": _num(progreso_meta.get("ritmo_real_semanal"), 2)},
        {"campo": "Ritmo objetivo (kg/semana)", "valor": _num(progreso_meta.get("ritmo_objetivo_signed"), 2)},
        {"campo": "Estado", "valor": progreso_meta.get("estado")},
        {"campo": "Fecha estimada de meta", "valor": _fecha_iso(fecha_estimada) if fecha_estimada is not None else None},
        {"campo": "Semanas restantes (estimado)", "valor": _num(progreso_meta.get("semanas_restantes"), 1)},
    ]
    return pd.DataFrame(filas, columns=["campo", "valor"])


def _detalle_actividades(detalle, fecha_ref, dias):
    """Detalle por entrenamiento (nombre, FC, zonas, series/reps, etc.) en
    los últimos `dias` días, en vez de solo el agregado de carga."""
    if detalle is None or detalle.empty:
        return pd.DataFrame([{"estado": "Sin actividades registradas"}])
    inicio = pd.Timestamp(fecha_ref) - pd.Timedelta(days=dias - 1)
    win = detalle[
        (detalle["fecha"] >= inicio) & (detalle["fecha"] <= pd.Timestamp(fecha_ref))
    ].sort_values("fecha")
    if win.empty:
        return pd.DataFrame([{"estado": "Sin actividades en el periodo"}])
    return _tabla_ancha(win, COLS_ACTIVIDADES)


def _sueno_recuperacion(garmin, dias_list):
    """Sleep debt + sleep consistency (varias ventanas) + estabilidad
    respiratoria, reusando las mismas fórmulas de health_analytics que se
    muestran en el dashboard."""
    filas = []
    debt = ha.sleep_debt_summary(garmin)
    if debt.get("status") == "Available":
        filas.append({"campo": "Sleep debt hoy (min)", "valor": _num(debt.get("daily"), 0)})
        filas.append({"campo": "Clasificación sleep debt", "valor": debt.get("classification")})
        for d in (7, 14, 28):
            filas.append({
                "campo": f"Sleep debt acumulado {d}D (min)",
                "valor": _num(debt.get(f"total_{d}d"), 0),
            })
    else:
        filas.append({"campo": "Sleep debt", "valor": "Insufficient Data"})

    for dias in dias_list:
        cons = ha.sleep_consistency(garmin, days=dias)
        if cons.get("status") == "Available":
            filas.append({
                "campo": f"Sleep consistency {dias}D (score /100)",
                "valor": _num(cons.get("score"), 0),
            })
            filas.append({
                "campo": f"Sleep consistency {dias}D — desviación dormir/despertar/duración (min)",
                "valor": (
                    f"{_num(cons.get('bedtime_deviation_min'), 0)} / "
                    f"{_num(cons.get('wake_deviation_min'), 0)} / "
                    f"{_num(cons.get('duration_deviation_min'), 0)}"
                ),
            })
        else:
            filas.append({"campo": f"Sleep consistency {dias}D", "valor": "Insufficient Data"})

    resp = ha.respiratory_stability(garmin)
    filas.append({"campo": "Respiratory stability", "valor": resp.get("status")})

    return pd.DataFrame(filas, columns=["campo", "valor"])


def _resumen_ejecutivo(progreso_meta, baseline_df, eventos_df, sleep_debt, periodo_label):
    """Bullets en texto plano con lo más importante, para que una IA (o vos)
    no tenga que cruzar 8 hojas para entender el panorama general."""
    lineas = []
    if progreso_meta:
        lineas.append(
            f"Peso: {_num(progreso_meta.get('peso_actual'), 1)} kg -> objetivo "
            f"{_num(progreso_meta.get('peso_objetivo'), 1)} kg. Ritmo real "
            f"{_num(progreso_meta.get('ritmo_real_semanal'), 2)} kg/sem vs objetivo "
            f"{_num(progreso_meta.get('ritmo_objetivo_signed'), 2)} kg/sem. "
            f"Estado: {progreso_meta.get('estado')}."
        )
        if progreso_meta.get("fecha_estimada") is not None:
            lineas.append(f"Fecha estimada de meta: {_fecha_iso(progreso_meta['fecha_estimada'])}.")
    else:
        lineas.append("Meta de peso: no configurada o datos insuficientes.")

    if baseline_df is not None and not baseline_df.empty and "anomaly" in baseline_df:
        anom = baseline_df[~baseline_df["anomaly"].isin(["Normal", "Insufficient Data"])]
        if anom.empty:
            lineas.append(f"Sin anomalías destacables {periodo_label}.")
        else:
            nombres = ", ".join(anom["label"].astype(str).tolist())
            lineas.append(f"{len(anom)} métrica(s) fuera de rango personal {periodo_label}: {nombres}.")

    if sleep_debt and sleep_debt.get("status") == "Available":
        lineas.append(
            f"Sleep debt hoy: {_num(sleep_debt.get('daily'), 0)} min "
            f"({sleep_debt.get('classification')})."
        )

    if eventos_df is not None and not eventos_df.empty and "fecha" in eventos_df:
        ultima = eventos_df.iloc[-1]
        lineas.append(
            f"Último evento manual registrado: {ultima.get('fecha')} "
            f"({ultima.get('tipo', 'evento')})."
        )

    if not lineas:
        lineas.append("Sin suficiente información para generar un resumen.")

    return pd.DataFrame({"resumen": lineas})


# ---------------------------------------------------------------------------
# Reporte diario
# ---------------------------------------------------------------------------

def _baseline_hoy(garmin):
    """Baseline/zscore/percentil por métrica (motor de health_analytics,
    el mismo que usa el dashboard), con encabezados en español para Excel."""
    resumen = ha.baseline_summary(garmin, config=METRIC_CONFIG_REPORTES)
    if resumen.empty:
        vacio = pd.DataFrame([{"estado": "Sin datos"}])
        return resumen, vacio, vacio
    cols = [
        "label", "current", "avg_7d", "avg_14d", "baseline_28d",
        "difference", "difference_pct", "zscore", "historical_percentile",
        "anomaly", "interpretation", "baseline_n",
    ]
    for col in cols:
        if col not in resumen:
            resumen[col] = pd.NA
    for col in ("current", "avg_7d", "avg_14d", "baseline_28d", "difference", "zscore"):
        resumen[col] = resumen[col].map(lambda v: _num(v, 2))
    resumen["difference_pct"] = resumen["difference_pct"].map(lambda v: _num(v, 1))
    resumen["historical_percentile"] = resumen["historical_percentile"].map(lambda v: _num(v, 0))
    resumen_view = resumen[cols].rename(columns={
        "label": "métrica", "current": "valor_actual", "avg_7d": "promedio_7d",
        "avg_14d": "promedio_14d", "baseline_28d": "baseline_28d",
        "difference": "diferencia", "difference_pct": "diferencia_%",
        "zscore": "z_score", "historical_percentile": "percentil_historico",
        "anomaly": "clasificación", "interpretation": "lectura",
        "baseline_n": "n_baseline",
    })
    anomalias = resumen[~resumen["anomaly"].isin(["Normal", "Insufficient Data"])]
    if anomalias.empty:
        anomalias_view = pd.DataFrame([{"estado": "Sin anomalías"}])
    else:
        anomalias_view = anomalias[cols].rename(columns={
            "label": "métrica", "current": "valor_actual", "avg_7d": "promedio_7d",
            "avg_14d": "promedio_14d", "baseline_28d": "baseline_28d",
            "difference": "diferencia", "difference_pct": "diferencia_%",
            "zscore": "z_score", "historical_percentile": "percentil_historico",
            "anomaly": "clasificación", "interpretation": "lectura",
            "baseline_n": "n_baseline",
        })
    return resumen, resumen_view, anomalias_view


def build_daily_report(garmin, manual, detalle=None, progreso_meta=None):
    fecha_ref = fecha_referencia(garmin)

    baseline_raw, resumen_df, anomalias_df = _baseline_hoy(garmin)
    eventos_df = _eventos(manual, fecha_ref, dias=7)
    meta_df = _resumen_meta(progreso_meta)
    sueno_df = _sueno_recuperacion(garmin, dias_list=[7])
    actividades_df = _detalle_actividades(detalle, fecha_ref, dias=7)
    sleep_debt = ha.sleep_debt_summary(garmin)
    resumen_ejecutivo_df = _resumen_ejecutivo(
        progreso_meta, baseline_raw, eventos_df, sleep_debt, "hoy"
    )

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        resumen_ejecutivo_df.to_excel(w, sheet_name="RESUMEN_EJECUTIVO", index=False)
        resumen_df.to_excel(w, sheet_name="RESUMEN_HOY", index=False)
        anomalias_df.to_excel(w, sheet_name="ANOMALIAS_HOY", index=False)
        meta_df.to_excel(w, sheet_name="META_PESO", index=False)
        sueno_df.to_excel(w, sheet_name="SUENO_RECUPERACION", index=False)
        eventos_df.to_excel(w, sheet_name="EVENTOS_RECIENTES", index=False)
        actividades_df.to_excel(w, sheet_name="ACTIVIDADES_RECIENTES", index=False)
    buf.seek(0)
    return buf, fecha_ref


# ---------------------------------------------------------------------------
# Reporte semanal
# ---------------------------------------------------------------------------

def _tabla_ancha(df, cols):
    """Construye una tabla ancha con encabezados legibles y fecha ISO."""
    out = pd.DataFrame()
    for col, encabezado in cols:
        if col == "fecha":
            out[encabezado] = df["fecha"].map(_fecha_iso)
        elif col in df:
            serie = df[col]
            if pd.api.types.is_float_dtype(serie):
                serie = serie.round(2)
            out[encabezado] = serie.values
        else:
            out[encabezado] = None
    return out


def _comparativa(last30):
    esta = last30.tail(7)
    anterior = last30.iloc[-14:-7]
    baseline = last30.head(14)
    filas = []
    for etiqueta, col in METRICAS_CLAVE:
        m_esta = esta[col].mean() if col in esta else None
        m_ant = anterior[col].mean() if col in anterior else None
        m_base = baseline[col].mean() if col in baseline else None
        filas.append(
            {
                "metrica": etiqueta,
                "esta_semana_7d": _num(m_esta),
                "semana_anterior_8_14d": _num(m_ant),
                "baseline_14d": _num(m_base),
                "cambio_%_vs_anterior": _num(_cambio_pct(m_esta, m_ant), 1),
                "cambio_%_vs_baseline": _num(_cambio_pct(m_esta, m_base), 1),
            }
        )
    return pd.DataFrame(
        filas,
        columns=[
            "metrica", "esta_semana_7d", "semana_anterior_8_14d",
            "baseline_14d", "cambio_%_vs_anterior", "cambio_%_vs_baseline",
        ],
    )


def _promedios_moviles(dm, last30):
    """Rolling 7/14/28 de HRV, FC reposo, sueño y peso; una fila por día
    (últimos 30). Se calcula sobre todo el histórico para exactitud en los
    bordes y luego se recortan los últimos 30 días."""
    base = dm.set_index("fecha").sort_index()
    metricas = [
        ("hrv_ms", "hrv"),
        ("fc_reposo", "fc_reposo"),
        ("horas_sueno", "sueno"),
        ("peso", "peso"),
    ]
    out = pd.DataFrame({"fecha": base.index})
    out = out.set_index("fecha")
    for col, alias in metricas:
        serie = base[col] if col in base else pd.Series(index=base.index, dtype=float)
        for v in (7, 14, 28):
            out[f"{alias}_{v}d"] = serie.rolling(v, min_periods=1).mean().round(2)
    out = out.reset_index()
    out = out[out["fecha"].isin(last30["fecha"])].reset_index(drop=True)
    out["fecha"] = out["fecha"].map(_fecha_iso)
    return out


def _ventana_dosis(dm, manual, fecha_ref):
    cols = [
        "fecha_dosis", "dosis_mg", "zona_inyeccion",
        "hrv_antes3d", "hrv_despues3d",
        "fc_reposo_antes3d", "fc_reposo_despues3d",
        "sueno_antes3d", "sueno_despues3d",
        "peso_antes3d", "peso_despues3d",
    ]
    if manual is None or manual.empty:
        return pd.DataFrame([{"estado": "Sin dosis registradas"}])
    inicio = pd.Timestamp(fecha_ref) - pd.Timedelta(days=29)
    dosis = manual[
        manual["dosis_mg"].notnull()
        & (manual["fecha"] >= inicio)
        & (manual["fecha"] <= pd.Timestamp(fecha_ref))
    ].sort_values("fecha")
    if dosis.empty:
        return pd.DataFrame([{"estado": "Sin dosis en los últimos 30 días"}])

    idx = dm.set_index("fecha").sort_index()

    def prom(col, ini, fin):
        if col not in idx:
            return None
        try:
            ventana = idx.loc[ini:fin, col]
        except KeyError:
            return None
        return _num(ventana.mean())

    filas = []
    for _, d in dosis.iterrows():
        f = pd.Timestamp(d["fecha"])
        antes_ini, antes_fin = f - pd.Timedelta(days=3), f - pd.Timedelta(days=1)
        desp_ini, desp_fin = f + pd.Timedelta(days=1), f + pd.Timedelta(days=3)
        filas.append(
            {
                "fecha_dosis": _fecha_iso(f),
                "dosis_mg": _num(d.get("dosis_mg")),
                "zona_inyeccion": d.get("zona_inyeccion"),
                "hrv_antes3d": prom("hrv_ms", antes_ini, antes_fin),
                "hrv_despues3d": prom("hrv_ms", desp_ini, desp_fin),
                "fc_reposo_antes3d": prom("fc_reposo", antes_ini, antes_fin),
                "fc_reposo_despues3d": prom("fc_reposo", desp_ini, desp_fin),
                "sueno_antes3d": prom("horas_sueno", antes_ini, antes_fin),
                "sueno_despues3d": prom("horas_sueno", desp_ini, desp_fin),
                "peso_antes3d": prom("peso", antes_ini, antes_fin),
                "peso_despues3d": prom("peso", desp_ini, desp_fin),
            }
        )
    return pd.DataFrame(filas, columns=cols)


def _carga_entrenamiento(last30):
    def resumen(periodo, etiqueta):
        con_act = periodo.dropna(subset=["tipo_actividad"])
        tipos = set()
        num = 0
        for t in con_act["tipo_actividad"]:
            partes = [p.strip() for p in str(t).split(",") if p.strip()]
            num += len(partes)
            tipos.update(partes)
        dur = con_act["duracion_actividad_min"].sum() if "duracion_actividad_min" in con_act else 0
        cal = con_act["calorias_actividad"].sum() if "calorias_actividad" in con_act else 0
        return {
            "periodo": etiqueta,
            "dias_con_actividad": int(len(con_act)),
            "num_actividades": int(num),
            "tipos": ", ".join(sorted(tipos)) if tipos else "",
            "duracion_total_min": _num(dur, 1),
            "calorias_total": _num(cal),
        }

    filas = [
        resumen(last30.tail(7), "Esta semana (últimos 7d)"),
        resumen(last30.iloc[-14:-7], "Semana anterior (días 8-14)"),
    ]
    return pd.DataFrame(
        filas,
        columns=[
            "periodo", "dias_con_actividad", "num_actividades",
            "tipos", "duracion_total_min", "calorias_total",
        ],
    )


def build_weekly_report(garmin, manual, detalle=None, progreso_meta=None):
    dm = _daily_metrics(garmin, manual)
    last30 = dm.tail(30).reset_index(drop=True)
    fecha_ref = fecha_referencia(garmin)

    datos_diarios = _tabla_ancha(last30, COLS_DIARIOS)
    comparativa = _comparativa(last30)
    moviles = _promedios_moviles(dm, last30)
    ventana = _ventana_dosis(dm, manual, fecha_ref)
    eventos = _eventos(manual, fecha_ref, dias=30)
    carga = _carga_entrenamiento(last30)
    meta_df = _resumen_meta(progreso_meta)
    sueno_df = _sueno_recuperacion(garmin, dias_list=[7, 14, 28])
    actividades_df = _detalle_actividades(detalle, fecha_ref, dias=30)
    baseline_raw = ha.baseline_summary(garmin, config=METRIC_CONFIG_REPORTES)
    sleep_debt = ha.sleep_debt_summary(garmin)
    resumen_ejecutivo_df = _resumen_ejecutivo(
        progreso_meta, baseline_raw, eventos, sleep_debt, "esta semana"
    )

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        resumen_ejecutivo_df.to_excel(w, sheet_name="RESUMEN_EJECUTIVO", index=False)
        datos_diarios.to_excel(w, sheet_name="DATOS_DIARIOS", index=False)
        comparativa.to_excel(w, sheet_name="COMPARATIVA_SEMANAL", index=False)
        moviles.to_excel(w, sheet_name="PROMEDIOS_MOVILES", index=False)
        meta_df.to_excel(w, sheet_name="META_PESO", index=False)
        sueno_df.to_excel(w, sheet_name="SUENO_RECUPERACION", index=False)
        ventana.to_excel(w, sheet_name="VENTANA_DOSIS", index=False)
        eventos.to_excel(w, sheet_name="EVENTOS", index=False)
        actividades_df.to_excel(w, sheet_name="ACTIVIDADES_DETALLE", index=False)
        carga.to_excel(w, sheet_name="CARGA_ENTRENAMIENTO", index=False)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Excel maestro (histórico completo, todos los días)
# ---------------------------------------------------------------------------

def build_master(garmin, manual):
    dm = _daily_metrics(garmin, manual)
    # Merge de eventos manuales completos (dosis/zona/notas) por fecha.
    if manual is not None and not manual.empty:
        cols_manual = [c for c in ["fecha", "dosis_mg", "zona_inyeccion", "notas"] if c in manual]
        dm = dm.merge(manual[cols_manual], on="fecha", how="left")
    historico = _tabla_ancha(dm, COLS_HISTORICO)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        historico.to_excel(w, sheet_name="HISTORICO_COMPLETO", index=False)
    buf.seek(0)
    return buf
