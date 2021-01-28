"""Helpers for tests"""

import json
from typing import List
from traitlets.config import Config

from notebook.tests.launchnotebook import NotebookTestBase as ServerTestBase
from notebook.utils import url_path_join

NS = "/hdf"


class APITester(object):
    """Wrapper for REST API requests"""

    url = "/hdf"

    def __init__(self, request):
        self.request = request

    def _req(self, verb: str, path: List[str], body=None, params=None):
        if body is not None:
            body = json.dumps(body)
        response = self.request(
            verb, url_path_join(self.url, *path), data=body, params=params
        )

        if 400 <= response.status_code < 600:
            try:
                response.reason = response.json()["message"]
            except Exception:
                pass
        response.raise_for_status()

        return response

    def get(self, path: List[str], body=None, params=None):
        return self._req("GET", path, body, params)


class ServerTest(ServerTestBase):

    # Force extension enabling - Disabled by parent class otherwise
    config = Config({"NotebookApp": {"nbserver_extensions": {"jupyterlab_hdf": True}}})

    def setUp(self):
        super(ServerTest, self).setUp()
        self.tester = APITester(self.request)
