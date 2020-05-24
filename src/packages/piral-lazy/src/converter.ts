import {
  ForeignComponent,
  BaseComponentProps,
  PiralLoadingIndicator,
  renderInDom,
  convertComponent,
  ComponentContext,
  GlobalStateContext,
} from 'piral-core';
import { LazyComponentLoader } from './types';

export function createConverter(context: GlobalStateContext) {
  const convert = <TProps extends BaseComponentProps>(load: LazyComponentLoader<TProps>): ForeignComponent<TProps> => {
    let present: [HTMLElement, any, ComponentContext] = undefined;
    let portalId: string = undefined;
    const promise = load.current || (load.current = load().then(c => convertComponent(context.converters[c.type], c)));
    const component: ForeignComponent<TProps> = {
      mount(...args) {
        portalId = renderInDom(context, args[0], PiralLoadingIndicator, {});
        present = args;
      },
      update(...args) {
        present = args;
      },
      unmount() {
        portalId = undefined;
        present = undefined;
      },
    };
    promise.then(({ mount, unmount, update }) => {
      portalId && context.destroyPortal(portalId);
      component.mount = mount;
      component.unmount = unmount;
      component.update = update;
      present && mount(...present);
    });

    return component;
  };
  return convert;
}