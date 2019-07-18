""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

from notebook.utils import url_path_join

from ._version import __version__
from .metadata import HdfMetadataHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_latex'
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
    metadata = url_path_join(hdf, 'metadata')
    # dataset = url_path_join(hdf, 'dataset')

    handlers = [
        (f'{metadata}{path_regex}',
         HdfMetadataHandler,
         {"notebook_dir": nb_server_app.notebook_dir}),
        # (f'{dataset}{path_regex}',
        #  HdfDatasetHandler,
        #  {"notebook_dir": nb_server_app.notebook_dir})
    ]
    web_app.add_handlers('.*$', handlers)
