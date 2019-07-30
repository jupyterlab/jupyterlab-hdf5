import h5py
import json
import os
from tornado import gen
from tornado.httpclient import HTTPError

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

# from .config import HdfConfig

def datasetDict(data):
    return dict([
        ('data', data)
    ])

def getDatasetHdf(dset, rslice, cslice):
    return [datasetDict(dset[rslice, cslice].tolist())]

class HdfDatasetManager:
    """Implements HDF5 dataset data/error handling
    """
    def __init__(self, notebook_dir):
        self.notebook_dir = notebook_dir

    def get(self, path, uri, row, col):
        def _handleErr(code, msg, path, uri, row, col):
            raise HTTPError(code, '\n'.join((
                msg,
                f'fpath: {path}, uri: {uri}, row: {row}, col: {col}'
            )))

        if not path:
            msg = f'The request was malformed; fpath should not be empty.'
            _handleErr(400, msg, path, uri, row, col)

        fpath = url_path_join(self.notebook_dir, path)

        if not os.path.exists(fpath):
            msg = f'Request cannot be completed; no file at fpath.'
            _handleErr(403, msg, path, uri, row, col)
        else:
            try:
                # test opening the file with h5py
                with h5py.File(fpath, 'r') as f: pass
            except Exception as e:
                msg = (f'The file at fpath could not be opened by h5py.\n'
                       f'Error: {e}')
                _handleErr(401, msg, path, uri, row, col)
            try:
                with h5py.File(fpath, 'r') as f:
                    out = getDatasetHdf(f[uri], slice(*row), slice(*col))
            except Exception as e:
                msg = (f'Opened the file at fpath but could not retrieve valid dataset from {uri}.\n'
                       f'Error: {e}')
                _handleErr(500, msg, path, uri, row, col)

            return out

class HdfDatasetHandler(APIHandler):
    """A handler for HDF5 datasets
    """
    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir
        self.dataset_manager = HdfDatasetManager(notebook_dir=notebook_dir)

    @gen.coroutine
    def get(self, path):
        """Get a slice of a dataset based on an api request and return it as
        serialized JSON.
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
