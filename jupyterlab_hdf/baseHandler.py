# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from jupyterlab_hdf.util import jsonize
import h5py
import os
import simplejson
import traceback
from tornado import web
from tornado.httpclient import HTTPError

from .classes import create_entity
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

# from .config import HdfConfig
from .exception import JhdfError

__all__ = ["HdfBaseManager", "HdfFileManager", "HdfBaseHandler"]


## manager
class HdfBaseManager:
    """Base class for implementing HDF5 handling"""

    def __init__(self, log, notebook_dir):
        self.log = log
        self.notebook_dir = notebook_dir

    def _get(self, f, uri, **kwargs):
        raise NotImplementedError

    def get(self, relfpath, uri, **kwargs):
        def _handleErr(code, msg):
            extra = dict(
                (
                    ("relfpath", relfpath),
                    ("uri", uri),
                    *kwargs.items(),
                )
            )

            if isinstance(msg, dict):
                # encode msg as json
                msg["debugVars"] = {**msg.get("debugVars", {}), **extra}
                msg = simplejson.dumps(msg, ignore_nan=True)
            else:
                msg = "\n".join((msg, ", ".join(f"{key}: {val}" for key, val in extra.items())))

            self.log.error(msg)
            raise HTTPError(code, msg)

        if not relfpath:
            msg = "The request was malformed; fpath should not be empty."
            _handleErr(400, msg)

        fpath = url_path_join(self.notebook_dir, relfpath)

        if not os.path.exists(fpath):
            msg = "The request specified a file that does not exist."
            _handleErr(403, msg)
        else:
            try:
                # test opening the file with h5py
                with h5py.File(fpath, "r") as f:
                    pass
            except Exception:
                msg = f"The request did not specify a file that `h5py` could understand.\n" f"Error: {traceback.format_exc()}"
                _handleErr(401, msg)
            try:
                out = self._get(fpath, uri, **kwargs)
            except JhdfError as e:
                msg = e.args[0]
                msg["traceback"] = traceback.format_exc()
                msg["type"] = "JhdfError"
                _handleErr(400, msg)
            except Exception:
                msg = f"Found and opened file, error getting contents from object specified by the uri.\n" f"Error: {traceback.format_exc()}"
                _handleErr(500, msg)

            return out


class HdfFileManager(HdfBaseManager):
    """Implements base HDF5 file handling"""

    def _get(self, fpath, uri, **kwargs):
        with h5py.File(fpath, "r") as f:
            return self._getFromFile(f, uri, **kwargs)

    def _getFromFile(self, f, uri, **kwargs):
        entity = create_entity(f, uri)

        return jsonize(self._getResponse(entity, **kwargs))

    def _getResponse(self, entity, **kwargs):
        raise NotImplementedError


## handler
class HdfBaseHandler(APIHandler):
    managerClass = None

    """Base class for HDF5 api handlers
    """

    def initialize(self, notebook_dir):
        if self.managerClass is None:
            raise NotImplementedError

        self.notebook_dir = notebook_dir
        self.manager = self.managerClass(log=self.log, notebook_dir=notebook_dir)

    @web.authenticated
    async def get(self, path):
        """Based on an api request, get either the contents of a group or a
        slice of a dataset and return it as serialized JSON.
        """
        uri = "/" + self.get_query_argument("uri").lstrip("/")
        itemss = ()

        # get any query parameter vals
        _kws = ("min_ndim", "ixstr", "subixstr")
        _vals = (self.get_query_argument(kw, default=None) for kw in _kws)
        itemss += (zip(_kws, _vals),)

        # get any repeated query parameter array vals
        _array_kws = ("attr_keys",)
        _array_vals = (self.get_query_arguments(kw) or None for kw in _array_kws)
        itemss += (zip(_array_kws, _array_vals),)

        # filter all of the collected params and vals into a kwargs dict
        kwargs = {k: v if v else None for items in itemss for k, v in items}

        # do any needed type conversions of param vals
        _num_kws = ("min_ndim",)
        for k in (k for k in _num_kws if kwargs[k] is not None):
            kwargs[k] = int(kwargs[k])

        try:
            self.finish(simplejson.dumps(self.manager.get(path, uri, **kwargs), ignore_nan=True))
        except HTTPError as err:
            self.set_status(err.code)
            response = err.response.body if err.response else str(err.code)
            self.finish("\n".join((response, err.message)))

    # def getQueryArguments(self, key, func=None):
    #     if func is not None:
    #         return [func(x) for x in self.get_query_argument(key).split(',')] if key in self.request.query_arguments else None
    #     else:
    #         return [x for x in self.get_query_argument(key).split(',')] if key in self.request.query_arguments else None
