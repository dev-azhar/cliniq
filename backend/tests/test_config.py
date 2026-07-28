"""Regression tests for Settings.payment_mock_enabled — the single gate that
decides whether payment endpoints use the offline mock/sandbox path or the
real Razorpay gateway. This logic controls whether real money can be charged,
so it is covered explicitly and must never regress silently.
"""
from app.core.config import Settings


def make_settings(**overrides) -> Settings:
    defaults = dict(
        environment="development",
        razorpay_key_id="",
        razorpay_key_secret="",
        payment_test_mode=True,
    )
    defaults.update(overrides)
    return Settings(**defaults)


def test_mock_enabled_when_no_keys_configured():
    settings = make_settings(razorpay_key_id="", razorpay_key_secret="")
    assert settings.razorpay_configured is False
    assert settings.payment_mock_enabled is True


def test_mock_enabled_in_dev_with_real_keys_and_test_mode_on():
    settings = make_settings(
        environment="development",
        razorpay_key_id="rzp_test_x",
        razorpay_key_secret="secret",
        payment_test_mode=True,
    )
    assert settings.razorpay_configured is True
    assert settings.payment_mock_enabled is True


def test_real_gateway_used_in_dev_when_test_mode_off():
    settings = make_settings(
        environment="development",
        razorpay_key_id="rzp_test_x",
        razorpay_key_secret="secret",
        payment_test_mode=False,
    )
    assert settings.payment_mock_enabled is False


def test_production_never_mocks_even_if_test_mode_flag_left_on():
    """Critical safety guarantee: a forgotten PAYMENT_TEST_MODE=true must never
    fake a real charge in production."""
    settings = make_settings(
        environment="production",
        razorpay_key_id="rzp_live_x",
        razorpay_key_secret="secret",
        payment_test_mode=True,
    )
    assert settings.razorpay_configured is True
    assert settings.payment_mock_enabled is False


def test_production_falls_back_to_mock_only_if_no_keys_configured():
    settings = make_settings(
        environment="production",
        razorpay_key_id="",
        razorpay_key_secret="",
        payment_test_mode=True,
    )
    assert settings.payment_mock_enabled is True
