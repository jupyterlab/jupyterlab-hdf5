#!/usr/bin/env python

import argparse as argp
import io
import json
import os
import subprocess

__all__ = ['npmjs', 'pypi', 'tag']

versionFilePy = 'jupyterlab_hdf/_version.py'


def _get_version_py(file, name='__version__'):
    """Get the version of the package from the given file by
    executing it and extracting the given `name`.
    """
    path = os.path.realpath(file)
    version_ns = {}
    with io.open(path, encoding="utf8") as f:
        exec(f.read(), {}, version_ns)
    return version_ns[name]


def npmjs(dry=False):
    """release on npmjs
    """
    # get single source of truth
    with open('package.json') as f:
        info = json.load(f)

    version = info['version']

    tag(version, 'npmjs', dry=dry)

    if dry:
        # dry run build and release
        subprocess.run(['npm', 'publish', '--access', 'public', '--dry-run'])
    else:
        # build and release
        subprocess.run(['npm', 'publish', '--access', 'public'])


def pypi(dry=False):
    """release on pypi
    """
    # get single source of truth
    version = _get_version_py(versionFilePy)

    tag(version, 'pypi', dry=dry)

    # build the tar release and binary wheels
    # subprocess.run(['python', 'setup.py', 'sdist', 'bdist_wheel'])

    # build just the tar release
    subprocess.run(['python', 'setup.py', 'sdist'])

    if not dry:
        # release to the test server
        # subprocess.run(['twine', 'upload', '--repository-url', 'https://test.pypi.org/legacy/', 'dist/*'])

        # release to the production server
        subprocess.run(['twine', 'upload', 'dist/*'])


def tag(version, kind, dry=False):
    """git tagging
    """
    tag = f"{kind}_v{version}"

    if dry:
        print(f'would release with git tag: {tag}')
    else:
        subprocess.run(['git', 'tag', tag])
        subprocess.run(['git', 'push', 'origin', tag])


def main():
    parser = argp.ArgumentParser()

    parser.add_argument('-d', '--dry', action='store_true')
    parser.add_argument('--npmjs', action='store_true')
    parser.add_argument('--pypi', action='store_true')

    parsed = vars(parser.parse_args())
    dry = 'dry' in parsed and parsed['dry']

    if 'npmjs' in parsed and parsed['npmjs']:
        npmjs(dry=dry)

    if 'pypi' in parsed and parsed['pypi']:
        pypi(dry=dry)


if __name__=='__main__':
    main()
