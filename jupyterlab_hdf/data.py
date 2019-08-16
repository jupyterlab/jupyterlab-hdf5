""" jupyterLab_hdf : HDF5 api for Jupyter/Jupyterlab

Copyright (c) Max Klein.
Distributed under the terms of the Modified BSD License.
"""

from .baseHandler import HdfBaseManager, HdfBaseHandler
from .util import dsetChunk

__all__ = ['HdfDataManager', 'HdfDataHandler']


## manager
class HdfDataManager(HdfBaseManager):
    """Implements HDF5 data handling
    """
    def _get(self, f, uri, row, col):
        return dsetChunk(f[uri], row, col)


## handler
class HdfDataHandler(HdfBaseHandler):
    """A handler for HDF5 data
    """
    managerClass = HdfDataManager
