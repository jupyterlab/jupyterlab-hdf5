import h5py
import json
import os
import re
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

class HdfDatasetHandler(APIHandler):
    """A handler for HDF5 datasets
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir

    @gen.coroutine
    def get(self, path):
        """Get a slice of a dataset based on an api request and return it as
        serialized JSON.
        """
        uri = '/' + self.get_query_argument('uri').lstrip('/')
        row = self.get_query_argument('row')
        col = self.get_query_argument('col')

        try:
            if not path:
                msg = f'The request was malformed; fpath should not be empty.'
                raise HTTPError(400, msg)

            fpath = url_path_join(self.notebook_dir, path)

            if not os.path.exists(fpath):
                msg = f'Request cannot be completed; no file at fpath.'
                raise HTTPError(403, msg)
            else:
                try:
                    # test opening the file with h5py
                    with h5py.File(fpath, 'r') as f: pass
                except Exception as e:
                    msg = (f'The file at fpath could not be opened by h5py.\n'
                           f'Error: {e}')
                    raise HTTPError(401, msg)
                try:
                    with h5py.File(fpath, 'r') as f:
                        out = getDatasetHdf(f[uri], slice(*row), slice(*col))
                except Exception as e:
                    msg = (f'Opened the file at fpath but could not retrieve valid metadata from {uri}.\n'
                           f'Error: {e}')
                    raise HTTPError(500, msg)

            self.finish(json.dumps(out))

        except HTTPError as err:
            self.set_status(err.code)
            message = err.response.body if err.response else str(err.code)
            self.finish('\n'.join((
                message,
                f'fpath: {path}, uri: {uri}, row: {row}, col: {col}'
            )))
