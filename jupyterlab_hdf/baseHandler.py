# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import h5py
# import json
import os
from tornado import gen
from tornado.httpclient import HTTPError
import simplejson

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

# from .config import HdfConfig

__all__ = ['HdfBaseManager', 'HdfBaseHandler']


## manager
class HdfBaseManager:
    """Base class for implementing HDF5 handling
    """
    def __init__(self, notebook_dir):
        self.notebook_dir = notebook_dir

    def _get(self, f, uri, select):
        raise NotImplementedError

    def get(self, relfpath, uri, select):
        def _handleErr(code, msg):
            raise HTTPError(code, '\n'.join((
                msg,
                f'relfpath: {relfpath}, uri: {uri}, select: {select}'
            )))

        if not relfpath:
            msg = f'The request was malformed; fpath should not be empty.'
            _handleErr(400, msg)

        fpath = url_path_join(self.notebook_dir, relfpath)

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
                    out = self._get(f, uri, select)
            except Exception as e:
                msg = (f'Found and opened file, error getting contents from object specified by the uri.\n'
                       f'Error: {e}')
                _handleErr(500, msg)

            return out

## handler
class HdfBaseHandler(APIHandler):
    managerClass = None

    """Base class for HDF5 api handlers
    """
    def initialize(self, notebook_dir):
        if self.managerClass is None:
            raise NotImplementedError

        self.notebook_dir = notebook_dir
        self.manager = self.managerClass(notebook_dir=notebook_dir)

    @gen.coroutine
    def get(self, path):
        """Based on an api request, get either the contents of a group or a
        selected hyperslab of a dataset and return it as serialized JSON.
        """
        uri = '/' + self.get_query_argument('uri').lstrip('/')
        select = self.get_query_argument('select', default=None)
        try:
            self.finish(simplejson.dumps(self.manager.get(path, uri, select), ignore_nan=True))
        except HTTPError as err:
            self.set_status(err.code)
            response = err.response.body if err.response else str(err.code)
            self.finish('\n'.join((
                response,
                err.message
            )))
