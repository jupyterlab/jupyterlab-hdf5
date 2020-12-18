import h5py
import os
import numpy as np
from jupyterlab_hdf.tests.utils import ServerTest

ONE_D = np.arange(0, 11, dtype=np.int64)
TWO_D = np.arange(0, 10, dtype=np.float64).reshape(2, 5) / 10.
THREE_D = np.arange(0, 24, dtype=np.int64).reshape(2, 3, 4)


class TestData(ServerTest):
    def setUp(self):
        super().setUp()

        with h5py.File(os.path.join(self.notebook_dir, 'test_file.h5'), 'w') as h5file:
            h5file['oneD_dataset'] = ONE_D
            h5file['twoD_dataset'] = TWO_D
            h5file['threeD_dataset'] = THREE_D

    def test_oneD_dataset(self):
        response = self.tester.get(['data', 'test_file.h5'], params={'uri': '/oneD_dataset'})

        assert response.status_code == 200
        payload = response.json()
        assert payload == ONE_D.tolist()

    def test_twoD_dataset(self):
        response = self.tester.get(['data', 'test_file.h5'], params={'uri': '/twoD_dataset'})

        assert response.status_code == 200
        payload = response.json()
        assert payload == TWO_D.tolist()

    def test_threeD_dataset(self):
        response = self.tester.get(['data', 'test_file.h5'], params={'uri': '/threeD_dataset'})

        assert response.status_code == 200
        payload = response.json()
        assert payload == THREE_D.tolist()

    def test_sliced_threeD_dataset(self):
        ixstr = ':,1:3, 2'
        sliced_dataset = THREE_D[:, 1:3, 2]
        response = self.tester.get(['data', 'test_file.h5'], params={'uri': '/threeD_dataset', 'ixstr': ixstr})

        assert response.status_code == 200
        payload = response.json()
        assert payload == sliced_dataset.tolist()
