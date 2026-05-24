import type { Driver, ConnectOptions, FileMetadata } from './driver.interface.js';

/**
 * HTTPS protocol driver.
 *
 * @remarks FT-001 stub — all methods throw `Not implemented`.
 */
export class HttpsDriver implements Driver {
  readonly protocol = 'https';

  async connect(_resourceBase: string, _options?: ConnectOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  async read(_filePath: string): Promise<ReadableStream<Uint8Array>> {
    throw new Error('Not implemented');
  }

  async stat(_filePath: string): Promise<FileMetadata> {
    throw new Error('Not implemented');
  }

  async close(): Promise<void> {
    throw new Error('Not implemented');
  }
}
