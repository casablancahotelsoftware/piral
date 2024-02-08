import { relative, dirname, basename, resolve } from 'path';
import { LogLevels, PiletSchemaVersion, PiletPublishSource, PublishScheme } from '../types';
import {
  postFile,
  readBinary,
  matchFiles,
  createPiletPackage,
  logDone,
  fail,
  setLogLevel,
  progress,
  log,
  config,
  checkExists,
  findNpmTarball,
  downloadFile,
  matchAnyPilet,
  triggerBuildPilet,
} from '../common';

export interface PublishPiletOptions {
  /**
   * Sets the root module's path to use as source starting point when
   * used with `--fresh`, otherwise expects source to be a path leading
   * to a `*.tgz` file.
   */
  source?: string | Array<string>;

  /**
   * Sets the URL of the feed service to deploy to.
   */
  url?: string;

  /**
   * Sets the API key to use.
   */
  apiKey?: string;

  /**
   * Sets the log level to use (1-5).
   */
  logLevel?: LogLevels;

  /**
   * Specifies if the pilet should be built before publishing.
   * If yes, then the tarball is created from fresh build artifacts.
   */
  fresh?: boolean;

  /**
   * Defines a custom certificate for the feed service.
   */
  cert?: string;

  /**
   * Sets the schema version of the pilet. Usually, the default one should be picked.
   */
  schemaVersion?: PiletSchemaVersion;

  /**
   * Changing the publish source makes it possible to publish pilets that have
   * been stored on non-local paths, e.g., when a pilet was already published to
   * an npm feed.
   */
  from?: PiletPublishSource;

  /**
   * Places additional fields that should be posted to the feed service.
   */
  fields?: Record<string, string>;

  /**
   * Places additional headers that should be posted to the feed service.
   */
  headers?: Record<string, string>;

  /**
   * Defines if authorization tokens can be retrieved interactively.
   */
  interactive?: boolean;

  /**
   * Sets the bundler to use for building, if any specific.
   */
  bundlerName?: string;

  /**
   * Sets the authorization scheme to use.
   */
  mode?: PublishScheme;

  /**
   * Additional arguments for a specific bundler.
   */
  _?: Record<string, any>;

  /**
   * Hooks to be triggered at various stages.
   */
  hooks?: {
    beforeBuild?(e: any): Promise<void>;
    afterBuild?(e: any): Promise<void>;
    beforeDeclaration?(e: any): Promise<void>;
    afterDeclaration?(e: any): Promise<void>;
  };
}

export const publishPiletDefaults: PublishPiletOptions = {
  url: undefined,
  apiKey: undefined,
  fresh: false,
  cert: undefined,
  logLevel: LogLevels.info,
  schemaVersion: undefined,
  mode: 'basic',
  from: 'local',
  fields: {},
  headers: {},
  interactive: false,
};

async function getFiles(
  baseDir: string,
  sources: Array<string>,
  from: PiletPublishSource,
  fresh: boolean,
  originalSchemaVersion: PiletSchemaVersion,
  logLevel: LogLevels,
  bundlerName: string,
  _?: Record<string, any>,
  ca?: Buffer,
  hooks?: PublishPiletOptions['hooks'],
): Promise<Array<string>> {
  if (fresh) {
    log('generalDebug_0003', 'Detected "--fresh". Trying to resolve the package.json.');
    const allEntries = await matchAnyPilet(baseDir, sources);

    if (allEntries.length === 0) {
      fail('entryFileMissing_0077');
    }

    return await Promise.all(
      allEntries.map(async (entryModule) => {
        progress('Triggering pilet build ...');

        const { root, piletPackage } = await triggerBuildPilet({
          _,
          bundlerName,
          entryModule,
          fresh,
          logLevel,
          originalSchemaVersion,
          watch: false,
          optimizeModules: false,
          sourceMaps: true,
          declaration: true,
          contentHash: true,
          minify: true,
          hooks,
        });

        const name = piletPackage.name;
        log('generalDebug_0003', `Pilet "${name}" built successfully!`);
        progress('Triggering pilet pack ...');

        const file = await createPiletPackage(root, '.', '.');
        log('generalDebug_0003', `Pilet "${name}" packed successfully!`);

        return file;
      }),
    );
  } else {
    log('generalDebug_0003', `Did not find fresh flag. Trying to match from "${from}".`);

    switch (from) {
      case 'local': {
        log('generalDebug_0003', `Matching files using "${sources.join('", "')}".`);
        const allFiles = await Promise.all(sources.map((s) => matchFiles(baseDir, s)));
        return allFiles.reduce((result, files) => [...result, ...files], []);
      }
      case 'remote': {
        log('generalDebug_0003', `Download file from "${sources.join('", "')}".`);
        const allFiles = await Promise.all(sources.map((s) => downloadFile(s, ca)));
        return allFiles.reduce((result, files) => [...result, ...files], []);
      }
      case 'npm': {
        log('generalDebug_0003', `View npm package "${sources.join('", "')}".`);
        const allUrls = await Promise.all(sources.map((s) => findNpmTarball(s)));
        log('generalDebug_0003', `Download file from "${allUrls.join('", "')}".`);
        const allFiles = await Promise.all(allUrls.map((url) => downloadFile(url, ca)));
        return allFiles.reduce((result, files) => [...result, ...files], []);
      }
    }
  }
}

export async function publishPilet(baseDir = process.cwd(), options: PublishPiletOptions = {}) {
  const {
    fresh = publishPiletDefaults.fresh,
    source = fresh ? './src/index' : '*.tgz',
    url = config.url ?? publishPiletDefaults.url,
    apiKey = config.apiKeys?.[url] ?? config.apiKey ?? publishPiletDefaults.apiKey,
    logLevel = publishPiletDefaults.logLevel,
    from = publishPiletDefaults.from,
    schemaVersion = publishPiletDefaults.schemaVersion,
    cert = config.cert ?? publishPiletDefaults.cert,
    fields = publishPiletDefaults.fields,
    headers = publishPiletDefaults.headers,
    mode = publishPiletDefaults.mode,
    interactive = publishPiletDefaults.interactive,
    _ = {},
    hooks = {},
    bundlerName,
  } = options;
  const fullBase = resolve(process.cwd(), baseDir);
  setLogLevel(logLevel);
  progress('Reading configuration ...');

  if (!url) {
    fail('missingPiletFeedUrl_0060');
  }

  log('generalDebug_0003', 'Checking if certificate exists.');
  let ca: Buffer = undefined;

  if (await checkExists(cert)) {
    const dir = dirname(cert);
    const file = basename(cert);
    log('generalDebug_0003', `Reading certificate file "${file}" from "${dir}".`);
    ca = await readBinary(dir, file);
  }

  log('generalDebug_0003', 'Getting the tgz files ...');
  const sources = Array.isArray(source) ? source : [source];
  const files = await getFiles(fullBase, sources, from, fresh, schemaVersion, logLevel, bundlerName, _, ca, hooks);
  const successfulUploads: Array<string> = [];
  log('generalDebug_0003', 'Received available tgz files.');

  if (files.length === 0) {
    fail('missingPiletTarball_0061', sources);
  }

  log('generalInfo_0000', `Using feed service "${url}".`);

  for (const file of files) {
    log('generalDebug_0003', 'Reading the file for upload ...');
    const fileName = relative(fullBase, file);
    const content = await readBinary(fullBase, fileName);

    if (content) {
      progress(`Publishing "%s" to "%s" ...`, file, url);
      const result = await postFile(url, mode, apiKey, content, fields, headers, ca, interactive);

      if (result.success) {
        successfulUploads.push(file);

        if (result.response) {
          log('httpPostResponse_0067', result);
        }

        progress(`Published successfully!`);
      } else if (result.status === 402) {
        log('failedToUploadPayment_0161', result.response);
      } else if (result.status === 409) {
        log('failedToUploadVersion_0162', result.response);
      } else if (result.status === 413) {
        log('failedToUploadSize_0163', result.response);
      } else {
        log('failedToUpload_0062', fileName);
      }
    } else {
      log('failedToRead_0063', fileName);
    }

    log('generalDebug_0003', 'Finished uploading the file.');
  }

  if (files.length === successfulUploads.length) {
    logDone(`Pilet(s) published successfully!`);
  } else {
    fail('failedUploading_0064');
  }
}
