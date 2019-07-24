"""
Setup module for the jupyterlab_github proxy extension
"""
import setuptools
from setupbase import (
    create_cmdclass, ensure_python, find_packages
    )

data_files_spec = [
    ('etc/jupyter/jupyter_notebook_config.d',
     'jupyter-config/jupyter_notebook_config.d',
     'jupyterlab_hdf.json'),
]

cmdclass = create_cmdclass(data_files_spec=data_files_spec)

setup_dict = dict(
    name='jupyterlab_hdf',
    description='A Jupyter Notebook server extension which uses h5serv to open HDF5 files.',
    packages=find_packages(),
    cmdclass=cmdclass,
    author          = 'Max Klein',
    url             = 'https://github.com/telamonian/jupyterlab-hdf5',
    license         = 'BSD',
    platforms       = "Linux, Mac OS X, Windows",
    keywords        = ['Jupyter', 'JupyterLab', 'hdf5'],
    python_requires = '>=3.5',
    classifiers     = [
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
    ],
    install_requires=[
        'notebook'
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

from jupyterlab_hdf import __version__

setuptools.setup(
    version=__version__,
    **setup_dict
)
