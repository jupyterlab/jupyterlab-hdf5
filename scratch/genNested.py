#!/usr/bin/env python
import h5py
import numpy as np
from pathlib import Path

def genData(n, shape=(1000, 1000), umin=0, umax=1000):
    data = np.empty(shape)
    data[:, 0] = n
    data[0, :] = n
    data[1:, 1:] = np.random.uniform(umin, umax, size=np.array(shape) - 1)
    return data

def genLeaf(group, ext=None, n=0, shape=(1000, 1000)):
    leaf = group.create_group('leaf%02d' % (n+1))

    # data = np.full(shape, n)
    dpath = ('data%02d' % n) if ext is None else str(Path('data%02d' % n).with_suffix(ext))
    print(dpath)
    group.create_dataset(dpath, data=genData(n, shape=shape))

    return leaf

def genNested(N=5, ext=None):
    with h5py.File('nested.hdf5', 'w') as f:
        group = f
        for n in range(N):
            group = genLeaf(group, ext=ext, n=n)

if __name__=='__main__':
    genNested()
