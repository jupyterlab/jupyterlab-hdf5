from typing import Union
import h5py
from .util import _attrMetaDict, _hobjDict, shapemeta


class Entity:
    type = "other"

    def __init__(self, hobj) -> None:
        self._hobj = hobj

    def attributes(self, attr_keys=None):
        if attr_keys is None:
            return dict((*self._hobj.attrs.items(),))

        return dict((key, self._hobj.attrs[key]) for key in attr_keys)

    def contents(self, content=False, ixstr=None, min_ndim=None):
        return dict(
            (
                # ensure that 'content' is undefined if not explicitly requested
                *((("content", self.metadata(ixstr=ixstr, min_ndim=min_ndim)),) if content else ()),
                *_hobjDict(self._hobj).items(),
                ("uri", self.name),
            )
        )

    def metadata(self, **kwargs):
        attribute_names = sorted(self._hobj.attrs.keys())
        return dict((*_hobjDict(self._hobj).items(), ("attributes", [_attrMetaDict(self._hobj.attrs.get_id(k)) for k in attribute_names])))

    @property
    def name(self):
        return self._hobj.name


class Dataset(Entity):
    type = "dataset"

    def metadata(self, ixstr=None, min_ndim=None):
        d = super().metadata()
        shapekeys = ("labels", "ndim", "shape", "size")
        smeta = {k: v for k, v in shapemeta(self._hobj.shape, self._hobj.size, ixstr=ixstr, min_ndim=min_ndim).items() if k in shapekeys}

        return dict(
            sorted(
                (
                    ("dtype", self._hobj.dtype.str),
                    *d.items(),
                    *smeta.items(),
                )
            )
        )


class Group(Entity):
    type = "group"

    def contents(self, content=False, ixstr=None, min_ndim=None):
        if content:
            return [
                create_entity(self._hobj, suburi).contents(
                    content=False,
                    ixstr=ixstr,
                    min_ndim=min_ndim,
                )
                for suburi in self._hobj.keys()
            ]

        else:
            return super().contents(ixstr=ixstr, min_ndim=min_ndim)

    def metadata(self, **kwargs):
        d = super().metadata()

        return dict(sorted((*d.items(), ("childrenCount", len(self._hobj)))))


def create_entity(root: Union[h5py.File, h5py.Group], uri: str):
    hobj = root[uri]

    if isinstance(hobj, h5py.Dataset):
        return Dataset(hobj)

    elif isinstance(hobj, h5py.Group):
        return Group(hobj)

    else:
        return Entity(hobj)
