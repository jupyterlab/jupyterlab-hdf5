""" JupyterLab HDF : HDF5 file viewer for Jupyterlab """

from collections import namedtuple
import h5py
import json
import os
import re
from tornado import gen, web

from notebook.base.handlers import APIHandler

# from .config import HdfConfig

MetaHdf = namedtuple('Meta', ('kind', 'name', 'uri'))

def apiSplit(apipath):
    return apipath.split('::')

_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))


## eagerly get metadata
def getMetaHdf(group, prefix='/'):
    return [MetaHdf(
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
    return (MetaHdf(
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
class HdfMetadataHandler(APIHandler):
    """A handler that runs LaTeX on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir

    @web.authenticated
    @gen.coroutine
    def get(self, apipath=''):
        """Given a path, fetch HDF metadata and respond when done.
        """
        # Parse the apipath into the file path and uri
        relpath,uri = apiSplit(apipath)
        path = os.path.join(self.notebook_dir, relpath)

        if not os.path.exists(path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{path}`."
        else:
            try:
                # test opening the file with h5py
                with h5py.File(path, 'r') as f: pass
            finally:
                self.set_status(400)
                out = (f"The file at `{path}` could not be opened by h5py.")
                self.finish(out)

            try:
                with h5py.File(path, 'r') as f:
                    meta = getMetaHdf(f[uri], uri)
            finally:
                self.set_status(500)
                out = (f"Opened the file at `{path}` but could not retrieve valid metadata.")
                self.finish(out)

            out = json.dumps(meta)
        self.finish(out)
