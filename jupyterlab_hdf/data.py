""" jupyterLab_hdf : HDF5 api for Jupyter/Jupyterlab

Copyright (c) Max Klein.
Distributed under the terms of the Modified BSD License.
"""

import h5py
import json
import os
from tornado import gen
from tornado.httpclient import HTTPError

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

# from .config import HdfConfig
from .util import dsetChunk

__all__ = ['HdfDataManager', 'HdfDataHandler']

## the actual hdf contents handling
def getHdfData(obj, uri, row, col):
    return dsetChunk(uri, row, col)


## manager
class HdfDataManager:
    """Implements HDF5 data handling
    """
    def __init__(self, notebook_dir):
        self.notebook_dir = notebook_dir

    def get(self, path, uri, row, col):
        def _handleErr(code, msg):
            raise HTTPError(code, '\n'.join((
                msg,
                f'fpath: {path}, uri: {uri}, row: {row}, col: {col}'
            )))

        if not path:
            msg = f'The request was malformed; fpath should not be empty.'
            _handleErr(400, msg)

        if row and not col:
            msg = f'The request was malformed; row slice was specified, but col slice was empty.'
            _handleErr(400, msg)

        if col and not row:
            msg = f'The request was malformed; col slice was specified, but row slice was empty.'
            _handleErr(400, msg)

        fpath = url_path_join(self.notebook_dir, path)

        if not os.path.exists(fpath):
            msg = f'The request specified a file that does not exist.'
            _handleErr(403, msg)
        else:
            try:
                # test opening the file with h5py
                with h5py.File(fpath, 'r') as f: pass
            except Exception as e:
                msg = (f'The request did not specify a file that `h5py` could understand.\n'
                       f'Error: {e}')
                _handleErr(401, msg)
            try:
                with h5py.File(fpath, 'r') as f:
                    out = getHdfData(f[uri], uri, row, col)
            except Exception as e:
                msg = (f'Found and opened file, error getting contents from object specified by the uri.\n'
                       f'Error: {e}')
                _handleErr(500, msg)

            return out


## handler
class HdfDataHandler(APIHandler):
    """A handler for HDF5 contents
    """
    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir
        self.dataset_manager = HdfDataManager(notebook_dir=notebook_dir)

    @gen.coroutine
    def get(self, path):
        """Based on an api request, get either the contents of a group or a
        slice of a dataset and return it as serialized JSON.
        """
        uri = '/' + self.get_query_argument('uri').lstrip('/')
        row = [int(x) for x in self.get_query_arguments('row')]
        col = [int(x) for x in self.get_query_arguments('col')]

        try:
            self.finish(json.dumps(self.dataset_manager.get(path, uri, row, col)))

        except HTTPError as err:
            self.set_status(err.code)
            response = err.response.body if err.response else str(err.code)
            self.finish('\n'.join((
                response,
                err.message
            )))
