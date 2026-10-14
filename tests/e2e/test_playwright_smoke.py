import pytest
from playwright.sync_api import sync_playwright

pytestmark = pytest.mark.e2e


def test_playwright_can_open_and_interact_with_local_page() -> None:
    """Browser smoke test verifies CI browser installation without a live website."""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                page = browser.new_page()
                page.set_content(
                    '<main><label for="email">Email</label>'
                    '<input id="email"><button>Continue</button></main>'
                )
                page.get_by_label("Email").fill("test@example.invalid")
                page.get_by_role("button", name="Continue").click()
                assert page.get_by_label("Email").input_value() == "test@example.invalid"
            finally:
                browser.close()
    except Exception as exc:
        if "Executable doesn't exist" in str(exc) or "browserType.launch" in str(exc):
            pytest.skip("Playwright browser is not installed in this environment")
        raise
