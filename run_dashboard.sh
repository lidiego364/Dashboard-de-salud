#!/usr/bin/env bash
# Lanza el dashboard accesible desde otros dispositivos de TU MISMA red WiFi
# (por ejemplo, tu teléfono). El teléfono y esta Mac deben estar en la misma red.
#
# Uso:
#   ./run_dashboard.sh
#
set -e
cd "$(dirname "$0")"

PORT=8501
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '')"

echo "============================================================"
echo "  HEALTH MONITORING SYSTEM"
echo "------------------------------------------------------------"
echo "  En esta Mac:        http://localhost:${PORT}"
if [ -n "$IP" ]; then
  echo "  Desde tu telefono:  http://${IP}:${PORT}"
  echo "  (el telefono debe estar en la MISMA red WiFi que la Mac)"
else
  echo "  No se detecto IP de red local. Revisa que el WiFi este activo."
fi
echo "============================================================"
echo ""

# --server.address 0.0.0.0 => escucha en todas las interfaces (accesible en la LAN)
exec .venv/bin/streamlit run dashboard.py \
  --server.port "${PORT}" \
  --server.address 0.0.0.0 \
  --server.headless true
