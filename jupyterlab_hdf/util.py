# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import re

from tornado.web import HTTPError

__all__ = [
    'chunkSlice',
    'dsetChunk',
    'dsetContentDict',
    'dsetDict',
    'groupDict',
    'uriJoin',
    'uriName'
]

## chunk handling
def chunkSlice(chunk, s):
    if s.start is None:
        return slice(None, s.stop*chunk, s.step)

    return slice(s.start*chunk, s.stop*chunk, s.step)

def dsetChunk(dset, select):
    slices = _getHyperslabSlices(dset.shape, select)
    return dset[slices].tolist()

## create dicts to be converted to json
def dsetContentDict(dset, select=None):
    return dict([
        # metadata
        ('attrs', dict(*dset.attrs.items())),
        ('dtype', dset.dtype.str),
        ('ndim', dset.ndim),
        ('shape', dset.shape),

        # actual data
        ('data', dsetChunk(dset, select) if select else None)
    ])

def dsetDict(name, uri, content=None):
    return dict([
        ('type', 'dataset'),
        ('name', name),
        ('uri', uri),
        ('content', content)
    ])

def groupDict(name, uri):
    return dict([
        ('type', 'group'),
        ('name', name),
        ('uri', uri),
        ('content', None)
    ])


## uri handling
_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))

def uriName(uri):
    return uri.split('/')[-1]


def _getHyperslabSlices(dsetshape, select):
    """
    Parse SELECT query param and return tuple of Python slice objects

    :param dsetshape: The shape of the dataset as returned by dset.shape
    :param select: The SELECT query param should be in the form: 
    [<dim1>, <dim2>, ... , <dimn>]
    For each dimension, valid formats are:
        single integer: n
        start and end: n:m
        start, end, and stride: n:m:s
    :type select: str

    :returns: tuple of Python slices based on the SELECT query param
    """

    if select is None:
        # Default: return entire dataset
        return tuple(slice(0, extent) for extent in dsetshape)

    if not select.startswith('['):
        msg = "Bad Request: selection query missing start bracket"
        raise HTTPError(400, reason=msg)
    if not select.endswith(']'):
        msg = "Bad Request: selection query missing end bracket"
        raise HTTPError(400, reason=msg)

    # strip brackets
    select = select[1:-1]

    select_array = select.split(',')
    if len(select_array) > len(dsetshape):
        msg = "Bad Request: number of selected dimensions exceeds the rank of the dataset"
        raise HTTPError(400, reason=msg)

    slices = []
    for dim, dim_slice in enumerate(select_array):
        extent = dsetshape[dim]

        # default slice values
        start = 0
        stop = extent
        step = 1
        if dim_slice.find(':') < 0:
            # just a number - append to SLICES, and continue to next iteration
            try:
                slices.append(int(dim_slice))
                continue
            except ValueError:
                msg = "Bad Request: invalid selection parameter (can't convert to int) for dimension: " + str(dim)
                raise HTTPError(400, reason=msg)
            stop = start + 1
        elif dim_slice == ':':
            # select everything (default)
            pass
        else:
            fields = dim_slice.split(":")
            if len(fields) > 3:
                msg = "Bad Request: Too many ':' seperators for dimension: " + str(dim)
                raise HTTPError(400, reason=msg)
            try:
                if fields[0]:
                    start = int(fields[0])
                if fields[1]:
                    stop = int(fields[1])
                if len(fields) > 2 and fields[2]:
                    step = int(fields[2])
            except ValueError:
                msg = "Bad Request: invalid selection parameter (can't convert to int) for dimension: " + str(dim)
                raise HTTPError(400, reason=msg)

        if start < 0 or start > extent:
            msg = "Bad Request: Invalid selection start parameter for dimension: " + str(dim)
            raise HTTPError(400, reason=msg)
        if stop > extent:
            msg = "Bad Request: Invalid selection stop parameter for dimension: " + str(dim)
            raise HTTPError(400, reason=msg)
        if step <= 0:
            msg = "Bad Request: invalid selection step parameter for dimension: " + str(dim)
            raise HTTPError(400, reason=msg)
        slices.append(slice(start, stop, step))

    return tuple(slices)
