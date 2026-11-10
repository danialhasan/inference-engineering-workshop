"""Exercise 1: measure the first visible text, not the final event.

Input is one successful request. chunks contains {ms, text} entries where ms
is elapsed client time since request start. Keep the return keys unchanged.
"""


def measure(request):
    # TODO: Find the first chunk whose text is nonempty. Preserve a time of 0.
    first_text_ms = None
    return {"first_text_ms": first_text_ms, "wall_ms": request["wall_ms"],
            "output_tokens": request["output_tokens"]}
