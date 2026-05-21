# Love-Bot

Personalized post-breakup healing app. Single-user, private.

## Setup

1. Copy `backend/.env.example` → `backend/.env` and fill in keys
2. `cd backend && pip install -e ".[dev]"`
3. `python bootstrap_seed.py` (after DB is ready)
4. `uvicorn main:app --reload`

## Deploy

See `backend/render.yaml` for Render Singapore deployment.

> Note: `backend/render.yaml` is created in task 1.9 and `backend/bootstrap_seed.py` is created in task 1.8.
