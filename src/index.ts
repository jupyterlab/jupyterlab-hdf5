import { JupyterLab, JupyterLabPlugin } from "@jupyterlab/application";

import { URLExt } from "@jupyterlab/coreutils";

import { ServerConnection } from "@jupyterlab/services";

import "../style/index.css";

const hdf5PluginId = "jupyterlab-hdf:plugin";

namespace CommandIDs {
  /**
   * Fetch metadata from an hdf5 file
   */
  export const fetchMetaHdf = "hdf:fetchMeta";
}

/**
 * Initialization data for the jupyterlab-hdf5 extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: hdf5PluginId,
  autoStart: true,
  activate: activateHdfPlugin
};

export default extension;

function metadHdfRequest(
  path: string,
  settings: ServerConnection.ISettings
): Promise<any> {
  let fullUrl = URLExt.join(settings.baseUrl, "hdf", "metadata", path);

  return ServerConnection.makeRequest(fullUrl, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.text();
  });
}

/**
 * Activate the file browser.
 */
function activateHdfPlugin(app: JupyterLab): void {
  const { commands } = app;

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  commands.addCommand(CommandIDs.fetchMetaHdf, {
    execute: args => {
      const path = args["path"] as string;
      const meta = metadHdfRequest(path, serverSettings);
      console.log(meta);
    },
    label: "Fetch HDF5 metadata"
  });

  return;
}
