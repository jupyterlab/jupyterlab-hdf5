from typing import Generic, TypeVar
from h5grove.content import DatasetContent, EntityContent, ExternalLinkContent, GroupContent, ResolvedEntityContent, SoftLinkContent
from h5grove.utils import LinkError
import h5py
import h5grove
from .util import attrMetaDict, dsetChunk, shapemeta, uriJoin


H5GroveEntity = TypeVar("H5GroveEntity", DatasetContent, EntityContent, ExternalLinkContent, GroupContent, ResolvedEntityContent, SoftLinkContent)


class EntityResponse(Generic[H5GroveEntity]):
    def __init__(self, h5grove_entity: H5GroveEntity):
        self.h5grove_entity = h5grove_entity

    def contents(self, content=False, ixstr=None, min_ndim=None):
        d = dict(
            (
                ("name", self.name),
                ("uri", self.uri),
                ("type", self.type),
            )
        )
        if not content:
            return d

        return dict(
            (
                ("content", self.metadata(ixstr=ixstr, min_ndim=min_ndim)),
                *d.items(),
            )
        )

    def metadata(self, **kwargs):
        return dict((("name", self.name), ("type", self.type)))

    @property
    def name(self):
        return self.h5grove_entity.name

    @property
    def uri(self):
        return self.h5grove_entity._path

    @property
    def type(self):
        return self.h5grove_entity.type


class ExternalLinkResponse(EntityResponse[ExternalLinkContent]):
    def metadata(self, **kwargs):
        return dict(
            sorted(
                (
                    *super().metadata().items(),
                    ("targetFile", self.h5grove_entity._target_file),
                    ("targetUri", self.h5grove_entity._target_path),
                )
            )
        )


class SoftLinkResponse(EntityResponse[SoftLinkContent]):
    def metadata(self, **kwargs):
        return dict(
            sorted(
                (
                    *super().metadata().items(),
                    ("targetUri", self.h5grove_entity._target_path),
                )
            )
        )


ResolvedH5GroveEntity = TypeVar("ResolvedH5GroveEntity", DatasetContent, GroupContent, ResolvedEntityContent)


class ResolvedEntityResponse(EntityResponse[ResolvedH5GroveEntity]):
    @property
    def _hobj(self):
        return self.h5grove_entity._h5py_entity

    def attributes(self, attr_keys=None):
        return self.h5grove_entity.attributes(attr_keys)

    def metadata(self, **kwargs):
        attribute_names = sorted(self._hobj.attrs.keys())
        return dict((*super().metadata().items(), ("attributes", [attrMetaDict(self._hobj.attrs.get_id(k)) for k in attribute_names])))


class DatasetResponse(ResolvedEntityResponse[DatasetContent]):
    def metadata(self, ixstr=None, min_ndim=None, is_child=False):
        d = super().metadata()
        shapekeys = ("shape") if is_child else ("labels", "ndim", "shape", "size")
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


class GroupResponse(ResolvedEntityResponse[GroupContent]):
    def __init__(self, h5grove_entity: GroupContent, resolve_links: bool):
        super().__init__(h5grove_entity)
        self.resolve_links = resolve_links

    def contents(self, content=False, ixstr=None, min_ndim=None):
        if not content:
            return super().contents(ixstr=ixstr, min_ndim=min_ndim)

        # Recurse one level
        return [
            create_response(self.h5grove_entity._h5file, uriJoin(self.uri, suburi), self.resolve_links).contents(
                content=False,
                ixstr=ixstr,
                min_ndim=min_ndim,
            )
            for suburi in self._hobj.keys()
        ]

    def metadata(self, is_child=False, **kwargs):
        if is_child:
            return super().metadata()

        return dict(
            sorted(
                (
                    ("children", [create_response(self.h5grove_entity._h5file, uriJoin(self.uri, suburi), self.resolve_links).metadata(is_child=True, **kwargs) for suburi in self._hobj.keys()]),
                    *super().metadata().items(),
                )
            )
        )


def create_response(h5file: h5py.File, uri: str, resolve_links: bool):
    try:
        h5grove_entity = h5grove.create_content(h5file, uri, resolve_links)
    except LinkError:
        h5grove_entity = h5grove.create_content(h5file, uri, resolve_links=False)

    if isinstance(h5grove_entity, h5grove.content.ExternalLinkContent):
        return ExternalLinkResponse(h5grove_entity)
    if isinstance(h5grove_entity, h5grove.content.SoftLinkContent):
        return SoftLinkResponse(h5grove_entity)
    if isinstance(h5grove_entity, h5grove.content.DatasetContent):
        return DatasetResponse(h5grove_entity)
    elif isinstance(h5grove_entity, h5grove.content.GroupContent):
        return GroupResponse(h5grove_entity, resolve_links)
    else:
        return ResolvedEntityResponse(h5grove_entity)
