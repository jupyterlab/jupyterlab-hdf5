# -*- coding: utf-8 -*-

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from traitlets.config import Configurable
from traitlets.traitlets import Bool


class HdfConfig(Configurable):
    resolve_links = Bool(False, config=True, help=("Whether soft and external links should be resolved when exploring HDF5 files."))
