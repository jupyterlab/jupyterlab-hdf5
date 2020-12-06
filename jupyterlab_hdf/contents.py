# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py

from .baseHandler import HdfFileManager, HdfBaseHandler
from .util import dsetContentDict, groupContentDict, jsonize, uriJoin, uriName

__all__ = ['HdfContentsManager', 'HdfContentsHandler']

## manager
class HdfContentsManager(HdfFileManager):
    """Implements HDF5 contents handling
    """
    def _getFromFile(self, f, uri, ixstr=None, min_ndim=None, **kwargs):
        obj = f[uri]

        if isinstance(obj, h5py.Group):
            return [
                dict((
                    ('content', jsonize(groupContentDict(subobj)) if isinstance(subobj, h5py.Group) else None),
                    ('name', name),
                    ('type', 'group' if isinstance(subobj, h5py.Group) else 'dataset'),
                    ('uri', uriJoin(uri, name)),
                ))
                for name,subobj in obj.items()
            ]
        elif isinstance(obj, h5py.Dataset):
            return dict((
                ('content', jsonize(dsetContentDict(obj, ixstr=ixstr, min_ndim=min_ndim))),
                ('name', uriName(uri)),
                ('type', 'dataset'),
                ('uri', uri),
            ))
        else:
            raise ValueError("unknown h5py obj: %s" % obj)


## handler
class HdfContentsHandler(HdfBaseHandler):
    """A handler for HDF5 contents
    """
    managerClass = HdfContentsManager
