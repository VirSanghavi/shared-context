
import requests
import json
import os

class AxisMirror:
    def __init__(self, api_key=None, base_url="https://api.axis.sh/v1"):
        self.api_key = api_key or os.environ.get("AXIS_API_KEY")
        self.base_url = base_url
        if not self.api_key:
            print("Warning: AXIS_API_KEY is not set.")

    def get_mirror(self, path="."):
        """
        Retrieves the high-fidelity context mirror for a given path.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.get(
                f"{self.base_url}/context/mirror", 
                params={"path": path},
                headers=headers
            )
            response.raise_for_status()
            return AxisMirrorResponse(response.json())
        except Exception as e:
            print(f"Error fetching mirror: {e}")
            return None

    def sync_mapping(self, mapping_file=".axis/mapping.json"):
        """
        Syncs the local governance mapping with the remote Axis brain.
        """
        print(f"Syncing governance mapping from {mapping_file}...")
        # Mock implementation for the SDK
        return {"status": "synced", "rules_applied": 12}

class AxisMirrorResponse:
    def __init__(self, data):
        self.raw = data
        self.nodes = [AxisNode(n) for n in data.get("nodes", [])]
        self.metadata = data.get("metadata", {})

class AxisNode:
    def __init__(self, node_data):
        self.name = node_data.get("name")
        self.type = node_data.get("type")
        self.size = node_data.get("size")
