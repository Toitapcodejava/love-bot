# Love-Bot

Personalized post-breakup healing app. Single-user, private.

## Setup

1. Copy `backend/.env.example` → `backend/.env` and fill in keys
2. `cd backend && pip install -e ".[dev]"`
3. `python bootstrap_seed.py` (after DB is ready)
4. `uvicorn main:app --reload`

## Deploy

Backend deploys to Railway (Singapore region).
See `backend/railway.json` for config.

Set these env vars in Railway dashboard:
- ANTHROPIC_API_KEY
- VOYAGE_API_KEY  
- DATABASE_URL
- APP_SHARED_KEY
