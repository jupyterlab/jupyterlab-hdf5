import { URLExt } from "@jupyterlab/coreutils";

import { ServerConnection } from "@jupyterlab/services";

export function metadHdfRequest(
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

export class HdfGroup {
  /**
   * ID for the repository.
   */
  name: number;

  /**
   * The owner of the repository.
   */
  owner: any;

  /**
   * The name of the repository.
   */
  name: string;

  /**
   * The full name of the repository, including the owner name.
   */
  // tslint:disable-next-line
  full_name: string;

  /**
   * A description of the repository.
   */
  description: string;

  /**
   * Whether the repository is private.
   */
  private: boolean;

  /**
   * Whether the repository is a fork.
   */
  fork: boolean;

  /**
   * The URL for the repository in the GitHub API.
   */
  url: string;

  /**
   * The URL for the repository in the GitHub UI.
   */
  // tslint:disable-next-line
  html_url: string;
}
