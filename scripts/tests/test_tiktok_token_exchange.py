"""The diagnostic must never disclose OAuth credentials, including in API errors."""
import contextlib
import io
import os
from pathlib import Path
import runpy
import types
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).resolve().parents[2] / "tiktok_token_exchange.py"


class TokenExchangeOutputTests(unittest.TestCase):
    def run_exchange(self, exchange_succeeds):
        credentials = {
            "access_token": "fake-access-token-for-output-test",
            "refresh_token": "fake-refresh-token-for-output-test",
            "auth_code": "fake-auth-code-for-output-test",
            "secret": "fake-client-secret-for-output-test",
        }
        # Deliberately make TikTok's human-readable message contain credentials.
        # Only safe status fields, not third-party messages, may be logged.
        message = " ".join(credentials.values())
        body = {
            "code": 0 if exchange_succeeds else 40001,
            "message": message,
            "data": {
                "access_token": credentials["access_token"],
                "refresh_token": credentials["refresh_token"],
                "advertiser_ids": ["test-advertiser"],
                "scope": [],
            } if exchange_succeeds else {},
        }
        requests = types.ModuleType("requests")
        requests.post = Mock(return_value=types.SimpleNamespace(
            status_code=200, json=lambda: body,
        ))
        requests.get = Mock(return_value=types.SimpleNamespace(
            status_code=200, json=lambda: {"code": 0, "message": message, "data": {"list": []}},
        ))
        requests.exceptions = types.SimpleNamespace(RequestException=RuntimeError)
        dotenv = types.ModuleType("dotenv")
        dotenv.load_dotenv = Mock()
        output = io.StringIO()
        with patch.dict(os.environ, {
            "TIKTOK_ADS_APP_ID": "fake-app-id",
            "TIKTOK_ADS_SECRET": credentials["secret"],
        }, clear=True), patch.dict("sys.modules", {"requests": requests, "dotenv": dotenv}), \
                patch("getpass.getpass", return_value=credentials["auth_code"]), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                runpy.run_path(str(SCRIPT), run_name="__main__")
            except SystemExit as exc:
                self.assertFalse(exchange_succeeds)
                self.assertEqual(str(exc), "No token returned.")
        for value in credentials.values():
            self.assertNotIn(value, output.getvalue())
        return output.getvalue(), requests

    def test_success_uses_token_only_in_memory(self):
        output, requests = self.run_exchange(True)
        self.assertIn("were not saved", output)
        self.assertEqual(requests.get.call_args.kwargs["headers"]["Access-Token"],
                         "fake-access-token-for-output-test")

    def test_error_response_does_not_echo_remote_message(self):
        _, requests = self.run_exchange(False)
        requests.get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
