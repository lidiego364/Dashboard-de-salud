"""Analítica derivada, transparente y reproducible para HELIOS COURT.

Todas las funciones conservan ``NaN`` como dato faltante. Ninguna convierte
ausencias en cero ni emite diagnósticos médicos.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd


MIN_BASELINE_OBS = 7
MIN_ANOMALY_OBS = 14


@dataclass(frozen=True)
class MetricConfig:
    label: str
    unit: str
    direction: str = "neutral"  # higher, lower, neutral
    decimals: int = 1


# Una única fuente de verdad para interpretar la dirección de cada métrica.
METRIC_CONFIG = {
    "hrv_ms": MetricConfig("HRV", "ms", "higher", 0),
    "fc_reposo": MetricConfig("FC en reposo", "lpm", "lower", 0),
    "horas_sueno": MetricConfig("Sueño", "h", "higher", 2),
    "sleep_score": MetricConfig("Sleep Score", "pts", "higher", 0),
    "body_battery_recharge": MetricConfig("Recharge nocturno", "pts", "higher", 0),
    "estres_promedio": MetricConfig("Estrés", "pts", "lower", 0),
    "training_readiness": MetricConfig("Training Readiness", "pts", "higher", 0),
    "skin_temp_c": MetricConfig("Temperatura de piel", "°C", "neutral", 2),
    "respiracion_nocturna": MetricConfig("Respiración", "rpm", "neutral", 1),
    "spo2_promedio_sueno": MetricConfig("SpO₂ sueño", "%", "higher", 1),
}


def _prepared(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["fecha"] = pd.to_datetime(out["fecha"], errors="coerce")
    return out.dropna(subset=["fecha"]).sort_values("fecha").reset_index(drop=True)


def _window(series_df: pd.DataFrame, end: pd.Timestamp, days: int, include_end=True):
    start = end - pd.Timedelta(days=days - 1 if include_end else days)
    mask = series_df["fecha"].between(start, end, inclusive="both" if include_end else "left")
    return series_df.loc[mask, "value"].dropna()


def _interpret(direction: str, zscore: float | None, diff: float | None) -> str:
    if diff is None or pd.isna(diff):
        return "Insufficient Data"
    if zscore is None or pd.isna(zscore) or abs(zscore) < 1.0:
        return "Normal"
    if direction == "neutral":
        return "Worth Watching" if abs(zscore) < 2 else "Significant Deviation"
    favorable = (direction == "higher" and diff > 0) or (direction == "lower" and diff < 0)
    if abs(zscore) >= 2:
        return "Favorable" if favorable else "Significant Deviation"
    return "Good" if favorable else "Worth Watching"


def baseline_summary(df: pd.DataFrame, config=METRIC_CONFIG) -> pd.DataFrame:
    """Valor actual vs ventanas personales.

    Baseline 28D = media de los 28 días calendario anteriores al valor actual
    (excluye el propio día). Z-score usa esa misma muestra con ``ddof=1``.
    Percentil = posición empírica del valor actual dentro de todo el histórico
    anterior disponible. Requiere 7 observaciones para baseline y 14 para
    anomalía/percentil.
    """
    data = _prepared(df)
    rows = []
    for col, meta in config.items():
        if col not in data:
            rows.append({"metric": col, "label": meta.label, "status": "Insufficient Data"})
            continue
        valid = data[["fecha", col]].dropna().rename(columns={col: "value"})
        if valid.empty:
            rows.append({"metric": col, "label": meta.label, "unit": meta.unit, "status": "Insufficient Data"})
            continue
        latest = valid.iloc[-1]
        current_date, current = pd.Timestamp(latest["fecha"]), float(latest["value"])
        previous = valid[(valid["fecha"] < current_date) & (valid["fecha"] >= current_date - pd.Timedelta(days=28))]["value"]
        all_previous = valid[valid["fecha"] < current_date]["value"]
        avg7 = _window(valid, current_date, 7).mean()
        avg14 = _window(valid, current_date, 14).mean()
        baseline = previous.mean() if len(previous) >= MIN_BASELINE_OBS else np.nan
        std = previous.std(ddof=1) if len(previous) >= MIN_ANOMALY_OBS else np.nan
        diff = current - baseline if pd.notna(baseline) else np.nan
        pct = diff / baseline * 100 if pd.notna(baseline) and baseline != 0 else np.nan
        z = diff / std if pd.notna(std) and std > 0 else np.nan
        percentile = (
            (float((all_previous <= current).sum()) / len(all_previous) * 100)
            if len(all_previous) >= MIN_ANOMALY_OBS else np.nan
        )
        if pd.isna(z):
            anomaly = "Insufficient Data"
        elif abs(z) < 1.5:
            anomaly = "Normal"
        elif abs(z) < 2.0:
            anomaly = "Worth Watching"
        else:
            anomaly = "Significant Deviation"
        rows.append({
            "metric": col, "label": meta.label, "unit": meta.unit,
            "current_date": current_date, "current": current,
            "avg_7d": avg7, "avg_14d": avg14, "baseline_28d": baseline,
            "difference": diff, "difference_pct": pct, "std_28d": std,
            "zscore": z, "historical_percentile": percentile,
            "anomaly": anomaly, "interpretation": _interpret(meta.direction, z, diff),
            "baseline_n": int(len(previous)), "direction": meta.direction,
        })
    return pd.DataFrame(rows)


def add_sleep_debt(df: pd.DataFrame) -> pd.DataFrame:
    """Añade deuda diaria en minutos: sueño real - Sleep Need.

    Negativo = déficit, positivo = superávit. Si falta cualquiera de los dos
    valores el resultado permanece ``NaN``.
    """
    out = _prepared(df)
    if "horas_sueno" not in out or "sleep_need_min" not in out:
        out["sleep_debt_min"] = np.nan
    else:
        out["sleep_debt_min"] = out["horas_sueno"] * 60 - out["sleep_need_min"]
    return out


def sleep_debt_summary(df: pd.DataFrame) -> dict:
    data = add_sleep_debt(df).dropna(subset=["sleep_debt_min"])
    if data.empty:
        return {"status": "Insufficient Data"}
    latest = data.iloc[-1]
    result = {"status": "Available", "daily": float(latest["sleep_debt_min"]), "date": latest["fecha"]}
    for days in (7, 14, 28):
        win = data[data["fecha"] >= latest["fecha"] - pd.Timedelta(days=days - 1)]["sleep_debt_min"]
        result[f"total_{days}d"] = float(win.sum()) if len(win) >= max(3, days // 2) else np.nan
        result[f"n_{days}d"] = int(len(win))
    result["classification"] = "Equilibrio" if abs(result["daily"]) <= 15 else ("Superávit" if result["daily"] > 0 else "Déficit")
    return result


def _circular_deviation_minutes(values: pd.Series) -> float:
    """Desviación circular media de horas del día, expresada en minutos."""
    vals = pd.to_numeric(values, errors="coerce").dropna().to_numpy()
    if len(vals) < 3:
        return np.nan
    angles = vals / 1440.0 * 2 * math.pi
    mean_angle = math.atan2(np.sin(angles).mean(), np.cos(angles).mean())
    diffs = np.angle(np.exp(1j * (angles - mean_angle)))
    return float(np.mean(np.abs(diffs)) * 1440 / (2 * math.pi))


def sleep_consistency(df: pd.DataFrame, days=28) -> dict:
    """Consistencia con fórmula explícita.

    Se calcula la desviación circular media de hora de dormir y despertar y la
    desviación media absoluta de duración. El score es ``100 * exp(-D/90)``,
    donde D es el promedio de esas tres desviaciones en minutos. 90 minutos es
    la constante de escala declarada; no se presenta como valor clínico.
    """
    data = _prepared(df)
    required = {"sleep_start_local", "sleep_end_local", "horas_sueno"}
    if not required.issubset(data.columns):
        return {"status": "Insufficient Data"}
    end = data["fecha"].max()
    win = data[data["fecha"] >= end - pd.Timedelta(days=days - 1)].copy()
    win["start"] = pd.to_datetime(win["sleep_start_local"], errors="coerce")
    win["end"] = pd.to_datetime(win["sleep_end_local"], errors="coerce")
    win = win.dropna(subset=["start", "end", "horas_sueno"])
    if len(win) < 5:
        return {"status": "Insufficient Data", "n": len(win)}
    bed_min = win["start"].dt.hour * 60 + win["start"].dt.minute
    wake_min = win["end"].dt.hour * 60 + win["end"].dt.minute
    bed_dev = _circular_deviation_minutes(bed_min)
    wake_dev = _circular_deviation_minutes(wake_min)
    duration_dev = float((win["horas_sueno"] * 60 - win["horas_sueno"].median() * 60).abs().mean())
    combined = float(np.mean([bed_dev, wake_dev, duration_dev]))
    return {
        "status": "Available", "score": 100 * math.exp(-combined / 90.0),
        "bedtime_deviation_min": bed_dev, "wake_deviation_min": wake_dev,
        "duration_deviation_min": duration_dev, "n": len(win), "days": days,
    }


def respiratory_stability(df: pd.DataFrame) -> dict:
    """Clasifica por el mayor |z| de respiración y SpO₂ vs baseline personal."""
    summary = baseline_summary(df, {
        k: METRIC_CONFIG[k] for k in ("respiracion_nocturna", "spo2_promedio_sueno")
    })
    usable = summary.dropna(subset=["zscore"]) if "zscore" in summary else pd.DataFrame()
    if usable.empty:
        return {"status": "Insufficient Data", "metrics": summary}
    max_z = float(usable["zscore"].abs().max())
    label = "Normal" if max_z < 1.5 else ("Slightly Altered" if max_z < 2 else "Significantly Altered")
    return {"status": label, "max_abs_zscore": max_z, "metrics": summary}


CORRELATION_SPECS = [
    ("horas_sueno", "hrv_ms", 1, "Sueño → HRV mañana"),
    ("sleep_debt_min", "training_readiness", 0, "Deuda sueño → Readiness"),
    ("body_battery_recharge", "carga_entrenamiento", 0, "Recharge → Rendimiento/carga"),
    ("estres_promedio", "hrv_ms", 0, "Estrés → HRV"),
    ("skin_temp_c", "hrv_ms", 0, "Temperatura → HRV"),
    ("skin_temp_c", "fc_reposo", 0, "Temperatura → FC reposo"),
    ("carga_entrenamiento", "hrv_ms", 1, "Carga → HRV día siguiente"),
    ("carga_entrenamiento", "horas_sueno", 1, "Carga → Sueño siguiente"),
    ("pasos", "horas_sueno", 1, "Pasos → Sueño siguiente"),
    ("sleep_score", "body_battery_recharge", 0, "Sleep Score → Recharge"),
]


def correlation_insights(df: pd.DataFrame) -> pd.DataFrame:
    """Correlaciones Pearson descriptivas; nunca implican causalidad."""
    data = add_sleep_debt(df)
    rows = []
    for x, y, lag, label in CORRELATION_SPECS:
        if x not in data or y not in data:
            rows.append({"relationship": label, "status": "Insufficient Data", "n": 0})
            continue
        pair = pd.DataFrame({"x": data[x], "y": data[y].shift(-lag) if lag else data[y]}).dropna()
        if len(pair) < 10 or pair["x"].nunique() < 2 or pair["y"].nunique() < 2:
            rows.append({"relationship": label, "lag_days": lag, "status": "Insufficient Data", "n": len(pair)})
            continue
        r = float(pair["x"].corr(pair["y"]))
        strength = "Weak" if abs(r) < .3 else ("Moderate" if abs(r) < .6 else "Strong")
        rows.append({
            "relationship": label, "lag_days": lag, "pearson_r": r,
            "strength": strength, "direction": "Positive" if r >= 0 else "Negative",
            "n": len(pair), "status": "Available",
        })
    return pd.DataFrame(rows)


def data_quality(df: pd.DataFrame, config=METRIC_CONFIG) -> pd.DataFrame:
    data = _prepared(df)
    rows = []
    total = len(data)
    for col, meta in config.items():
        valid = int(data[col].notna().sum()) if col in data else 0
        latest = data.loc[data[col].notna(), "fecha"].max() if col in data and valid else pd.NaT
        rows.append({
            "metric": meta.label, "valid_days": valid, "missing_days": total - valid,
            "coverage_pct": valid / total * 100 if total else 0,
            "latest_date": latest, "status": "OK" if valid >= 14 else "Insufficient Data",
        })
    return pd.DataFrame(rows)
