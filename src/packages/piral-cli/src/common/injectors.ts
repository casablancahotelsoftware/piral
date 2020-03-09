import * as Bundler from 'parcel-bundler';
import chalk from 'chalk';
import { KrasConfigurationInjectors } from 'kras';
import { liveIcon, settingsIcon } from './emoji';
import { logInfo, log } from './log';

export function reorderInjectors(injectorName: string, injectorConfig: any, injectors: KrasConfigurationInjectors) {
  return {
    script: injectors.script || {
      active: true,
    },
    har: injectors.har || {
      active: true,
    },
    json: injectors.json || {
      active: true,
    },
    [injectorName]: injectorConfig,
    ...injectors,
  };
}

export function notifyServerOnline(bundler: Bundler, api: string | false) {
  return (svc: any) => {
    log('generalDebug_0003', `The kras server for debugging is online!`);
    const address = `${svc.protocol}://localhost:${chalk.green(svc.port)}`;
    logInfo(`${liveIcon}  Running at ${chalk.bold(address)}.`);
    logInfo(`${settingsIcon}  Manage via ${chalk.bold(address + api)}.`);
    bundler.bundle();
  };
}
