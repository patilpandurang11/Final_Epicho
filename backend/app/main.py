import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.cache import cache
from app.core.config import settings
from app.core.database import SessionLocal

# Import API Routers
from app.api.v1.admin import router as admin_router
from app.api.v1.ai_kitchen import router as ai_kitchen_router
from app.api.v1.auth import router as auth_router
from app.api.v1.blogs import router as blogs_router
from app.api.v1.consultations import router as consultations_router
from app.api.v1.grocery import router as grocery_router
from app.api.v1.heritage import router as heritage_router
from app.api.v1.meal_planner import router as meal_planner_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.posts import router as posts_router
from app.api.v1.rankings import router as rankings_router
from app.api.v1.recipes import router as recipes_router
from app.api.v1.reels import router as reels_router
from app.api.v1.restaurants import router as restaurants_router
from app.api.v1.subscriptions import router as subscriptions_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="EpiCho: Discover. Create. Cook. Connect. Full-stack AI culinary social platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.STORAGE_PATH, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.STORAGE_PATH), name="uploads")

for r in [
    auth_router,
    recipes_router,
    ai_kitchen_router,
    reels_router,
    posts_router,
    blogs_router,
    meal_planner_router,
    grocery_router,
    heritage_router,
    restaurants_router,
    rankings_router,
    consultations_router,
    notifications_router,
    subscriptions_router,
    admin_router,
]:
    app.include_router(r, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "platform": "EpiCho",
        "tagline": "Discover. Create. Cook. Connect.",
        "status": "operational",
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    db_ok = False
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "error",
        "redis": "connected" if cache.is_redis_connected else "in_memory_fallback",
        "ai_engine": "gemini" if settings.GEMINI_API_KEY else "fallback_ready",
        "version": settings.VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
