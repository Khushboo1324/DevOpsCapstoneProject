#!/usr/bin/env python3
"""Bounded read-only HTTP load, no third-party packages. Ctrl+C stops early."""
import argparse
import concurrent.futures
import threading
import time
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000/api/tasks")
    parser.add_argument("--duration", type=int, default=120)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--rps", type=int, default=120, help="Maximum aggregate scheduled requests per second")
    args = parser.parse_args()
    if not (1 <= args.duration <= 600 and 1 <= args.workers <= 32 and 1 <= args.rps <= 500):
        parser.error("Bounds: duration 1–600s, workers 1–32, total RPS 1–500")
    if not args.url.startswith(("http://", "https://")):
        parser.error("URL must use HTTP or HTTPS")
    stop = threading.Event()
    deadline = time.monotonic() + args.duration
    counts = {"ok": 0, "errors": 0}
    lock = threading.Lock()
    next_slot = time.monotonic()
    def worker():
        nonlocal next_slot
        while not stop.is_set():
            with lock:
                slot = next_slot
                next_slot += 1 / args.rps
            now = time.monotonic()
            if slot >= deadline or now >= deadline:
                return
            if stop.wait(max(0, slot - now)):
                return
            try:
                with urllib.request.urlopen(args.url, timeout=3) as response:
                    response.read()
                key = "ok"
            except (urllib.error.URLError, TimeoutError, OSError):
                key = "errors"
            with lock:
                counts[key] += 1
    print(f"Read-only load: {args.url}; cap {args.rps} RPS; {args.duration}s. Ctrl+C to stop.")
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=args.workers)
    try:
        futures = [pool.submit(worker) for _ in range(args.workers)]
        for future in futures:
            future.result()
    except KeyboardInterrupt:
        print("Stopping…")
    finally:
        stop.set()
        pool.shutdown(wait=True, cancel_futures=True)
    print(counts)

if __name__ == "__main__":
    main()
