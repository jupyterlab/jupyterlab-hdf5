import h5py
from .util import _hobjDict, hobjContentsDict, hobjMetaDict


class Entity:
    def __init__(self, hobj: h5py.HLObject) -> None:
        self._hobj = hobj

    def attributes(self, attr_keys=None):
        if attr_keys is None:
            return dict((*self._hobj.attrs.items(),))

        return dict((key, self._hobj.attrs[key]) for key in attr_keys)

    def contents(self, content=False, ixstr=None, min_ndim=None):
        return hobjContentsDict(self._hobj, content, ixstr, min_ndim)
        # return dict(
        #     (
        #         # ensure that 'content' is undefined if not explicitly requested
        #         *((("content", hobjMetaDict(self._hobj, ixstr=ixstr, min_ndim=min_ndim)),) if content else ()),
        #         *_hobjDict(self._hobj).items(),
        #         ("uri", self._hobj.name),
        #     )
        # )


class Dataset(Entity):
    pass


class Group(Entity):
    pass


def create_entity(hobj: h5py.HLObject):
    if isinstance(hobj, h5py.Dataset):
        return Dataset(hobj)

    elif isinstance(hobj, h5py.Group):
        return Group(hobj)

    else:
        return Entity(hobj)
