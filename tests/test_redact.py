from app.core.redact import MASK, redact


def test_redact_masks_configured_values_and_token_shapes() -> None:
    out = redact("key=supersecret auth: Bearer abcdefghijkl ghp_ABCDEFGHIJKLMNOP", ["supersecret", "abc"])
    assert "supersecret" not in out and "abcdefghijkl" not in out and "ghp_" not in out
    assert MASK in out
    assert redact("tiny abc", ["abc"]) == "tiny abc"  # values shorter than 4 chars are not masked
