# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import dsetChunk

__all__ = ['HdfDataManager', 'HdfDataHandler']


## manager
class HdfDataManager(HdfFileManager):
    """Implements HDF5 data handling
    """
    def _getFromFile(self, f, uri, ixstr, subixstr=None, atleast_2d=False, **kwargs):
        # # DEBUG: uncomment for logging
        # from .util import dsetContentDict, parseSubindex
        # logd = dsetContentDict(f[uri], ixstr=ixstr)
        # logd['subixstr'] = subixstr
        # if subixstr is not None:
        #     logd['ixcompound'] = parseSubindex(ixstr, subixstr, f[uri].shape)
        # self.log.info('{}'.format(logd))

        return dsetChunk(f[uri], ixstr, subixstr=subixstr, atleast_2d=atleast_2d).tolist()


## handler
class HdfDataHandler(HdfBaseHandler):
    """A handler for HDF5 data
    """
    managerClass = HdfDataManager
