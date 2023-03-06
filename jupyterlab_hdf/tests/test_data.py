import h5py
import os
import numpy as np
from jupyterlab_hdf.tests.utils import ServerTest


SCALAR = np.int32(56)
ONE_D = np.arange(0, 11, dtype=np.int64)
TWO_D = np.arange(0, 10, dtype=np.float64).reshape(2, 5) / 10.0
THREE_D = np.arange(0, 24, dtype=np.int64).reshape(2, 3, 4)
COMPLEX = np.array([1 + 1j, 1 + 2j, 2 + 2j, -5j, 5], dtype=complex)


class TestData(ServerTest):
    def setUp(self):
        super().setUp()

        with h5py.File(os.path.join(self.notebook_dir, "test_file.h5"), "w") as h5file:
            h5file["oneD_dataset"] = ONE_D
            h5file["twoD_dataset"] = TWO_D
            h5file["threeD_dataset"] = THREE_D
            h5file["complex"] = COMPLEX
            h5file["scalar"] = SCALAR
            h5file["empty"] = h5py.Empty(">f8")

    def test_oneD_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/oneD_dataset"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == ONE_D.tolist()

    def test_twoD_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/twoD_dataset"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == TWO_D.tolist()

    def test_threeD_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/threeD_dataset"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == THREE_D.tolist()

    def test_sliced_threeD_dataset(self):
        ixstr = ":,1:3, 2"
        sliced_dataset = THREE_D[:, 1:3, 2]
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/threeD_dataset", "ixstr": ixstr})

        assert response.status_code == 200
        payload = response.json()
        assert payload == sliced_dataset.tolist()

    def test_complex_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/complex"})

        assert response.status_code == 200
        payload = response.json()
        # Complex are serialized as double-value array
        assert payload == [[c.real, c.imag] for c in COMPLEX]

    def test_complex_dataset_at_least2d(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/complex", "min_ndim": 2, "ixstr": "0:2"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == [[[1, 1]], [[1, 2]]]

    def test_scalar_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/scalar"})

        assert response.status_code == 200
        payload = response.json()
        assert payload == SCALAR

    def test_scalar_dataset_at_least2d(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/scalar", "min_ndim": 2})

        assert response.status_code == 200
        payload = response.json()
        assert payload == [[SCALAR]]

    def test_empty_dataset(self):
        response = self.tester.get(["data", "test_file.h5"], params={"uri": "/empty"})

        assert response.status_code == 200
        payload = response.json()
        assert payload is None
