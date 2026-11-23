from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables prefixed with SP_."""

    model_config = SettingsConfigDict(env_prefix="SP_")

    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
