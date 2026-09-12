#!/bin/sh
# Migrate first, then serve. A failed migration exits non-zero, the task
# never becomes healthy, and ECS rolls the deployment back.
set -eu
python -m app.migrate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'
