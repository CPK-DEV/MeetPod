from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="MeetPod API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],          # 모바일 전용이라 사실상 미사용. 좁히지 않음.
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routers import auth as auth_router
    app.include_router(auth_router.router)

    @app.get("/api/healthz")
    def healthz() -> dict:
        return {"ok": True}

    return app


app = create_app()
