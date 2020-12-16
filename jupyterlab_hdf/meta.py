# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import hobjMetaDict, jsonize

__all__ = ['HdfMetaManager', 'HdfMetaHandler']

## manager
class HdfMetaManager(HdfFileManager):
    """Implements HDF5 metadata handling
    """
    def _getFromFile(self, f, uri, ixstr=None, min_ndim=None, **kwargs):
        return jsonize(hobjMetaDict(f[uri], ixstr=ixstr, min_ndim=min_ndim))

## handler
class HdfMetaHandler(HdfBaseHandler):
    """A handler for HDF5 metadata
    """
    managerClass = HdfMetaManager
