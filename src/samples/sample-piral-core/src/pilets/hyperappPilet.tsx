import { Pilet } from 'piral-core';
import { Component } from 'piral-hyperapp';
import { TileComponentProps } from 'piral-dashboard';

// If isolated we could easily also import hyperapp
// and set up tsconfig.json to use jsxFactory h.
// Reasons for not using here:
// - import hyperapp overrides global JSX and destroys React (if used in same project)
// - using another jsxFactory also destroys React (if used in same project)
// For illustration purposes we therefore fall back to "require"
const { h } = require('hyperapp');

const state = {
  count: 0,
};

const actions = {
  down: value => state => ({ count: state.count - value }),
  up: value => state => ({ count: state.count + value }),
};

const Tile: Component<TileComponentProps, typeof state, typeof actions> = props => {
  const Smiley = props.piral.getHyperappExtension('smiley');
  return (state, actions) =>
    h(
      'div',
      {
        class: 'tile',
      },
      h('h3', {}, `Hyperapp: ${state.count}`),
      h('p', {}, `${props.rows} rows and ${props.columns} columns`, Smiley({}, [])),
      h(
        'button',
        {
          onclick: () => actions.up(1),
        },
        '+',
      ),
      h(
        'button',
        {
          onclick: () => actions.down(1),
        },
        '-',
      ),
    );
};

/**
 * Shows an API extension using hyperapp components.
 */
export const HyperappPilet: Pilet = {
  content: '',
  name: 'Hyperapp Module',
  version: '1.0.0',
  hash: '521',
  setup(piral) {
    piral.registerTile(
      {
        root: Tile,
        state,
        actions,
        type: 'hyperapp',
      },
      {
        initialColumns: 2,
        initialRows: 2,
      },
    );
  },
};
