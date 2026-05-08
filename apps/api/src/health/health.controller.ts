import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

/**
 * Liveness + readiness probes. Public, no auth — load balancers,
 * uptime monitors, and container orchestrators (k8s, Railway,
 * Render, Fly.io) hit these without credentials.
 *
 * `/health`  — process is alive. Always 200 once Nest has booted.
 *               Used by orchestrators to decide "is the container
 *               still running?" — does NOT touch the DB so a brief
 *               DB outage doesn't trigger pod restarts.
 *
 * `/ready`   — process is alive AND able to serve traffic. Pings
 *               the database. Returns 503 with details if the DB is
 *               unreachable so the load balancer drops the instance
 *               from rotation until it recovers.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe — process is up' })
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — DB reachable, accepting traffic' })
  async readiness() {
    let db: 'ok' | 'error' = 'ok';
    let dbError: string | undefined;
    try {
      await this.dataSource.query('SELECT 1');
    } catch (err) {
      db = 'error';
      dbError = err instanceof Error ? err.message : 'unknown';
    }

    const ready = db === 'ok';
    const body = {
      status: ready ? 'ok' : 'unavailable',
      checks: { db, ...(dbError ? { dbError } : {}) },
      timestamp: new Date().toISOString(),
    };
    if (!ready) {
      // Return 503 so load balancers / orchestrators take the instance
      // out of rotation until the DB is back. The body still carries the
      // failure breakdown for observability.
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
