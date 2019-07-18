#!/usr/bin/env python

import h5py
import numpy as np

def genLeaf(group, n=0, shape=(20, 10)):
    leaf = group.create_group('leaf%02d' % (n+1))

    # data = np.random.uniform(0, 1000, size=shape)
    data = np.full(shape, n)
    group.create_dataset('data%02d' % n, data=data)

    return leaf

def genNested(N=5):
    with h5py.File('nested.hdf5', 'w') as f:
        group = f
        for n in range(N):
            group = genLeaf(group, n=n)

if __name__=='__main__':
    genNested()
