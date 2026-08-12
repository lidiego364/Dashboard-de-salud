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

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Métricas clave: (etiqueta legible, columna en el DataFrame). "peso" es la
# columna combinada (manual con prioridad sobre Garmin).
METRICAS_CLAVE = [
    ("HRV (ms)", "hrv_ms"),
    ("FC reposo (lpm)", "fc_reposo"),
    ("Sueño total (h)", "horas_sueno"),
    ("Sueño profundo (h)", "sueno_profundo_h"),
    ("REM (h)", "sueno_rem_h"),
    ("Respiración nocturna (rpm)", "respiracion_nocturna"),
    ("Body Battery (máx)", "body_battery_max"),
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
    """Dosis y registros de peso de tracker_manual en los últimos `dias` días."""
    columnas = ["fecha", "tipo", "dosis_mg", "zona_inyeccion", "peso_manual", "notas"]
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
        filas.append(
            {
                "fecha": _fecha_iso(r["fecha"]),
                "tipo": "+".join(tipos) if tipos else "otro",
                "dosis_mg": _num(r.get("dosis_mg")),
                "zona_inyeccion": r.get("zona_inyeccion"),
                "peso_manual": _num(r.get("peso_manual")),
                "notas": r.get("notas"),
            }
        )
    if not filas:
        return pd.DataFrame([{"estado": "Sin eventos en el periodo"}])
    return pd.DataFrame(filas, columns=columnas)


# ---------------------------------------------------------------------------
# Reporte diario
# ---------------------------------------------------------------------------

def build_daily_report(garmin, manual):
    dm = _daily_metrics(garmin, manual)
    last30 = dm.tail(30).reset_index(drop=True)
    fecha_ref = fecha_referencia(garmin)

    hoy = last30[last30["fecha"] == last30["fecha"].max()]
    ult7 = last30.tail(7)
    baseline = last30.head(14)  # los 14 días más antiguos del rango de 30

    resumen, anomalias = [], []
    for etiqueta, col in METRICAS_CLAVE:
        valor_hoy = hoy[col].iloc[0] if (not hoy.empty and col in hoy) else None
        prom7 = ult7[col].mean() if col in ult7 else None
        base_mean = baseline[col].mean() if col in baseline else None
        base_std = baseline[col].std() if col in baseline else None
        cambio = _cambio_pct(valor_hoy, base_mean)

        resumen.append(
            {
                "metrica": etiqueta,
                "valor_hoy": _num(valor_hoy),
                "promedio_7d": _num(prom7),
                "baseline_14d": _num(base_mean),
                "cambio_%_vs_baseline": _num(cambio, 1),
            }
        )

        if (
            valor_hoy is not None
            and pd.notnull(valor_hoy)
            and base_std is not None
            and pd.notnull(base_std)
            and base_std > 0
        ):
            z = (float(valor_hoy) - float(base_mean)) / float(base_std)
            if abs(z) > 1.5:
                anomalias.append(
                    {
                        "metrica": etiqueta,
                        "valor_hoy": _num(valor_hoy),
                        "baseline_media": _num(base_mean),
                        "baseline_desv_std": _num(base_std),
                        "desviaciones_std": _num(z, 2),
                        "direccion": "por encima" if z > 0 else "por debajo",
                    }
                )

    resumen_df = pd.DataFrame(
        resumen,
        columns=["metrica", "valor_hoy", "promedio_7d", "baseline_14d", "cambio_%_vs_baseline"],
    )
    if anomalias:
        anomalias_df = pd.DataFrame(
            anomalias,
            columns=[
                "metrica", "valor_hoy", "baseline_media",
                "baseline_desv_std", "desviaciones_std", "direccion",
            ],
        )
    else:
        anomalias_df = pd.DataFrame([{"estado": "Sin anomalías"}])

    eventos_df = _eventos(manual, fecha_ref, dias=7)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        resumen_df.to_excel(w, sheet_name="RESUMEN_HOY", index=False)
        anomalias_df.to_excel(w, sheet_name="ANOMALIAS_HOY", index=False)
        eventos_df.to_excel(w, sheet_name="EVENTOS_RECIENTES", index=False)
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


def build_weekly_report(garmin, manual):
    dm = _daily_metrics(garmin, manual)
    last30 = dm.tail(30).reset_index(drop=True)
    fecha_ref = fecha_referencia(garmin)

    datos_diarios = _tabla_ancha(last30, COLS_DIARIOS)
    comparativa = _comparativa(last30)
    moviles = _promedios_moviles(dm, last30)
    ventana = _ventana_dosis(dm, manual, fecha_ref)
    eventos = _eventos(manual, fecha_ref, dias=30)
    carga = _carga_entrenamiento(last30)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        datos_diarios.to_excel(w, sheet_name="DATOS_DIARIOS", index=False)
        comparativa.to_excel(w, sheet_name="COMPARATIVA_SEMANAL", index=False)
        moviles.to_excel(w, sheet_name="PROMEDIOS_MOVILES", index=False)
        ventana.to_excel(w, sheet_name="VENTANA_DOSIS", index=False)
        eventos.to_excel(w, sheet_name="EVENTOS", index=False)
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
