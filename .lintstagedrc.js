const escape = require('shell-quote').quote;
const fs = require('fs');
const isWin = process.platform === 'win32';

const escapeFileNames = filenames =>
  filenames
    .filter(filename => fs.existsSync(filename))
    .map(filename => `"${isWin ? filename : escape([filename])}"`)
    .join(' ');

module.exports = {
  '**/*{.css,.json,.md}': filenames => {
    const escapedFileNames = escapeFileNames(filenames);
    return [`prettier --write ${escapedFileNames}`];
  },
  '**/*{.ts,.tsx,.js,.jsx}': filenames => {
    const escapedFileNames = escapeFileNames(filenames);
    return [
      `prettier --write ${escapedFileNames}`,
      `eslint --fix ${escapedFileNames}`,
    ];
  },
  'jupyterlab_hdf/**/*.py': filenames => {
    const escapedFileNames = escapeFileNames(filenames);
    return [`black ${escapedFileNames}`];
  },
  'setup.py': filenames => {
    const escapedFileNames = escapeFileNames(filenames);
    return [`black ${escapedFileNames}`];
  },
};
