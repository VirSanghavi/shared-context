"""Python SDK for the Axis Context Protocol.

Thin, typed wrapper over the hosted Axis REST API (https://useaxis.dev/api/v1).
Use it to run the same hybrid code search and agentic deep-search your MCP
agents use, and to pull a context mirror for LLM prompts.
"""

import os
import requests

__version__ = "1.0.1"

DEFAULT_BASE_URL = "https://useaxis.dev/api/v1"


class AxisError(Exception):
    """Raised when the Axis API returns a non-success response."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class RateLimitError(AxisError):
    """Raised on HTTP 429. ``retry_after`` is seconds to wait, if provided."""

    def __init__(self, message, status_code=429, retry_after=None):
        super().__init__(message, status_code)
        self.retry_after = retry_after


class Axis:
    """The main client for interacting with the Axis Context Protocol."""

    def __init__(self, api_key=None, base_url=DEFAULT_BASE_URL):
        self.api_key = api_key or os.environ.get("AXIS_API_KEY")
        self.base_url = base_url.rstrip("/")
        if not self.api_key:
            raise ValueError(
                "AXIS_API_KEY is required. Pass it to the constructor or set it "
                "as an environment variable."
            )

    # -- internals ---------------------------------------------------------

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method, path, *, params=None, json=None):
        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(
                method, url, params=params, json=json, headers=self._headers(), timeout=60
            )
        except requests.RequestException as e:
            raise AxisError(f"Network error contacting Axis: {e}")

        if resp.status_code == 429:
            retry = resp.headers.get("Retry-After")
            raise RateLimitError(
                "Rate limited by Axis.",
                retry_after=int(retry) if retry and retry.isdigit() else None,
            )
        if not resp.ok:
            raise AxisError(_safe_error(resp), status_code=resp.status_code)
        return resp.json() if resp.content else {}

    # -- search ------------------------------------------------------------

    def search(self, query, project_name="default"):
        """Hybrid code search (semantic + full-text + trigram), reranked.

        Returns the full payload: ``results`` (ranked hits with file:line),
        ``related`` (files that historically co-change) and ``definitions``
        (symbols a top hit calls).
        """
        return self._request(
            "POST", "/search", json={"query": query, "projectName": project_name}
        )

    def deep_search(self, query, project_name="default"):
        """Agentic answer engine — reads across files and returns a cited answer.

        Returns a dict with ``answer``, ``citations`` and ``queriesRun``.
        """
        return self._request(
            "POST", "/deep-search", json={"query": query, "projectName": project_name}
        )

    # -- context mirror ----------------------------------------------------

    def get_mirror(self, path="."):
        """Retrieve the high-fidelity context mirror for a given path."""
        data = self._request("GET", "/context/mirror", params={"path": path})
        return AxisMirror(data)

            "action": action
        }
        try:
            response = requests.post(
                f"{self.base_url}/governance/check", 
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            return response.json().get("allowed", False)
        except Exception as e:
            print(f"Axis Governance Error: {e}")
            return False

class AxisMirror:
    def __init__(self, data):
        self.raw = data
        self.nodes = [AxisNode(n) for n in data.get("nodes", [])]
        self.metadata = data.get("metadata", {})

    def to_prompt(self):
        """
        Converts the mirror into a condensed text block for LLM prompts.
        """
        output = "Axis Context Mirror:\n"
        for node in self.nodes:
            output += f"- {node.path} ({node.type})\n"
        return output

class AxisNode:
    def __init__(self, node_data):
        self.path = node_data.get("path") or node_data.get("name")
        self.type = node_data.get("type")
        self.size = node_data.get("size", 0)
        self.last_modified = node_data.get("last_modified")
