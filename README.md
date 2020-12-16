[![PyPI version][pypi-badge]][pypi]
[![npm_version][npm-badge]][npm]

[interactive api docs][redoc]

# jupyterlab-hdf5

Open and explore HDF5 files in JupyterLab. Can handle very large (TB) sized files. New in release v0.5.0, jlab-hdf5 can now open datasets of any dimensionality, from 0 to 32. Any 0D, 1D, or 2D slab of any dataset can easily be selected and displayed using numpy-style index syntax.

![hdf_preview][tutorial_animation]

Double clicking on an `.hdf5` file in the file browser will open it in a special HDF browser. You can then browse through the groups and open the datasets in the `.hdf5` file. All datasets will open read only.

For the moment, the browser context menu does not work with `.hdf5` files/groups/datasets. Only double clicking is currently supported.

Designed from the ground up to be as efficient as possible. Data will only be fetched as needed to create the visible display. This allows the extension to work with very large files (tested working up to the TB range).

## Installation

```bash
pip install jupyterlab_hdf
jupyter labextension install @jupyterlab/hdf5
```

This will install both the server extension and the labextension needed by this plugin.

You can also install the labextension via Jupyterlab's extension manager GUI. Keep in mind that if you use the lab extension GUI, you'll still need to install the `jupyterlab_hdf` server extension via `pip`.

## Development

For a development install, clone the repository and then run the following in the repo dir:

```bash
pip install .
jlpm build:dev
```

To watch for/rebuild on changes to this extension's source code, run:

```bash
jlpm run build:watch
```

## What's in this extension

This extension has two main parts: an hdf5 filebrowser plugin, and an hdf5 dataset file type plugin.

### HDF5 Filebrowser

Allows you to navigate an `.hdf5` file's groups as though they were directories in a filesystem. Any `.hdf5` file on a user's system can be opened by entering its path (relative to the Jupyterlab home directory) in the box at the top of the browser.

### HDF5 dataset file type

When you open a dataset using the hdf5 filebrowser, a document will open that displays the contents of the dataset via a grid.

[pypi-badge]: https://badge.fury.io/py/jupyterlab-hdf.svg
[pypi]: https://badge.fury.io/py/jupyterlab-hdf
[npm-badge]: https://badge.fury.io/js/%40jupyterlab%2Fhdf5.svg
[npm]: https://badge.fury.io/js/%40jupyterlab%2Fhdf5
[redoc]: https://jupyterlab.github.io/jupyterlab-hdf5/
[swagger]: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyterlab/jupyterlab-hdf5/master/jupyterlab_hdf/api/api.yaml
[tutorial_animation]: https://raw.githubusercontent.com/jupyterlab/jupyterlab-hdf5/master/example/tutorial_animation.gif
