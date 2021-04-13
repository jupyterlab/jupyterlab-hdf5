from typing import Union
import h5py
from h5py._hl.group import ExternalLink

try:
    import hdf5plugin  # noqa: F401
except ImportError:
    pass
from .util import attrMetaDict, dsetChunk, shapemeta, uriJoin, uriName


class Entity:
    type = "other"

    def __init__(self, uri):
        self._uri = uri

    def contents(self, content=False, ixstr=None, min_ndim=None):
        return dict(
            (
                # ensure that 'content' is undefined if not explicitly requested
                *((("content", self.metadata(ixstr=ixstr, min_ndim=min_ndim)),) if content else ()),
                ("name", self.name),
                ("uri", self._uri),
                ("type", self.type),
            )
        )

    def metadata(self, **kwargs):
        return dict((("name", self.name), ("type", self.type)))

    @property
    def name(self):
        return uriName(self._uri)


class ExternalLink(Entity):
    type = "externalLink"

    def __init__(self, uri, link) -> None:
        super().__init__(uri)
        self._target_file = link.filename
        self._target_uri = link.path

    def metadata(self, **kwargs):
        return dict(
            sorted(
                (
                    *super().metadata().items(),
                    ("targetFile", self._target_file),
                    ("targetUri", self._target_uri),
                )
            )
        )


class ResolvedEntity(Entity):
    def __init__(self, uri, hobj):
        super().__init__(uri)
        self._hobj = hobj

    def attributes(self, attr_keys=None):
        if attr_keys is None:
            return dict((*self._hobj.attrs.items(),))

        return dict((key, self._hobj.attrs[key]) for key in attr_keys)

    def metadata(self, **kwargs):
        attribute_names = sorted(self._hobj.attrs.keys())
        return dict((*super().metadata().items(), ("attributes", [attrMetaDict(self._hobj.attrs.get_id(k)) for k in attribute_names])))


class Dataset(ResolvedEntity):
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


class Group(ResolvedEntity):
    type = "group"

    def contents(self, content=False, ixstr=None, min_ndim=None):
        if not content:
            return super().contents(ixstr=ixstr, min_ndim=min_ndim)

        # Recurse one level
        return [
            create_entity(self._hobj.file, uriJoin(self._uri, suburi)).contents(
                content=False,
                ixstr=ixstr,
                min_ndim=min_ndim,
            )
            for suburi in self._hobj.keys()
        ]

    def metadata(self, **kwargs):
        d = super().metadata()

        return dict(sorted((*d.items(), ("childrenCount", len(self._hobj)))))


def create_entity(h5file: h5py.File, uri: str):
    hobj = resolve_hobj(h5file, uri)

    if isinstance(hobj, h5py.ExternalLink):
        return ExternalLink(uri, hobj)
    if isinstance(hobj, h5py.Dataset):
        return Dataset(uri, hobj)
    elif isinstance(hobj, h5py.Group):
        return Group(uri, hobj)
    else:
        return ResolvedEntity(uri, hobj)


def resolve_hobj(h5file: h5py.File, uri: str):
    if uri == "/":
        return h5file[uri]

    link = h5file.get(uri, getlink=True)
    if isinstance(link, h5py.ExternalLink):
        return link

    return h5file[uri]
