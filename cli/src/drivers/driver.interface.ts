/**
 * Options for establishing a driver connection.
 */
export interface ConnectOptions {
  /** Optional credential map (e.g. username/password, token) */
  credentials?: Record<string, string>;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Metadata describing a file or resource.
 */
export interface FileMetadata {
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  mimeType: string;
  /** Last modification timestamp */
  modifiedAt: Date;
  /** Protocol identifier (e.g. "file", "http") */
  protocol: string;
}

/**
 * Unified driver interface for AVFS protocol access.
 *
 * Every protocol driver must implement this contract. In FT-001, all
 * concrete driver classes are empty stubs — every method throws
 * `new Error("Not implemented")`.
 */
export interface Driver {
  /** Protocol identifier (e.g. "file", "http", "https", "smb", "git") */
  protocol: string;

  /**
   * Establish a connection to the resource base.
   * @param resourceBase - The base address of the resource (e.g. "/var/data", "https://example.com")
   * @param options - Optional connection parameters
   */
  connect(resourceBase: string, options?: ConnectOptions): Promise<void>;

  /**
   * Read a file as a raw binary stream.
   * @param filePath - Path relative to the connected resource base
   * @returns A readable stream of the file contents
   */
  read(filePath: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * Retrieve file metadata.
   * @param filePath - Path relative to the connected resource base
   * @returns File metadata (size, type, modification time, etc.)
   */
  stat(filePath: string): Promise<FileMetadata>;

  /**
   * Release the connection and free associated resources.
   */
  close(): Promise<void>;
}
