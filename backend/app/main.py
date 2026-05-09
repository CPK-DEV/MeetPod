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
    from app.routers import profiles as profiles_router
    app.include_router(profiles_router.router)
    from app.routers import invites as invites_router
    app.include_router(invites_router.router)
    from app.routers import friendships as friendships_router
    app.include_router(friendships_router.router)
    from app.routers import groups as groups_router
    app.include_router(groups_router.router)

    @app.get("/api/healthz")
    def healthz() -> dict:
        return {"ok": True}

    return app


app = create_app()
