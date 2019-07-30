""" jupyterLab_hdf : HDF5 api for Jupyter/Jupyterlab

Copyright (c) Max Klein.
Distributed under the terms of the Modified BSD License.
"""

from collections import namedtuple
import h5py
import json
import os
import re
from tornado import gen, web

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

# from .config import HdfConfig

_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))

MetaHdf = namedtuple('Meta', ('tipe', 'name', 'uri'))

def metaDict(tipe, name, uri):
    return dict([
        ('type', tipe),
        ('name', name),
        ('uri', uri)
    ])


## eagerly get metadata
def getMetaHdf(group, prefix='/'):
    return [metaDict(
        'group' if isinstance(val, h5py.Group) else 'dataset',
        key,
        uriJoin(prefix, key)
    ) for key,val in group.items()]

def getMetaAllHdf(group, prefix='/', meta=None):
    if meta is None: meta = []

    for key,val in group.items():
        uri = uriJoin(prefix, key)
        if isinstance(val, h5py.Group):
            meta.append(MetaHdf('group', key, uri))
            getMetaAllHdf(val, uri, meta)
        else:
            meta.append(MetaHdf('dataset', key, uri))

    return meta


## lazily generate metadata
def genMetaHdf(group, prefix='/'):
    return (metaDict(
        'group' if isinstance(val, h5py.Group) else 'dataset',
        key,
        uriJoin(prefix, key)
    ) for key,val in group.items())

def genMetaAllHdf(group, prefix='/'):
    yield from genMetaHdf(group, prefix)

    for key,val in group.items():
        if isinstance(val, h5py.Group):
            yield from genMetaAllHdf(val, uriJoin(prefix, key))


## handler
class HdfMetaHandler(APIHandler):
    """A handler that runs LaTeX on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir

    @web.authenticated
    @gen.coroutine
    def get(self, path=''):
        """Given a path, fetch HDF metadata and respond when done.
        """
        uri = '/' + self.get_query_argument('uri').lstrip('/')

        if not path:
            self.set_status(400)
            out = (f'The request was malformed; fpath should not be empty. fpath: {path} uri: {uri}')
            self.finish(json.dumps(out))
            return
        fpath = url_path_join(self.notebook_dir, path)

        if not os.path.exists(fpath):
            self.set_status(403)
            out = f'Request cannot be completed; no file at {fpath}.'
            self.finish(json.dumps(out))
            return
        else:
            try:
                # test opening the file with h5py
                with h5py.File(fpath, 'r') as f: pass
            except Exception as e:
                self.set_status(401)
                out = (f'The file at {fpath} could not be opened by h5py.\n'
                       f'Error: {e}')
                self.finish(json.dumps(out))
                return

            try:
                with h5py.File(fpath, 'r') as f:
                    out = getMetaHdf(f[uri], uri)
            except Exception as e:
                self.set_status(500)
                out = (f'Opened the file at {fpath} but could not retrieve valid metadata from {uri}.\n'
                       f'Error: {e}')
                self.finish(json.dumps(out))
                return

        self.finish(json.dumps(out))
        return
