# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import jsonize

__all__ = ["HdfContentsManager", "HdfContentsHandler"]

## manager
class HdfContentsManager(HdfFileManager):
    """Implements HDF5 contents handling"""

    def _getResponse(self, entity, ixstr=None, min_ndim=None, **kwargs):
        return entity.contents(content=True, ixstr=ixstr, min_ndim=min_ndim)


## handler
class HdfContentsHandler(HdfBaseHandler):
    """A handler for HDF5 contents"""

    managerClass = HdfContentsManager
