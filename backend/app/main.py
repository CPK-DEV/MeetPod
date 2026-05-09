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

    @app.get("/api/healthz")
    def healthz() -> dict:
        return {"ok": True}

    return app


app = create_app()
