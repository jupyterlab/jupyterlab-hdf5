# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import dsetChunk

__all__ = ['HdfDataManager', 'HdfDataHandler']


## manager
class HdfDataManager(HdfFileManager):
    """Implements HDF5 data handling
    """
    def _getFromFile(self, f, uri, row, col):
        return dsetChunk(f[uri], row, col)


## handler
class HdfDataHandler(HdfBaseHandler):
    """A handler for HDF5 data
    """
    managerClass = HdfDataManager
