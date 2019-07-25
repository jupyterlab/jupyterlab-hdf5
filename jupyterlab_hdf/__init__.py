""" JupyterLab HDF : HDF5 file viewer for Jupyterlab """

from notebook.utils import url_path_join

from ._version import __version__
from .metadata import HdfMetadataHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_hdf'
    }]

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    # Prepend the base_url so that it works in a jupyterhub setting
    base_url = web_app.settings['base_url']
    hdf = url_path_join(base_url, 'hdf')
    meta = url_path_join(hdf, 'meta')
    # data = url_path_join(hdf, 'data')

    print(meta)

    handlers = [
        (f'{meta}/{path_regex}',
         HdfMetadataHandler,
         {"notebook_dir": nb_server_app.notebook_dir}),
        # (f'{dataset}{path_regex}',
        #  HdfDatasetHandler,
        #  {"notebook_dir": nb_server_app.notebook_dir})
    ]
    web_app.add_handlers('.*$', handlers)
