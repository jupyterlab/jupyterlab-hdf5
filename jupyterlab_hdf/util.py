# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import ast
import re
import numpy as np

from .exception import JhdfError

__all__ = ['dsetChunk', 'dsetContentDict', 'dsetDict', 'groupDict', 'parseIndex', 'parseSubindex', 'uriJoin', 'uriName']

## chunk handling
def dsetChunk(dset, ixstr, subixstr=None):
    return dset[parseSubindex(ixstr, subixstr, dset.shape)].tolist()

def serialize_value(v):
    """Turns a value into a JSON serializable version
    """
    if isinstance(v, (list, tuple)):
        return [serialize_value(i) for i in v]
    if isinstance(v, slice):
        return dict((
            ('start', v.start),
            ('stop', v.stop),
            ('step', v.step),
        ))
    if isinstance(v, np.ndarray):
        return serialize_value(v.tolist())
    if isinstance(v, bytes):
        return v.decode()
    return v


## create dicts to be converted to json
def dsetContentDict(dset, ixstr=None):
    if ixstr is None:
        ixstr = defaultIxstr(dset.ndim)

    return dict((
        # metadata
        ('attrs', {k: serialize_value(v) for k, v in dset.attrs.items()}),
        ('dtype', dset.dtype.str),
        ('ndim', dset.ndim),
        ('shape', dset.shape),
        ('ixstr', ixstr),

        *validateIxstr(ixstr, dset.shape).items(),
    ))

def dsetDict(uri, name=None, content=None):
    return dict((
        ('type', 'dataset'),
        ('name', uriName(name) if name is None else name),
        ('uri', uri),
        ('content', content),
    ))

def groupDict(name, uri):
    return dict((
        ('type', 'group'),
        ('name', name),
        ('uri', uri),
        ('content', None),
    ))


## index parsing and handling
class _Guard:
    def __init__(self):
        self.val = False

    def __call__(self):
        if self.val:
            return True
        else:
            self.val = True
            return False

def parseIndex(node_or_string):
    """Safely evaluate an expression node or a string containing
    a (limited subset) of valid numpy index or slice expressions.
    """
    if isinstance(node_or_string, str):
        node_or_string = ast.parse('dummy[{}]'.format(node_or_string.lstrip(" \t")) , mode='eval')
    if isinstance(node_or_string, ast.Expression):
        node_or_string = node_or_string.body
    if isinstance(node_or_string, ast.Subscript):
        node_or_string = node_or_string.slice

    def _raise_malformed_node(node):
        raise ValueError('malformed node or string: {}, {}'.format(node, ast.dump(node)))
    def _raise_nested_tuple_node(node):
        raise ValueError('tuples inside of tuple indices are not supported: {}, {}'.format(node, ast.dump(node)))

    # from cpy37, should work until they remove ast.Num (not until cpy310)
    def _convert_num(node):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, complex)):
                return node.value
        elif isinstance(node, ast.Num):
            # ast.Num was removed from ast grammar in cpy38
            return node.n # pragma: no cover
        _raise_malformed_node(node)
    def _convert_signed_num(node):
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            operand = _convert_num(node.operand)
            if isinstance(node.op, ast.UAdd):
                return + operand
            else:
                return - operand
        return _convert_num(node)

    _nested_tuple_guard = _Guard()
    def _convert(node):
        if isinstance(node, ast.Tuple):
            if _nested_tuple_guard():
                _raise_nested_tuple_node(node)

            return tuple(map(_convert, node.elts))
        elif isinstance(node, ast.Slice):
            return slice(
                _convert(node.lower) if node.lower is not None else None,
                _convert(node.upper) if node.upper is not None else None,
                # for now, no step support
                # _convert(node.step) if node.step is not None else None,
                None,
            )
        elif isinstance(node, ast.NameConstant) and node.value is None:
            # support for literal None in slices, eg 'slice(None, ...)'
            return None
        elif isinstance(node, ast.Ellipsis):
            # support for three dot '...' ellipsis syntax
            return ...
        elif isinstance(node, ast.Name) and node.id == 'Ellipsis':
            # support for 'Ellipsis' ellipsis syntax
            return ...
        elif isinstance(node, ast.Index):
            # ast.Index was removed from ast grammar in cpy39
            return _convert(node.value) # pragma: no cover
        elif isinstance(node, ast.ExtSlice):
            # ast.ExtSlice was removed from ast grammar in cpy39
            _nested_tuple_guard() # pragma: no cover
            return tuple(map(_convert, node.dims))

        return _convert_signed_num(node)
    return _convert(node_or_string)

def defaultIxstr(ndim):
    if ndim < 1:
        raise ValueError('dataset has wrong number of dimensions. ndim: {}'.format(ndim))
    elif ndim == 1:
        return ':, 0'

    return ', '.join([':', ':'] + (['0'] * (ndim - 2)))

def getVisdims(ix):
    return [d for d,dix in enumerate(ix) if isinstance(dix, slice)]

def getVislabels(ix, shape):
    return [slice(*dix.indices(dshape)) for dix,dshape in zip(ix, shape) if isinstance(dix, slice)]

def getVisshape(ix, shape):
    return [sliceLen(dix, dshape) for dix,dshape in zip(ix, shape) if isinstance(dix, slice)]

def sliceLen(slyce, seqlen):
    """Based on https://stackoverflow.com/a/36188683
    """
    start, stop, step = slyce.indices(seqlen)
    return max(0, (stop - start + (step - (1 if step > 0 else -1))) // step)

def validateIxstr(ixstr, shape):
    ix = parseIndex(ixstr)

    visdims = getVisdims(ix)
    vislabels = getVislabels(ix, shape)
    visshape = getVisshape(ix, shape)

    visdict = dict((
        ('vislabels', serialize_value(vislabels)),
        ('visdims', visdims),
        ('visshape', visshape),
    ))

    if len(visdims) != len(vislabels):
        msg = dict((
            ('message', 'malformed ixstr: number of visible dimensions not equal to number of index labels.'),
            ('debugVars', {**visdict}),
        ))
        raise JhdfError(msg)

    if len(visdims) < 1:
        msg = dict((
            ('message', 'malformed ixstr: number of visible dimensions less than 1.'),
            ('debugVars', {**visdict}),
        ))
        raise JhdfError(msg)

    if len(visdims) > 2:
        msg = dict((
            ('message', 'malformed ixstr: number of visible dimensions greater than 2.'),
            ('debugVars', {**visdict}),
        ))
        raise JhdfError(msg)

    return visdict

def parseSubindex(ixstr, subixstr, shape):
    ix = parseIndex(ixstr)
    if subixstr is None or shape is None:
        return ix

    subix = parseIndex(subixstr)
    visdims = getVisdims(ix)
    vislabels = getVislabels(ix, shape)

    if len(visdims) != len(subix):
        msg = dict((
            ('message', 'malformed subixstr: number of visible dimensions in index not equal to number of dimensions in subindex.'),
            ('debugVars', dict((
                ('subix', subix),
                ('visdims', visdims),
                ('vislabels', vislabels),
            ))),
        ))
        raise JhdfError(msg)

    ixcompound = list(ix)
    for d, dlabel, subdix in zip(visdims, vislabels, subix):
        start = dlabel.start + (subdix.start*dlabel.step)
        stop = dlabel.start + (min(subdix.stop, dlabel.stop // dlabel.step)*dlabel.step) # dlabel.start + (subdix.stop*dlabel.step)
        ixcompound[d] = slice(start, stop)

    return tuple(ixcompound)


## uri handling
_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))

def uriName(uri):
    return uri.split('/')[-1]
