from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _clean(v: str) -> str:
    return v.encode().decode("utf-8-sig").strip()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    FRONTEND_URL: str = "meetpod://"
    ENV: str = "development"

    @field_validator("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_JWT_SECRET", mode="before")
    @classmethod
    def strip_bom(cls, v: str) -> str:
        return _clean(v)


@lru_cache
def get_settings() -> Settings:
    return Settings()
