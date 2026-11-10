"""Client concurrency does not guarantee server-side parallel execution."""
from concurrent.futures import ThreadPoolExecutor


def schedule(jobs, workers):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(job) for job in jobs]
        return [future.result() for future in futures]
