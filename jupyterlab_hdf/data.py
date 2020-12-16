# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import dsetChunk, jsonize

__all__ = ['HdfDataManager', 'HdfDataHandler']

## manager
class HdfDataManager(HdfFileManager):
    """Implements HDF5 data handling
    """
    def _getFromFile(self, f, uri, ixstr=None, subixstr=None, min_ndim=None, **kwargs):
        # # DEBUG: uncomment for logging
        # from .util import dsetContentDict, parseSubindex
        # logd = dsetContentDict(f[uri], ixstr=ixstr)
        # logd['subixstr'] = subixstr
        # if subixstr is not None:
        #     logd['ixcompound'] = parseSubindex(ixstr, subixstr, f[uri].shape)
        # self.log.info('{}'.format(logd))

        return jsonize(dsetChunk(f[uri], ixstr=ixstr, subixstr=subixstr, min_ndim=min_ndim))

## handler
class HdfDataHandler(HdfBaseHandler):
    """A handler for HDF5 data
    """
    managerClass = HdfDataManager
