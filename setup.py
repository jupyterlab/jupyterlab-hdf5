""" jupyterLab_hdf : HDF5 api for Jupyter/Jupyterlab

Copyright (c) Max Klein.
Distributed under the terms of the Modified BSD License.
"""

import setuptools
from setupbase import create_cmdclass, ensure_python, find_packages, get_version

with open("README.md", "r") as fh:
    long_description = fh.read()

data_files_spec = [
    ('etc/jupyter/jupyter_notebook_config.d',
     'jupyter-config/jupyter_notebook_config.d',
     'jupyterlab_hdf.json'),
]

cmdclass = create_cmdclass(data_files_spec=data_files_spec)

setup_dict = dict(
    name='jupyterlab_hdf',
    description="A Jupyter Notebook server extension that provides APIs for fetching hdf5 contents and data. Built on h5py.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    cmdclass=cmdclass,
    author          = 'Max Klein',
    url             = 'https://github.com/telamonian/jupyterlab-hdf5',
    license         = 'BSD',
    platforms       = "Linux, Mac OS X, Windows",
    keywords        = ['Jupyter', 'JupyterLab', 'hdf5'],
    python_requires = '>=3.6',
    classifiers     = [
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
    ],
    install_requires=[
        'h5py',
        'notebook',
        'simplejson'
    ]
)

try:
    ensure_python(setup_dict["python_requires"].split(','))
except ValueError as e:
    raise ValueError("{:s}, to use {} you must use python {} ".format(
                         e,
                         setup_dict["name"],
                         setup_dict["python_requires"])
                    )

setuptools.setup(
    version=get_version('jupyterlab_hdf/_version.py'),
    **setup_dict
)
