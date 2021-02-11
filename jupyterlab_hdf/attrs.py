# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import hobjAttrsDict, jsonize

__all__ = ['HdfAttrsManager', 'HdfAttrsHandler']

## manager
class HdfAttrsManager(HdfFileManager):
    """Implements HDF5 attributes handling"""

    def _getResponse(self, hobj, **kwargs):
        return jsonize(hobjAttrsDict(hobj))


## handler
class HdfAttrsHandler(HdfBaseHandler):
    """A handler for HDF5 attributes"""

    managerClass = HdfAttrsManager
