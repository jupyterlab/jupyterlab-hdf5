""" JupyterLab HDF : HDF5 file viewer for Jupyterlab """

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
from .dataset import HdfDatasetManager, HdfDatasetHandler
from .meta import HdfMetaHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_hdf'
    }]

def _load_external_types(nb_server_app, web_app):
    # from traitlets.config import get_config
    # c = get_config()
    # c.ContentsManager.external_types = {'external+hdf5': hdf5_external_handler}

    datasetManager = HdfDatasetManager(nb_server_app.notebook_dir)
    def hdf_external_dataset_handler(model):
        if model['content']:
            model['content'] = datasetManager.get(model['path'], '/leaf01/leaf02/data02', 100, 100)

    web_app.settings['contents_manager'].external_types.update({'external/hdf.dataset': hdf_external_dataset_handler})

def _load_handlers(nb_server_app, web_app):
    # Prepend the base_url so that it works in a jupyterhub setting
    base_url = web_app.settings['base_url']
    hdf = url_path_join(base_url, 'hdf')
    meta = url_path_join(hdf, 'meta')
    dataset = url_path_join(hdf, 'dataset')

    handlers = [
        (meta + '/(.*)',
         HdfMetaHandler,
         {"notebook_dir": nb_server_app.notebook_dir}),
        (dataset + '/(.*)',
         HdfDatasetHandler,
         {"notebook_dir": nb_server_app.notebook_dir})
    ]
    web_app.add_handlers('.*$', handlers)

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    _load_external_types(nb_server_app, web_app)
    _load_handlers(nb_server_app, web_app)

    print('INFO: jupyterlab_hdf server extension loaded')

print('INFO: jupyterlab_hdf python package imported')
