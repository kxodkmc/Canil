import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    """进程内滑动窗口限流，limit <= 0 表示关闭。"""

    def __init__(self, window: float = 60.0):
        self.window = window
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, limit: int) -> bool:
        if limit <= 0:
            return True
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True
