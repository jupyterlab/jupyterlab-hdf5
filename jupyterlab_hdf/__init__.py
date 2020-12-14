# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from ._version import __version__

from notebook.utils import url_path_join

from .attrs import HdfAttrsHandler
from .contents import HdfContentsHandler
from .data import HdfDataHandler
from .meta import HdfMetaHandler
from .snippet import HdfSnippetHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'


def _jupyter_server_extension_paths():
    return [{'module': 'jupyterlab_hdf'}]


def _load_handlers(notebook_dir, web_app):
    # Prepend the base_url so that it works in a jupyterhub setting
    base_url = web_app.settings['base_url'] if 'base_url' in web_app.settings else '/'

    _handlerDict = dict((
        ('attrs', HdfAttrsHandler),
        ('contents', HdfContentsHandler),
        ('data', HdfDataHandler),
        ('meta', HdfMetaHandler),
        ('snippet', HdfSnippetHandler),
    ))

    handlers = [
        (url_path_join(base_url, 'hdf', ep, '(.*)'), handler, {'notebook_dir': notebook_dir})
        for ep,handler in _handlerDict.items()
    ]

    web_app.add_handlers('.*$', handlers)


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    _load_handlers(nb_server_app.notebook_dir, nb_server_app.web_app)
