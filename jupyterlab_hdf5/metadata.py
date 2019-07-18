""" JupyterLab HDF : HDF5 file viewer for Jupyterlab """

from collections import namedtuple
import glob
import h5py
import os
import re
from tornado import gen, web

from notebook.base.handlers import APIHandler

# from .config import HdfConfig

MetaHdf = namedtuple('Meta', ('kind', 'name', 'uri'))

_emptyUriRe = re.compile('//')
def uriJoin(*parts):
    return _emptyUriRe.sub('/', '/'.join(parts))

def genMetaHdf(group, prefix='/'):
    return (MetaHdf(
        'group' if isinstance(val, h5py.Group) else 'dataset',
        key,
        uriJoin(prefix, key)
    ) for key,val in group.items())

def genMetaAllHdf(group, prefix='/'):
    yield from genMetaHdf(group, prefix)

    for key,val in group.items():
        if isinstance(val, h5py.Group):
            yield from genMetaAllHdf(val, uriJoin(prefix, key))

class HdfMetadataHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir


    def build_tex_cmd_sequence(self, tex_base_name, run_bibtex=False):
        """Builds tuples that will be used to call LaTeX shell commands.

        Parameters
        ----------
        tex_base_name: string
            This is the name of the tex file to be compiled, without its
            extension.

        returns:
            A list of tuples of strings to be passed to
            `tornado.process.Subprocess`.

        """
        c = LatexConfig(config=self.config)

        escape_flag = ''
        if c.shell_escape == 'allow':
            escape_flag = '-shell-escape'
        elif c.shell_escape == 'disallow':
            escape_flag = '-no-shell-escape'
        elif c.shell_escape == 'restricted':
            escape_flag = '-shell-restricted'

        # Get the synctex query parameter, defaulting to
        # 1 if it is not set or is invalid.
        synctex = self.get_query_argument('synctex', default='1')
        synctex = '1' if synctex != '0' else synctex

        full_latex_sequence = (
            c.latex_command,
            escape_flag,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            f"-synctex={synctex}",
            f"{tex_base_name}",
            )

        full_bibtex_sequence = (
            c.bib_command,
            f"{tex_base_name}",
            )

        command_sequence = [full_latex_sequence]

        if run_bibtex:
            command_sequence += [
                full_bibtex_sequence,
                full_latex_sequence,
                full_latex_sequence,
                ]

        return command_sequence

    def bib_condition(self):
        """Determines whether BiBTeX should be run.

        Returns
        -------
        boolean
            true if BibTeX should be run.

        """
        return any([re.match(r'.*\.bib', x) for x in set(glob.glob("*"))])


    @gen.coroutine
    def run_latex(self, command_sequence):
        """Run commands sequentially, returning a 500 code on an error.

        Parameters
        ----------
        command_sequence : list of tuples of strings
            This is a sequence of tuples of strings to be passed to
            `tornado.process.Subprocess`, which are to be run sequentially.
            On Windows, `tornado.process.Subprocess` is unavailable, so
            we use the synchronous `subprocess.run`.

        Returns
        -------
        string
            Response is either a success or an error string.

        Notes
        -----
        - LaTeX processes only print to stdout, so errors are gathered from
          there.

        """

        for cmd in command_sequence:
            code, output = yield run_command(cmd)
            if code != 0:
                self.set_status(500)
                self.log.error((f'LaTeX command `{" ".join(cmd)}` '
                                 f'errored with code: {code}'))
                return output

        return "LaTeX compiled"

    @web.authenticated
    @gen.coroutine
    def wrapperHDF(self, func, mode='r', **kwargs):
        """if self.file==None, run the function (with *args) inside a 'with' block that assigns the hdf5 file object to self.file, then resets self.file to None
        else (self.file already contains something (hopefully the relevant hdf5 file)), just run the function (with *args)
        """
        if self.file==None:
            try:
                with h5py.File(self.fpathStr, mode) as self.file:
                    retVal = func(**kwargs)
            except OSError:
                retVal = False
            # not entirely sure why this has to be a finally: block, but without it there do seem to be cases where .file doesn't get Noned out
            finally:
                # be sure there are no return statements anywhere in the try-except-finally or else the finally will eat any fatal exceptions
                self.file = None
        else:
            retVal = func(**kwargs)
        return retVal

    @web.authenticated
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run LaTeX, cleanup, and respond when done.
        """
        # Parse the path into the base name and extension of the file
        tex_file_path = os.path.join(self.notebook_dir, path.strip('/'))
        tex_base_name, ext = os.path.splitext(os.path.basename(tex_file_path))

        if not os.path.exists(tex_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{tex_file_path}`."
        elif ext != '.tex':
            self.set_status(400)
            out = (f"The file at `{tex_file_path}` does not end with .tex. "
                    "You can only run LaTeX on a file ending with .tex.")
        else:
            with latex_cleanup(
                workdir=os.path.dirname(tex_file_path),
                whitelist=[tex_base_name+'.pdf', tex_base_name+'.synctex.gz'],
                greylist=[tex_base_name+'.aux']
                ):
                bibtex = self.bib_condition()
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name,
                                                           run_bibtex=bibtex)
                out = yield self.run_latex(cmd_sequence)
        self.finish(out)

