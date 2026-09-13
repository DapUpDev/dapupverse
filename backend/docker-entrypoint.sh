#!/bin/sh
# Migrate first, then serve. A failed migration exits non-zero, the task
# never becomes healthy, and ECS rolls the deployment back.
set -eu
# With arguments (the worker service passes `python -m app.worker`) run
# exactly that and nothing else: the API task owns migrations.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
python -m app.migrate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'
