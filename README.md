# jupyterlab-hdf

Open and explore HDF5 files in Jupyterlab.

Currently pre-pre-alpha and totally non-functional.

## Prerequisites

- JupyterLab

## Installation

```bash
jupyter labextension install jupyterlab-hdf5
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```
