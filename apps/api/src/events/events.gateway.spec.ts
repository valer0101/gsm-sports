import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;

  const mockServer = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };

  const mockSocket = {
    id: 'socket-1',
    join: vi.fn(),
    leave: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleJoin', () => {
    it('should join tournament room', () => {
      const result = gateway.handleJoin('tournament-1', mockSocket as any);
      expect(mockSocket.join).toHaveBeenCalledWith('tournament:tournament-1');
      expect(result).toEqual({ event: 'joined', data: { tournamentId: 'tournament-1' } });
    });
  });

  describe('handleLeave', () => {
    it('should leave tournament room', () => {
      const result = gateway.handleLeave('tournament-1', mockSocket as any);
      expect(mockSocket.leave).toHaveBeenCalledWith('tournament:tournament-1');
      expect(result).toEqual({ event: 'left', data: { tournamentId: 'tournament-1' } });
    });
  });

  describe('emitBracketUpdate', () => {
    it('should emit bracket_updated to tournament room', () => {
      const bracketData = { players: [], matches: [] } as any;
      gateway.emitBracketUpdate('tournament-1', 'bracket-1', bracketData);
      expect(mockServer.to).toHaveBeenCalledWith('tournament:tournament-1');
      expect(mockServer.emit).toHaveBeenCalledWith('bracket_updated', {
        bracketId: 'bracket-1',
        bracketData,
      });
    });
  });
});
