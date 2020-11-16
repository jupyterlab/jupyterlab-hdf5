# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py

from .baseHandler import HdfBaseManager, HdfBaseHandler

__all__ = ['HdfSnippetManager', 'HdfSnippetHandler']

## snippet templates
dsetTemp = '''with h5py.File('{fpath}', 'r') as f:
    data = f['{uri}']'''


## manager
class HdfSnippetManager(HdfBaseManager):
    """Implements HDF5 contents handling
    """
    def _get(self, fpath, uri, ixstr, **kwargs):
        return dsetTemp.format(fpath=fpath, uri=uri)


## handler
class HdfSnippetHandler(HdfBaseHandler):
    """A handler for HDF5 contents
    """
    managerClass = HdfSnippetManager
