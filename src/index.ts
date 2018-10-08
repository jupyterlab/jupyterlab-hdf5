import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import '../style/index.css';


/**
 * Initialization data for the jupyterlab-hdf5 extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab-hdf5',
  autoStart: true,
  activate: (app: JupyterLab) => {
    console.log('JupyterLab extension jupyterlab-hdf5 is activated!');
  }
};

export default extension;
