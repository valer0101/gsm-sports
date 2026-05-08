import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  describe('liveness', () => {
    it('returns ok with uptime + timestamp without touching the database', () => {
      const dataSource = { query: vi.fn() } as unknown as Parameters<
        typeof HealthController.prototype.constructor
      >[0];
      const ctrl = new HealthController(
        dataSource as unknown as ConstructorParameters<typeof HealthController>[0],
      );
      const res = ctrl.liveness();
      expect(res.status).toBe('ok');
      expect(typeof res.uptime).toBe('number');
      expect(res.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof res.timestamp).toBe('string');
      // Liveness MUST NOT depend on DB — orchestrators use it for restart
      // decisions and a brief DB outage should not bounce the container.
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('returns ok when the database query succeeds', async () => {
      const dataSource = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
      const ctrl = new HealthController(
        dataSource as unknown as ConstructorParameters<typeof HealthController>[0],
      );
      const res = await ctrl.readiness();
      expect(res.status).toBe('ok');
      expect(res.checks.db).toBe('ok');
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('throws 503 with details when the database is unreachable', async () => {
      const dataSource = {
        query: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      };
      const ctrl = new HealthController(
        dataSource as unknown as ConstructorParameters<typeof HealthController>[0],
      );

      await expect(ctrl.readiness()).rejects.toThrow(HttpException);

      try {
        await ctrl.readiness();
      } catch (err) {
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        const body = httpErr.getResponse() as {
          status: string;
          checks: { db: string; dbError?: string };
        };
        expect(body.status).toBe('unavailable');
        expect(body.checks.db).toBe('error');
        expect(body.checks.dbError).toMatch(/ECONNREFUSED/);
      }
    });
  });
});
