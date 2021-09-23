import h5py
import numpy as np
import os
from jupyterlab_hdf.tests.utils import ServerTestWithLinkResolution


class TestMetaWithLinkResolution(ServerTestWithLinkResolution):
    def setUp(self):
        super().setUp()

        with h5py.File(os.path.join(self.notebook_dir, "target_file.h5"), "w") as h5file:
            # Group with 2 children
            grp = h5file.create_group("group_with_children")
            # A simple dataset
            grp["dataset_1"] = np.random.random((2, 3, 4))
            # and a group with attributes
            attr_grp = grp.create_group("group_with_attrs")
            attr_grp.attrs["array_attr"] = np.arange(0, 1, 0.1, dtype=">f4")
            attr_grp.attrs["bool_attr"] = True
            attr_grp.attrs["complex_attr"] = np.complex64(1 + 2j)
            attr_grp.attrs["number_attr"] = np.int32(5676)
            attr_grp.attrs["string_attr"] = "I am a group"

        with h5py.File(os.path.join(self.notebook_dir, "test_file.h5"), "w") as h5file:
            h5file["scalar"] = 56

            h5file["soft"] = h5py.SoftLink("/scalar")
            h5file["broken_soft"] = h5py.SoftLink("/not_existing")

            h5file["broken_external"] = h5py.ExternalLink("target_file.h5", "/not/a/path")
            h5file["external"] = h5py.ExternalLink("target_file.h5", "/group_with_children")

    def test_broken_external_link(self):
        response = self.tester.get(["meta", "test_file.h5"], params={"uri": "/broken_external"})

        assert response.status_code == 200
        payload = response.json()

        assert payload == dict((("name", "broken_external"), ("targetFile", "target_file.h5"), ("targetUri", "/not/a/path"), ("type", "external_link")))

    def test_working_external_link(self):
        response = self.tester.get(["meta", "test_file.h5"], params={"uri": "/external"})

        assert response.status_code == 200
        payload = response.json()
        assert payload["name"] == "external"
        assert payload["type"] == "group"
        assert payload["attributes"] == []
        assert payload["children"] == [
            {"name": "dataset_1", "dtype": "<f8", "type": "dataset", "shape": [2, 3, 4], "attributes": []},
            {
                "name": "group_with_attrs",
                "type": "group",
                "attributes": [
                    {"name": "array_attr", "dtype": ">f4", "shape": [10]},
                    {"name": "bool_attr", "dtype": "|b1", "shape": []},
                    {"name": "complex_attr", "dtype": "<c8", "shape": []},
                    {"name": "number_attr", "dtype": "<i4", "shape": []},
                    {"name": "string_attr", "dtype": "|O", "shape": []},
                ],
            },
        ]

    def test_broken_soft_link(self):
        response = self.tester.get(["meta", "test_file.h5"], params={"uri": "/broken_soft"})

        assert response.status_code == 200
        payload = response.json()

        assert payload == dict((("name", "broken_soft"), ("targetUri", "/not_existing"), ("type", "soft_link")))

    def test_working_soft_link(self):
        response = self.tester.get(["meta", "test_file.h5"], params={"uri": "/soft"})

        assert response.status_code == 200
        payload = response.json()

        assert payload == dict((("attributes", []), ("dtype", "<i8"), ("labels", []), ("name", "soft"), ("ndim", 0), ("shape", []), ("size", 1), ("type", "dataset")))
