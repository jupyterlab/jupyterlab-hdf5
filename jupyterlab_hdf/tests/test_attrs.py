import h5py
import numpy as np
import os
from jupyterlab_hdf.tests.utils import ServerTest


class TestAttrs(ServerTest):
    def setUp(self):
        super().setUp()

        with h5py.File(os.path.join(self.notebook_dir, "test_file.h5"), "w") as h5file:
            # Group with no attributes
            h5file.create_group("group_without_attrs")

            # Group with simple attributes
            attr_grp = h5file.create_group("group_with_attrs")
            attr_grp.attrs["string_attr"] = "I am a group"
            attr_grp.attrs["number_attr"] = 5676
            attr_grp.attrs["float64_attr"] = np.float64(3.1417)

            # Dataset with non-simple attributes
            attr_dset = h5file.create_dataset("dataset_with_attrs", shape=())
            attr_dset.attrs["bool_attr"] = False
            attr_dset.attrs["list_attr"] = [0, 1, 2]
            attr_dset.attrs["complex_attr"] = 1 + 2j

    def test_group_without_attrs(self):
        response = self.tester.get(["attrs", "test_file.h5"], params={"uri": "/group_without_attrs"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == {}

    def test_group_with_simple_attrs(self):
        response = self.tester.get(["attrs", "test_file.h5"], params={"uri": "/group_with_attrs"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == {"string_attr": "I am a group", "number_attr": 5676, "float64_attr": 3.1417}

    def test_dset_with_non_simple_attrs(self):
        response = self.tester.get(["attrs", "test_file.h5"], params={"uri": "/dataset_with_attrs"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == {'bool_attr': False, 'list_attr': [0, 1, 2], 'complex_attr': [1, 2]}

    def test_one_attr_from_group(self):
        response = self.tester.get(["attrs", "test_file.h5"], params={"uri": "/group_with_attrs", "attr_keys": "string_attr"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == {"string_attr": "I am a group"}

    def test_two_attr_from_dset(self):
        response = self.tester.get(["attrs", "test_file.h5"], params={"uri": "/dataset_with_attrs", "attr_keys": ["bool_attr", "list_attr"]})

        assert response.status_code == 200
        payload = response.json()
        assert payload == {"bool_attr": False, "list_attr": [0, 1, 2]}
