import { DebugTracker } from './DebugTracker';
import { VisualizationWrapper } from './VisualizationWrapper';
import { ExtensionCatalogue } from './ExtensionCatalogue';
import { decycle } from './decycle';
import { setState, initialSettings } from './state';
import { DebuggerOptions } from './types';

export function installPiralDebug(options: DebuggerOptions) {
  const {
    injectPilet,
    getGlobalState,
    getExtensions,
    getRoutes,
    getPilets,
    setPilets,
    fireEvent,
    integrate,
    dependencies,
    createApi,
    loadPilet,
  } = options;
  const events = [];
  const legacyBrowser = !new Error().stack;
  const excludedRoutes = [initialSettings.cataloguePath];
  const selfSource = 'piral-debug-api';
  const debugApiVersion = 'v1';
  const settings = {
    viewState: {
      value: initialSettings.viewState,
      type: 'boolean',
      label: 'State container logging',
    },
    loadPilets: {
      value: initialSettings.loadPilets,
      type: 'boolean',
      label: 'Load available pilets',
    },
    hardRefresh: {
      value: initialSettings.hardRefresh,
      type: 'boolean',
      label: 'Full refresh on change',
    },
    viewOrigins: {
      value: initialSettings.viewOrigins,
      type: 'boolean',
      label: 'Visualize component origins',
    },
    extensionCatalogue: {
      value: initialSettings.extensionCatalogue,
      type: 'boolean',
      label: 'Enable extension catalogue',
    },
  };

  const sendMessage = (content: any) => {
    window.postMessage(
      {
        content,
        source: selfSource,
        version: debugApiVersion,
      },
      '*',
    );
  };

  const setSetting = (setting: { value: any }, key: string, value: any) => {
    setting.value = value;
    sessionStorage.setItem(key, value ? 'on' : 'off');
  };

  const updateSettings = (values: Record<string, any>) => {
    const prev = settings.viewOrigins.value;
    setSetting(settings.viewState, 'dbg:view-state', values.viewState);
    setSetting(settings.loadPilets, 'dbg:load-pilets', values.loadPilets);
    setSetting(settings.hardRefresh, 'dbg:hard-refresh', values.hardRefresh);
    setSetting(settings.viewOrigins, 'dbg:view-origins', values.viewOrigins);
    setSetting(settings.extensionCatalogue, 'dbg:extension-catalogue', values.extensionCatalogue);
    const curr = settings.viewOrigins.value;

    if (prev !== curr) {
      updateVisualize(curr);
    }

    sendMessage({
      settings,
      type: 'settings',
    });
  };

  const togglePilet = (name: string) => {
    const pilet: any = getPilets().find((m) => m.name === name);

    if (pilet.disabled) {
      try {
        const { createApi } = options;
        const newApi = createApi(pilet);
        injectPilet(pilet.original);
        pilet.original.setup(newApi);
      } catch (error) {
        console.error(error);
      }
    } else {
      injectPilet({ name, disabled: true, original: pilet } as any);
    }
  };

  const removePilet = (name: string) => {
    const pilets = getPilets().filter((m) => m.name !== name);
    injectPilet({ name } as any);
    setPilets(pilets);
  };

  const appendPilet = (meta: any) => {
    const { createApi, loadPilet } = options;
    loadPilet(meta).then((pilet) => {
      try {
        const newApi = createApi(pilet);
        injectPilet(pilet);
        pilet.setup(newApi as any);
      } catch (error) {
        console.error(error);
      }
    });
  };

  const toggleVisualize = () => {
    setState((s) => ({
      ...s,
      visualize: {
        ...s.visualize,
        force: !s.visualize.force,
      },
    }));
  };

  const updateVisualize = (active: boolean) => {
    setState((s) => ({
      ...s,
      visualize: {
        ...s.visualize,
        active,
      },
    }));
  };

  const goToRoute = (route: string) => {
    setState((s) => ({
      ...s,
      route,
    }));
  };

  const eventDispatcher = document.body.dispatchEvent;

  const debugApi = {
    debug: debugApiVersion,
    instance: {
      name: process.env.BUILD_PCKG_NAME,
      version: process.env.BUILD_PCKG_VERSION,
      dependencies: process.env.SHARED_DEPENDENCIES,
    },
    build: {
      date: process.env.BUILD_TIME_FULL,
      cli: process.env.PIRAL_CLI_VERSION,
      compat: process.env.DEBUG_PIRAL,
    },
    pilets: {
      dependencies,
      loadPilet,
      createApi,
    },
  };

  const start = () => {
    const container = decycle(getGlobalState());
    const routes = getRoutes().filter((r) => !excludedRoutes.includes(r));
    const extensions = getExtensions();
    const pilets = getPilets().map((pilet: any) => ({
      name: pilet.name,
      version: pilet.version,
      disabled: pilet.disabled,
    }));

    sendMessage({
      type: 'available',
      name: debugApi.instance.name,
      version: debugApi.instance.version,
      kind: debugApiVersion,
      capabilities: ['events', 'container', 'routes', 'pilets', 'settings', 'extensions'],
      state: {
        routes,
        pilets,
        container,
        settings,
        events,
        extensions,
      },
    });
  };

  document.body.dispatchEvent = function (ev: CustomEvent) {
    if (ev.type.startsWith('piral-')) {
      events.unshift({
        id: events.length.toString(),
        name: ev.type.replace('piral-', ''),
        args: ev.detail.arg,
        time: Date.now(),
      });

      sendMessage({
        events,
        type: 'events',
      });
    }

    return eventDispatcher.call(this, ev);
  };

  window.addEventListener('storage', (event) => {
    if (!legacyBrowser && event.storageArea === sessionStorage) {
      // potentially unknowingly updated settings
      updateSettings({
        viewState: sessionStorage.getItem('dbg:view-state') !== 'off',
        loadPilets: sessionStorage.getItem('dbg:load-pilets') === 'on',
        hardRefresh: sessionStorage.getItem('dbg:hard-refresh') === 'on',
        viewOrigins: sessionStorage.getItem('dbg:view-origins') === 'on',
      });
    }
  });

  window.addEventListener('message', (event) => {
    const { source, version, content } = event.data;

    if (source !== selfSource && version === debugApiVersion) {
      switch (content.type) {
        case 'init':
          return start();
        case 'update-settings':
          return updateSettings(content.settings);
        case 'append-pilet':
          return appendPilet(content.meta);
        case 'remove-pilet':
          return removePilet(content.name);
        case 'toggle-pilet':
          return togglePilet(content.name);
        case 'emit-event':
          return fireEvent(content.name, content.args);
        case 'goto-route':
          return goToRoute(content.route);
        case 'visualize-all':
          return toggleVisualize();
      }
    }
  });

  integrate({
    components: {
      Debug: DebugTracker,
    },
    routes: {
      [initialSettings.cataloguePath]: ExtensionCatalogue,
    },
    wrappers: {
      '*': VisualizationWrapper,
    },
    onChange(previous, current, changed) {
      if (settings.viewState.value) {
        const infos = new Error().stack;

        if (infos) {
          // Chrome, Firefox, ... (full capability)
          const lastLine = infos.split('\n')[7];

          if (lastLine) {
            const action = lastLine.replace(/^\s+at\s+(Atom\.|Object\.)?/, '');
            console.group(
              `%c Piral State Change %c ${new Date().toLocaleTimeString()}`,
              'color: gray; font-weight: lighter;',
              'color: black; font-weight: bold;',
            );
            console.log('%c Previous', `color: #9E9E9E; font-weight: bold`, previous);
            console.log('%c Action', `color: #03A9F4; font-weight: bold`, action);
            console.log('%c Next', `color: #4CAF50; font-weight: bold`, current);
            console.groupEnd();
          }
        } else {
          // IE 11, ... (does not know colors etc.)
          console.log('Changed state', previous, current);
        }
      }

      if (changed.pilets) {
        sendMessage({
          type: 'pilets',
          pilets: getPilets().map((pilet: any) => ({
            name: pilet.name,
            version: pilet.version,
            disabled: !!pilet.disabled,
          })),
        });
      }

      if (changed.pages) {
        sendMessage({
          type: 'routes',
          routes: getRoutes().filter((r) => !excludedRoutes.includes(r)),
        });
      }

      if (changed.extensions) {
        sendMessage({
          type: 'extensions',
          routes: getExtensions(),
        });
      }

      sendMessage({
        type: 'container',
        container: decycle(getGlobalState()),
      });
    },
  });

  window['dbg:piral'] = debugApi;
  start();
}
