from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db import get_pool, run_migrations
from routes import chat as chat_route


@asynccontextmanager
async def lifespan(app):
    pool = await get_pool()
    await run_migrations(pool)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_route.router)


@app.get("/health")
async def health():
    return {"ok": True}
