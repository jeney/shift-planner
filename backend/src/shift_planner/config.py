import math
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables prefixed with SP_."""

    model_config = SettingsConfigDict(env_prefix="SP_")

    cors_origins: list[str] = ["http://localhost:5173"]
    solver_workers: int | None = None
    """CP-SAT threads per solve. Default: the CPUs actually available to this container."""


settings = Settings()


def available_cpus() -> float:
    """CPUs this process may use: the cgroup v2 quota if one is set (containers), else the
    CPU affinity. os.cpu_count() reports the host's CPUs even under a container limit."""
    try:
        with open("/sys/fs/cgroup/cpu.max") as f:
            quota, period = f.read().split()
        if quota != "max":
            return int(quota) / int(period)
    except (OSError, ValueError):
        pass
    try:
        return float(len(os.sched_getaffinity(0)))
    except AttributeError:  # not on Linux
        return float(os.cpu_count() or 1)


def solver_workers() -> int:
    """Threads per solve: about twice the available CPUs, between 4 and 8.

    Measured on the demo team (20 s limit): CP-SAT relies on a portfolio of different search
    strategies running in parallel, so too few threads hurt more than oversubscription. On 2
    CPUs, 2 threads were ~240 h off target, 4 threads ~65 h, 8 threads ~100 h; on 1 CPU a single
    thread found no plan at all.
    """
    if settings.solver_workers:
        return settings.solver_workers
    return max(4, min(8, math.ceil(2 * available_cpus())))
