""" jupyterLab_hdf : HDF5 api for Jupyter/Jupyterlab

Copyright (c) Max Klein.
Distributed under the terms of the Modified BSD License.
"""

# def enableAutoreload():
#     from IPython import get_ipython
#
#     if get_ipython() is not None:
#         mStrs = [
#             'load_ext autoreload',
#             'autoreload 2',
#         ]
#         for mStr in mStrs:
#             get_ipython().magic(mStr)
# enableAutoreload()

from notebook.utils import url_path_join

from ._version import __version__
from .contents import HdfContentsManager, HdfContentsHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_hdf'
    }]

def _load_external_types(nb_server_app, web_app):
    hdfContentsManager = HdfContentsManager(nb_server_app.notebook_dir)
    def hdf_external_contents_handler(model):
        if model['content']:
            model['content'] = hdfContentsManager.get(model['path'], '/leaf01/leaf02/data02', 100, 100)

    web_app.settings['contents_manager'].external_types.update({'external/hdf': hdf_external_contents_handler})

def _load_handlers(nb_server_app, web_app):
    # Prepend the base_url so that it works in a jupyterhub setting
    base_url = web_app.settings['base_url']
    hdf = url_path_join(base_url, 'hdf')
    contents = url_path_join(hdf, 'contents')

    handlers = [
        (contents + '/(.*)',
         HdfContentsHandler,
         {"notebook_dir": nb_server_app.notebook_dir}),
    ]

    web_app.add_handlers('.*$', handlers)

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    # _load_external_types(nb_server_app, web_app)
    _load_handlers(nb_server_app, web_app)

    print('INFO: jupyterlab_hdf server extension loaded')

print('INFO: jupyterlab_hdf python package imported')
