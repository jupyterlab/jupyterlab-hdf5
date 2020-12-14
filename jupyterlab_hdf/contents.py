# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import hobjContentsDict, jsonize, uriJoin, uriName

__all__ = ['HdfContentsManager', 'HdfContentsHandler']

## manager
class HdfContentsManager(HdfFileManager):
    """Implements HDF5 contents handling
    """
    def _getFromFile(self, f, uri, ixstr=None, min_ndim=None, **kwargs):
        hobj = f[uri]

        if isinstance(hobj, h5py.Group):
            # recurse one level
            return [
                jsonize(hobjContentsDict(
                    subhobj,
                    content=False,
                    ixstr=ixstr,
                    min_ndim=min_ndim,
                ))
                for subhobj in hobj.values()
            ]
        else:
            return jsonize(hobjContentsDict(
                hobj,
                content=True,
                ixstr=ixstr,
                min_ndim=min_ndim,
            ))

## handler
class HdfContentsHandler(HdfBaseHandler):
    """A handler for HDF5 contents
    """
    managerClass = HdfContentsManager
