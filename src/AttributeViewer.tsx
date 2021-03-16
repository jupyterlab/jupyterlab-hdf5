// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

class AttributeViewer extends ReactWidget {
  readonly attributes: Array<[string, any]>;

  constructor(attributes: Record<string, any>) {
    super();
    this.attributes = Object.entries(attributes);
  }

  render(): JSX.Element {
    return (
      <table className="jhdf-attribute-table">
        <thead>
          <tr>
            <th scope="col" colSpan={2}>
              Attributes
            </th>
          </tr>
        </thead>
        <tbody>
          {this.attributes.length === 0 ? (
            <tr>
              <td>No attributes.</td>
            </tr>
          ) : (
            this.attributes.map(
              ([name, value]): JSX.Element => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{JSON.stringify(value)}</td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    );
  }
}

export default AttributeViewer;
