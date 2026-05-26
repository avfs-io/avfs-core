import { describe, it, expect } from 'vitest';
import type { Driver } from '../src/drivers/driver.interface';
import { FileDriver } from '../src/drivers/file.driver';
import { HttpDriver } from '../src/drivers/http.driver';
import { HttpsDriver } from '../src/drivers/https.driver';
import { SmbDriver } from '../src/drivers/smb.driver';
import { GitDriver } from '../src/drivers/git.driver';

const drivers: { name: string; instance: Driver }[] = [
  { name: 'FileDriver', instance: new FileDriver() },
  { name: 'HttpDriver', instance: new HttpDriver() },
  { name: 'HttpsDriver', instance: new HttpsDriver() },
  { name: 'SmbDriver', instance: new SmbDriver() },
  { name: 'GitDriver', instance: new GitDriver() },
];

describe('Drivers', () => {
  for (const { name, instance } of drivers) {
    describe(name, () => {
      it('should have correct protocol string', () => {
        expect(instance.protocol).toBeDefined();
        expect(typeof instance.protocol).toBe('string');
        expect(instance.protocol.length).toBeGreaterThan(0);
      });

      it('should implement connect method', async () => {
        expect(instance.connect).toBeDefined();
        expect(typeof instance.connect).toBe('function');
        // GitDriver validates resourceBase format; others throw 'Not implemented'
        if (name === 'GitDriver') {
          await expect(instance.connect('test')).rejects.toThrow(
            /Invalid Git resourceBase format/,
          );
        } else {
          await expect(instance.connect('test')).rejects.toThrow(
            'Not implemented',
          );
        }
      });

      it('should implement read method', async () => {
        expect(instance.read).toBeDefined();
        expect(typeof instance.read).toBe('function');
        if (name === 'GitDriver') {
          await expect(instance.read('test')).rejects.toThrow(/not connected/);
        } else {
          await expect(instance.read('test')).rejects.toThrow('Not implemented');
        }
      });

      it('should implement stat method', async () => {
        expect(instance.stat).toBeDefined();
        expect(typeof instance.stat).toBe('function');
        if (name === 'GitDriver') {
          await expect(instance.stat('test')).rejects.toThrow(/not connected/);
        } else {
          await expect(instance.stat('test')).rejects.toThrow('Not implemented');
        }
      });

      it('should implement close method', async () => {
        expect(instance.close).toBeDefined();
        expect(typeof instance.close).toBe('function');
        // GitDriver.close() succeeds as a no-op; others throw 'Not implemented'
        if (name === 'GitDriver') {
          await instance.close();
        } else {
          await expect(instance.close()).rejects.toThrow('Not implemented');
        }
      });
    });
  }
});
