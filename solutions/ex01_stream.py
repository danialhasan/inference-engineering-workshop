"""Reference: client-observed first text can include loading and queueing."""


def measure(request):
    first = next((chunk["ms"] for chunk in request["chunks"] if chunk["text"]), None)
    return {"first_text_ms": first, "wall_ms": request["wall_ms"],
            "output_tokens": request["output_tokens"]}
