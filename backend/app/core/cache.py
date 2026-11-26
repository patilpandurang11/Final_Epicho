import json
import time
from typing import Any, Dict, Optional
import redis
from app.core.config import settings


class CacheBackend:
    """Redis cache with seamless in-memory TTL fallback when Redis is offline."""

    def __init__(self):
        self._memory: Dict[str, tuple[Any, float]] = {}
        self._client: Optional[redis.Redis] = None
        try:
            client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5)
            client.ping()
            self._client = client
        except Exception:
            self._client = None

    @property
    def is_redis_connected(self) -> bool:
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def get(self, key: str) -> Optional[str]:
        if self._client:
            try:
                return self._client.get(key)
            except Exception:
                pass
        item = self._memory.get(key)
        if not item:
            return None
        val, expires_at = item
        if expires_at and time.time() > expires_at:
            self._memory.pop(key, None)
            return None
        return val

    def set(self, key: str, value: str, ttl_seconds: int = 300) -> None:
        if self._client:
            try:
                self._client.setex(key, ttl_seconds, value)
                return
            except Exception:
                pass
        self._memory[key] = (value, time.time() + ttl_seconds if ttl_seconds else 0.0)

    def get_json(self, key: str) -> Optional[Any]:
        raw = self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        self.set(key, json.dumps(value, default=str), ttl_seconds=ttl_seconds)

    def incr_with_ttl(self, key: str, ttl_seconds: int = 60) -> int:
        if self._client:
            try:
                pipe = self._client.pipeline()
                pipe.incr(key)
                pipe.expire(key, ttl_seconds, nx=True)
                count, _ = pipe.execute()
                return int(count)
            except Exception:
                pass
        now = time.time()
        item = self._memory.get(key)
        if not item or (item[1] and now > item[1]):
            self._memory[key] = (1, now + ttl_seconds)
            return 1
        new_val = int(item[0]) + 1
        self._memory[key] = (new_val, item[1])
        return new_val

    def delete(self, key: str) -> None:
        if self._client:
            try:
                self._client.delete(key)
            except Exception:
                pass
        self._memory.pop(key, None)


cache = CacheBackend()
