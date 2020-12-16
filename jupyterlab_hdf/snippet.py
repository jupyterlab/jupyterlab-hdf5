# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py

from .baseHandler import HdfBaseManager, HdfBaseHandler
from .util import hobjType

__all__ = ['HdfSnippetManager', 'HdfSnippetHandler']

## snippet templates
dsetTemplate = '''with h5py.File('{fpath}', 'r') as f:
    dataset = f['{uri}']'''

groupTemplate = '''with h5py.File('{fpath}', 'r') as f:
    group = f['{uri}']'''

ixTemplate = '''[{ixstr}]'''

## manager
class HdfSnippetManager(HdfBaseManager):
    """Implements HDF5 contents handling
    """
    def _get(self, fpath, uri, ixstr=None, subixstr=None, **kwargs):
        with h5py.File(fpath, 'r') as f:
            tipe = hobjType(f[uri])

        if tipe == 'dataset':
            return ''.join((
                dsetTemplate.format(fpath=fpath, uri=uri),
                ixTemplate.format(ixstr=ixstr) if ixstr is not None else '',
                ixTemplate.format(ixstr=subixstr) if ixstr is not None and subixstr is not None else '',
            ))
        elif tipe == 'group':
            return groupTemplate.format(fpath=fpath, uri=uri)
        else:
            raise ValueError('the `hdf/snippet` endpoint currently only supports Dataset and Group objects')

## handler
class HdfSnippetHandler(HdfBaseHandler):
    """A handler for HDF5 contents
    """
    managerClass = HdfSnippetManager
