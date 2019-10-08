#!/usr/bin/env python

import argparse as argp
import json
import subprocess

from setupbase import get_version

def tag(version, kind):
    """git tagging
    """
    tag = f"{kind}_v{version}"

    subprocess.run(['git', 'tag', tag])
    subprocess.run(['git', 'push', 'origin', tag])

def pypi():
    """release on pypi
    """
    # get single source of truth
    version = get_version('jupyterlab_hdf/_version.py')

    tag(version, 'pypi')

    # build the tar release and binary wheels
    # subprocess.run(['python', 'setup.py', 'sdist', 'bdist_wheel'])

    # build just the tar release
    subprocess.run(['python', 'setup.py', 'sdist'])

    # release to the test server
    # subprocess.run(['twine', 'upload', '--repository-url', 'https://test.pypi.org/legacy/', 'dist/*'])

    # release to the production server
    subprocess.run(['twine', 'upload', 'dist/*'])

def npmjs():
    """release on npmjs
    """
    # get single source of truth
    with open('package.json') as f:
        info = json.load(f)

    version = info['version']

    tag(version, 'npmjs')

    # dry run build and release
    # subprocess.run(['npm', 'publish', '--access', 'public', '--dry-run'])

    # build and release
    subprocess.run(['npm', 'publish', '--access', 'public'])

def main():
    parser = argp.ArgumentParser()

    parser.add_argument('--pypi', action='store_true')
    parser.add_argument('--npmjs', action='store_true')

    parsed = vars(parser.parse_args())

    if 'pypi' in parsed and parsed['pypi']:
        pypi()

    if 'npmjs' in parsed and parsed['npmjs']:
        npmjs()
