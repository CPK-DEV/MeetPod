from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    FRONTEND_URL: str = "meetpod://"
    ENV: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
