from typing import Union
import h5py

try:
    import hdf5plugin  # noqa: F401
except ImportError:
    pass
from .util import attrMetaDict, dsetChunk, shapemeta, uriName


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
                ("name", self.name),
                ("uri", self.uri),
                ("type", self.type),
            )
        )

    def metadata(self, **kwargs):
        attribute_names = sorted(self._hobj.attrs.keys())
        return dict((("name", self.name), ("type", self.type), ("attributes", [attrMetaDict(self._hobj.attrs.get_id(k)) for k in attribute_names])))

    @property
    def name(self):
        return uriName(self.uri)

    @property
    def uri(self):
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

    def data(self, ixstr=None, subixstr=None, min_ndim=None):
        return dsetChunk(self._hobj, ixstr=ixstr, subixstr=subixstr, min_ndim=min_ndim)


class Group(Entity):
    type = "group"

    def contents(self, content=False, ixstr=None, min_ndim=None):
        if not content:
            return super().contents(ixstr=ixstr, min_ndim=min_ndim)

        # Recurse one level
        return [
            create_entity(self._hobj, suburi).contents(
                content=False,
                ixstr=ixstr,
                min_ndim=min_ndim,
            )
            for suburi in self._hobj.keys()
        ]

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
