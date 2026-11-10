"""Exercise 3: submit independent requests with bounded concurrency.

Each job is a no-argument callable. Return results in input order and let
exceptions propagate so a failed group never becomes a successful measurement.
"""
from concurrent.futures import ThreadPoolExecutor


def schedule(jobs, workers):
    # TODO: Use a ThreadPoolExecutor with max_workers=workers. Submit all jobs
    # before waiting for their results; submitting then waiting serializes work.
    return [job() for job in jobs]
