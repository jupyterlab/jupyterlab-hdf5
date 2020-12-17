# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import ast
import h5py
import re
import numpy as np

from .exception import JhdfError

__all__ = ['atleast_nd', 'dsetChunk', 'hobjAttrsDict', 'hobjContentsDict', 'hobjMetaDict', 'hobjType', 'jsonize', 'parseIndex', 'parseSubindex', 'slicelen', 'shapemeta', 'uriJoin', 'uriName']

## array handling
def atleast_nd(ary, ndim, pos=0):
    """
    ref: https://github.com/numpy/numpy/blob/8720da5f14b7a3bf8f565ad6c9f996d58d7c3fe6/numpy/core/shape_base.py#L175

    pos : int, optional
        The index to insert the new dimensions. May range from
        ``-ary.ndim - 1`` to ``+ary.ndim`` (inclusive). Non-negative
        indices indicate locations before the corresponding axis:
        ``pos=0`` means to insert at the very beginning. Negative
        indices indicate locations after the corresponding axis:
        ``pos=-1`` means to insert at the very end. 0 and -1 are always
        guaranteed to work. Any other number will depend on the
        dimensions of the existing array. Default is 0.
    Returns
    -------
    res : ndarray
        An array with ``res.ndim >= ndim``. A view is returned for array
        inputs. Dimensions are prepended if `pos` is 0, so for example,
        a 1-D array of shape ``(N,)`` with ``ndim=4`` becomes a view of
        shape ``(1, 1, 1, N)``. Dimensions are appended if `pos` is -1,
        so for example a 2-D array of shape ``(M, N)`` becomes a view of
        shape ``(M, N, 1, 1)`` when ``ndim=4``.
    """
    ary = np.array(ary, copy=False, subok=True)
    if ary.ndim:
        pos = np.core.multiarray.normalize_axis_index(pos, ary.ndim + 1)
    extra = ndim - ary.ndim
    if extra > 0:
        ind = pos * (slice(None),) + extra * (None,) + (Ellipsis,)
        ary = ary[ind]
    return ary


## chunk handling
def dsetChunk(dset, ixstr=None, subixstr=None, min_ndim=None):
    if ixstr is None:
        chunk = dset[...]
    elif subixstr is None:
        chunk = dset[parseIndex(ixstr)]
    else:
        validateSubindex(dset.shape, dset.size, ixstr, subixstr)
        chunk = dset[parseSubindex(dset.shape, dset.size, ixstr, subixstr)]

    if min_ndim is not None:
        chunk = atleast_nd(chunk, min_ndim)

    return chunk


## create dicts to be returned by the various api
def hobjAttrsDict(hobj):
    return dict((
        *hobj.attrs.items(),
    ))

def hobjContentsDict(hobj, content=False, ixstr=None, min_ndim=None):
    return dict((
        # ensure that 'content' is undefined if not explicitly requested
        *((('content', hobjMetaDict(hobj, ixstr=ixstr, min_ndim=min_ndim)),) if content else ()),
        *_hobjDict(hobj).items(),
        ('uri', hobj.name),
    ))

def hobjMetaDict(hobj, ixstr=None, min_ndim=None):
    d = _hobjDict(hobj)

    if d['type'] == 'dataset':
        return dict(sorted((
            *d.items(),
            *_dsetMetaDict(hobj, ixstr=ixstr, min_ndim=min_ndim).items(),
        )))
    else:
        return d

def hobjType(hobj):
    if isinstance(hobj, h5py.Dataset):
        return 'dataset'
    elif isinstance(hobj, h5py.Group):
        return 'group'
    else:
        return 'other'

def _dsetMetaDict(dset, ixstr=None, min_ndim=None):
    shapekeys = ('labels', 'ndim', 'shape', 'size')
    smeta = {k:v for k,v in shapemeta(dset.shape, dset.size, ixstr=ixstr, min_ndim=min_ndim).items() if k in shapekeys}

    return dict((
        ('dtype', dset.dtype.str),
        *smeta.items(),
    ))

def _hobjDict(hobj):
    return dict((
        ('name', uriName(hobj.name)),
        ('type', hobjType(hobj)),
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
        if ',' not in node_or_string:
            # handle ndim <= 1 case
            node_or_string += ','
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

def parseSubindex(shape, size, ixstr, subixstr):
    ix = parseIndex(ixstr)
    meta = shapemeta(shape, size, ixstr)
    subix = parseIndex(subixstr)

    ixcompound = list(ix)
    for d, dlabel, subdix in zip(meta['visdims'], meta['labels'], subix):
        start = dlabel.start + (subdix.start*dlabel.step)
        stop = dlabel.start + (min(subdix.stop, dlabel.stop // dlabel.step)*dlabel.step) # dlabel.start + (subdix.stop*dlabel.step)
        ixcompound[d] = slice(start, stop)

    return tuple(ixcompound)

def shapemeta(shape, size, ixstr=None, min_ndim=None):
    if ixstr is None:
        ix = (slice(None), )*len(shape)
    else:
        ix = parseIndex(ixstr)

    ndimIx = len([dix for dix in ix if isinstance(dix, slice)])

    promote = 0 if min_ndim is None else max(0, min_ndim - ndimIx)
    if promote:
        ix = (slice(None), )*promote + ix
        ndimIx += promote
        shape = (1, )*promote + shape

    visdimsIx = tuple(d for d,dix in enumerate(ix) if isinstance(dix, slice))

    labelsIx = [slice(*ix[d].indices(shape[d])) for d in visdimsIx]
    shapeIx = [slicelen(ix[d], shape[d]) for d in visdimsIx]

    sizeIx = np.prod(shapeIx) if ndimIx else size

    return dict((
        ('labels', labelsIx),
        ('ndim', ndimIx),
        ('shape', shapeIx),
        ('size', sizeIx),
        ('visdims', visdimsIx),
    ))

def slicelen(slyce, seqlen):
    """Based on https://stackoverflow.com/a/36188683
    """
    start, stop, step = slyce.indices(seqlen)
    return max(0, (stop - start + (step - (1 if step > 0 else -1))) // step)

def validateSubindex(shape, size, ixstr, subixstr):
    meta = shapemeta(shape, size, ixstr)
    subix = parseIndex(subixstr)

    if len(subix) != len(meta['visdims']):
        msg = dict((
            ('message', 'malformed subixstr: number of visible dimensions in index not equal to number of dimensions in subindex.'),
            ('debugVars', {'ixstr': ixstr, 'subix': subix, 'subixstr': subixstr, 'visdims': meta['visdims']}),
        ))
        raise JhdfError(msg)


## json handling
def jsonize(v):
    """Turns a value into a JSON serializable version
    """
    if isinstance(v, bytes):
        return v.decode()
    if isinstance(v, dict):
        return {k:jsonize(v) for k,v in v.items()}
    if isinstance(v, (list, tuple)):
        return [jsonize(i) for i in v]
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.ndarray):
        return jsonize(v.tolist())
    if isinstance(v, slice):
        return dict((
            ('start', v.start),
            ('stop', v.stop),
            ('step', v.step),
        ))
    return v


## uri handling
_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))

def uriName(uri):
    return uri.split('/')[-1]
