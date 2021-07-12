import h5py
import os
import numpy as np
from jupyterlab_hdf.tests.utils import ServerTest


class TestContents(ServerTest):
    def setUp(self):
        super().setUp()

        with h5py.File(os.path.join(self.notebook_dir, "test_file.h5"), "w") as h5file:
            # Empty group
            h5file.create_group("empty_group")

            # Group with 2 children
            grp = h5file.create_group("group_with_children")
            # A simple dataset
            grp["dataset_1"] = np.random.random((2, 3, 4))
            # and a group
            grp.create_group("nested_group")

    def test_empty_group(self):
        response = self.tester.get(["contents", "test_file.h5"], params={"uri": "/empty_group"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == []

    def test_group_with_children(self):
        response = self.tester.get(["contents", "test_file.h5"], params={"uri": "/group_with_children"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == [
            dict((("name", "dataset_1"), ("type", "dataset"), ("uri", "/group_with_children/dataset_1"))),
            dict((("name", "nested_group"), ("type", "group"), ("uri", "/group_with_children/nested_group"))),
        ]

    def test_full_dataset(self):
        uri = "/group_with_children/dataset_1"
        response = self.tester.get(["contents", "test_file.h5"], params={"uri": uri})

        assert response.status_code == 200
        payload = response.json()
        assert payload == dict(
            (
                ("name", "dataset_1"),
                ("type", "dataset"),
                ("uri", uri),
                (
                    "content",
                    dict(
                        (
                            ("attributes", []),
                            ("dtype", "<f8"),
                            ("labels", [{"start": 0, "step": 1, "stop": 2}, {"start": 0, "step": 1, "stop": 3}, {"start": 0, "step": 1, "stop": 4}]),
                            ("name", "dataset_1"),
                            ("ndim", 3),
                            ("shape", [2, 3, 4]),
                            ("size", 24),
                            ("type", "dataset"),
                        )
                    ),
                ),
            )
        )
