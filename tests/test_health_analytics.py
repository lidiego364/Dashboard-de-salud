import unittest

import numpy as np
import pandas as pd

import health_analytics as ha


def sample_days(n=40):
    dates = pd.date_range("2026-01-01", periods=n, freq="D")
    return pd.DataFrame({
        "fecha": dates,
        "hrv_ms": np.arange(n, dtype=float) + 50,
        "fc_reposo": 70 - np.arange(n, dtype=float) * .1,
        "horas_sueno": [8.0] * n,
        "sleep_score": [80.0] * n,
        "body_battery_recharge": np.arange(n, dtype=float) + 20,
        "estres_promedio": [30.0] * n,
        "training_readiness": np.arange(n, dtype=float) + 40,
        "skin_temp_c": [np.nan] * n,
        "respiracion_nocturna": [15.0] * n,
        "spo2_promedio_sueno": [np.nan] * n,
        "sleep_need_min": [480.0] * n,
        "sleep_start_local": [f"{d.date()}T23:00:00" for d in dates],
        "sleep_end_local": [f"{(d + pd.Timedelta(days=1)).date()}T07:00:00" for d in dates],
        "carga_entrenamiento": np.arange(n, dtype=float) * 2,
        "pasos": np.arange(n, dtype=float) * 100 + 5000,
    })


class HealthAnalyticsTests(unittest.TestCase):
    def test_baseline_excludes_current_day(self):
        df = sample_days()
        row = ha.baseline_summary(df).set_index("metric").loc["hrv_ms"]
        expected = df["hrv_ms"].iloc[-29:-1].mean()
        self.assertAlmostEqual(row["baseline_28d"], expected)
        self.assertAlmostEqual(row["difference"], df["hrv_ms"].iloc[-1] - expected)
        self.assertEqual(row["baseline_n"], 28)

    def test_missing_is_not_zero(self):
        df = sample_days()
        row = ha.baseline_summary(df).set_index("metric").loc["skin_temp_c"]
        self.assertTrue(pd.isna(row.get("current")))
        self.assertEqual(row["status"], "Insufficient Data")

    def test_sleep_debt_sign(self):
        df = sample_days()
        df.loc[df.index[-1], "horas_sueno"] = 7.0
        summary = ha.sleep_debt_summary(df)
        self.assertEqual(summary["daily"], -60)
        self.assertEqual(summary["classification"], "Déficit")

    def test_consistency_is_high_for_regular_schedule(self):
        result = ha.sleep_consistency(sample_days(), days=28)
        self.assertEqual(result["status"], "Available")
        self.assertGreater(result["score"], 99)
        self.assertLess(result["bedtime_deviation_min"], 1)

    def test_correlations_require_pairs_and_report_lag(self):
        result = ha.correlation_insights(sample_days())
        row = result[result["relationship"] == "Sueño → HRV mañana"].iloc[0]
        # Sueño constante: correlación no es matemáticamente identificable.
        self.assertEqual(row["status"], "Insufficient Data")
        load = result[result["relationship"] == "Carga → HRV día siguiente"].iloc[0]
        self.assertEqual(load["status"], "Available")
        self.assertEqual(load["lag_days"], 1)
        self.assertAlmostEqual(load["pearson_r"], 1.0)


if __name__ == "__main__":
    unittest.main()
