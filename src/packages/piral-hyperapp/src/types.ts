import { ForeignComponent, ExtensionSlotProps } from 'piral-core';

declare module 'piral-core/lib/types/custom' {
  interface PiletCustomApi extends PiletHyperappApi {}

  interface PiralCustomComponentConverters<TProps> {
    hyperapp(component: HyperappComponent<TProps>): ForeignComponent<TProps>;
  }
}

export interface HyperappComponent<TProps> {
  /**
   * The component root.
   */
  root: Component<TProps>;
  /**
   * The local state of the component.
   */
  state: any;
  /**
   * The actions of the component.
   */
  actions: any;
  /**
   * The type of the Hyperapp component.
   */
  type: 'hyperapp';
}

/**
 * The view function describes the application UI as a tree of VNodes.
 * @returns A VNode tree.
 * @memberOf [App]
 */
export interface View<State, Actions> {
  (state: State, actions: Actions): VNode<object> | null;
}

/**
 * The VDOM representation of an Element.
 * @memberOf [VDOM]
 */
export interface VNode<Attributes = {}> {
  nodeName: string;
  attributes?: Attributes;
  children: Array<VNode | string>;
  key: string | number | null;
}

/**
 * A Component is a function that returns a custom VNode or View.
 * @memberOf [VDOM]
 */
export interface Component<Attributes = {}, State = {}, Actions = {}> {
  (attributes: Attributes, children?: Array<VNode | string>): VNode<Attributes> | View<State, Actions>;
}

/**
 * Defines the provided set of hyperapp Pilet API extensions.
 */
export interface PiletHyperappApi {
  /**
   * Gets a Hyperapp component for displaying extensions for the given name.
   * @param name The name of the extensions to display.
   * @returns The extension component to be used.
   */
  getHyperappExtension<T = any>(name: string): Component<ExtensionSlotProps<T>>;
}
