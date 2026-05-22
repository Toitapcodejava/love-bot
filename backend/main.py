from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db import get_pool, run_migrations
from routes import chat as chat_route, vent as vent_route, rage as rage_route, memory as memory_route
from routes.push import router as push_router
from routes.location import router as location_router
from routes.admin import router as admin_router
from routes.quotes import router as quotes_router


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
app.include_router(vent_route.router)
app.include_router(rage_route.router)
app.include_router(memory_route.router)
app.include_router(push_router)
app.include_router(location_router)
app.include_router(admin_router)
app.include_router(quotes_router)


@app.get("/health")
async def health():
    return {"ok": True}
