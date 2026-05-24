import type { Driver, ConnectOptions, FileMetadata } from './driver.interface.js';

/**
 * SMB (Server Message Block) protocol driver.
 *
 * @remarks FT-001 stub — all methods throw `Not implemented`.
 */
export class SmbDriver implements Driver {
  readonly protocol = 'smb';

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
