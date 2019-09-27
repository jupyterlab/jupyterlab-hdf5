    '''
    Code from the HDF Server Repo (app.py)
    '''


    def getSliceQueryParam(self, dim, extent):
        """
        Helper method - return slice for dim based on query params
        Query arg should be in the form: [<dim1>, <dim2>, ... , <dimn>]
         brackets are optional for one dimensional arrays.
         Each dimension, valid formats are:
            single integer: n
            start and end: n:m
            start, end, and stride: n:m:s
        """
        
        # Get optional query parameters for given dim
        self.log.info("getSliceQueryParam: " + str(dim) + ", " + str(extent))
        query = self.get_query_argument("select", default='ALL')
        if query == 'ALL':
            # just return a slice for the entire dimension
            self.log.info("getSliceQueryParam: return default")
            return slice(0, extent)

        self.log.info("select query value: [" + query + "]")

        if not query.startswith('['):
            msg = "Bad Request: selection query missing start bracket"
            self.log.info(msg)
            raise HTTPError(400, reason=msg)
        if not query.endswith(']'):
            msg = "Bad Request: selection query missing end bracket"
            self.log.info(msg)
            raise HTTPError(400, reason=msg)

        # now strip out brackets
        query = query[1:-1]

        query_array = query.split(',')
        if dim > len(query_array):
            msg = "Not enough dimensions supplied to query argument"
            self.log.info(msg)
            raise HTTPError(400, reason=msg)
        dim_query = query_array[dim].strip()
        start = 0
        stop = extent
        step = 1
        if dim_query.find(':') < 0:
            # just a number - return start = stop for this value
            try:
                start = int(dim_query)
            except ValueError:
                msg = "Bad Request: invalid selection parameter (can't convert to int) for dimension: " + str(dim)
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            stop = start
        elif dim_query == ':':
            # select everything
            pass
        else:
            fields = dim_query.split(":")
            if len(fields) > 3:
                msg = "Bad Request: Too many ':' seperators for dimension: " + str(dim)
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            try:
                if fields[0]:
                    start = int(fields[0])
                if fields[1]:
                    stop = int(fields[1])
                if len(fields) > 2 and fields[2]:
                    step = int(fields[2])
            except ValueError:
                msg = "Bad Request: invalid selection parameter (can't convert to int) for dimension: " + str(dim)
                self.log.info(msg)
                raise HTTPError(400, reason=msg)

        if start < 0 or start > extent:
            msg = "Bad Request: Invalid selection start parameter for dimension: " + str(dim)
            self.log.info(msg)
            raise HTTPError(400, reason=msg)
        if stop > extent:
            msg = "Bad Request: Invalid selection stop parameter for dimension: " + str(dim)
            self.log.info(msg)
            raise HTTPError(400, reason=msg)
        if step <= 0:
            msg = "Bad Request: invalid selection step parameter for dimension: " + str(dim)
            self.log.info(msg)
            raise HTTPError(400, reason=msg)
        s = slice(start, stop, step)
        self.log.info(
            "dim query[" + str(dim) + "] returning: start: " +
            str(start) + " stop: " + str(stop) + " step: " + str(step))
        return s

    def getHyperslabSelection(self, dsetshape, start, stop, step):
        """
        Get slices given lists of start, stop, step values
        """
        rank = len(dsetshape)
        if start:
            if type(start) is not list:
                start = [start]
            if len(start) != rank:
                msg = "Bad Request: start array length not equal to dataset rank"
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            for dim in range(rank):
                if start[dim] < 0 or start[dim] >= dsetshape[dim]:
                    msg = "Bad Request: start index invalid for dim: " + str(dim)
                    self.log.info(msg)
                    raise HTTPError(400, reason=msg)
        else:
            start = []
            for dim in range(rank):
                start.append(0)

        if stop:
            if type(stop) is not list:
                stop = [stop]
            if len(stop) != rank:
                msg = "Bad Request: stop array length not equal to dataset rank"
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            for dim in range(rank):
                if stop[dim] <= start[dim] or stop[dim] > dsetshape[dim]:
                    msg = "Bad Request: stop index invalid for dim: " + str(dim)
                    self.log.info(msg)
                    raise HTTPError(400, reason=msg)
        else:
            stop = []
            for dim in range(rank):
                stop.append(dsetshape[dim])

        if step:
            if type(step) is not list:
                step = [step]
            if len(step) != rank:
                msg = "Bad Request: step array length not equal to dataset rank"
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            for dim in range(rank):
                if step[dim] <= 0 or step[dim] > dsetshape[dim]:
                    msg = "Bad Request: step index invalid for dim: " + str(dim)
                    self.log.info(msg)
                    raise HTTPError(400, reason=msg)
        else:
            step = []
            for dim in range(rank):
                step.append(1)

        slices = []
        for dim in range(rank):
            try:
                s = slice(int(start[dim]), int(stop[dim]), int(step[dim]))
            except ValueError:
                msg = "Bad Request: invalid start/stop/step value"
                self.log.info(msg)
                raise HTTPError(400, reason=msg)
            slices.append(s)
        return tuple(slices)