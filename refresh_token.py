"""
Refresca el token de Garmin y lo sube a la bóveda privada de GitHub, sin
descargar datos. Pensado para correr en un cron externo (GitHub Actions)
que no depende de que ninguna máquina local esté encendida.

Uso:
    python refresh_token.py
"""

from garmin_sync import init_api

if __name__ == "__main__":
    init_api()
    print("Token de Garmin refrescado y sincronizado con la bóveda.")
