#!/usr/bin/env python
import h5py
import numpy as np
from pathlib import Path

def genData(n, func=None, shape=None, umin=None, umax=None):
    if func is None: func = np.random.uniform
    if shape is None: shape = (1000, 1000)
    if umin is None: umin = 0
    if umax is None: umax = 1000

    data = np.empty(shape)
    data[:, 0] = n
    data[0, :] = n
    data[1:, 1:] = func(umin, umax, size=np.array(shape) - 1)
    return data

def genLeaf(group, ext=None, n=None, **dataKwargs):
    if n is None: n = 0

    leaf = group.create_group('leaf%02d' % (n+1))

    # data = np.full(shape, n)
    dpath = ('data%02d' % n) if ext is None else str(Path('data%02d' % n).with_suffix(ext))
    group.create_dataset(dpath, data=genData(n, **dataKwargs))

    return leaf

def genNested(name, N=None, ext=None, func=None, shape=None, suffix='.hdf5', umin=None, umax=None):
    if N is None: N = 5

    with h5py.File(Path(name).with_suffix(suffix), 'w') as f:
        group = f
        for n in range(N):
            group = genLeaf(group, ext=ext, n=n, func=func, shape=shape, umin=umin, umax=umax)

if __name__=='__main__':
    genNested()
