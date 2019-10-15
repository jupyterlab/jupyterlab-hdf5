# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfBaseManager, HdfBaseHandler
from .util import dsetChunk

__all__ = ['HdfDataManager', 'HdfDataHandler']


## manager
class HdfDataManager(HdfBaseManager):
    """Implements HDF5 data handling
    """
    def _get(self, f, uri, select):
        return dsetChunk(f[uri], select)


## handler
class HdfDataHandler(HdfBaseHandler):
    """A handler for HDF5 data
    """
    managerClass = HdfDataManager
