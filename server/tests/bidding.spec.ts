import { describe, it, expect } from 'vitest';
import {
  isValidBid,
  canCoinche,
  canSurcoinche,
  processBid,
  processPass,
  processCoinche,
  processSurcoinche,
  createInitialBiddingState,
  getWinningTeam,
  type Bid,
  type BiddingState,
} from '../src/rules/bidding';

describe('Bidding System', () => {
  const turnOrder = ['player1', 'player2', 'player3', 'player4'];

  describe('isValidBid', () => {
    it('should accept first bid of 80 points', () => {
      const state = createInitialBiddingState();
      const bid: Bid = {
        playerId: 'player1',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(true);
    });

    it('should reject first bid below 80 points', () => {
      const state = createInitialBiddingState();
      const bid: Bid = {
        playerId: 'player1',
        contractType: 'spades',
        value: 70,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Minimum bid is 80');
    });

    it('should accept higher value bid', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'clubs',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const bid: Bid = {
        playerId: 'player2',
        contractType: 'diamonds',
        value: 90,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(true);
    });

    it('should accept higher priority at same value', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'clubs',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const bid: Bid = {
        playerId: 'player2',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(true);
    });

    it('should reject lower priority at same value', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const bid: Bid = {
        playerId: 'player2',
        contractType: 'clubs',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(false);
    });

    it('should reject bid after coinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
        coinched: true,
        coinchedBy: 'player2',
      };

      const bid: Bid = {
        playerId: 'player3',
        contractType: 'no_trump',
        value: 90,
        timestamp: new Date().toISOString(),
      };

      const result = isValidBid(bid, state);
      expect(result.valid).toBe(false);
    });
  });

  describe('canCoinche', () => {
    it('should allow opponent to coinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1', // Team A
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const result = canCoinche('player2', state, turnOrder); // Team B
      expect(result.valid).toBe(true);
    });

    it('should not allow same team to coinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1', // Team A (index 0)
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const result = canCoinche('player3', state, turnOrder); // Team A (index 2)
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('own team');
    });

    it('should not allow coinche without active bid', () => {
      const state = createInitialBiddingState();

      const result = canCoinche('player2', state, turnOrder);
      expect(result.valid).toBe(false);
    });
  });

  describe('canSurcoinche', () => {
    it('should allow bidding team to surcoinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1', // Team A
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
        coinched: true,
        coinchedBy: 'player2',
      };

      const result = canSurcoinche('player3', state, turnOrder); // Team A partner
      expect(result.valid).toBe(true);
    });

    it('should not allow opponent to surcoinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1', // Team A
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
        coinched: true,
        coinchedBy: 'player2',
      };

      const result = canSurcoinche('player2', state, turnOrder); // Team B
      expect(result.valid).toBe(false);
    });

    it('should not allow surcoinche without coinche', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const result = canSurcoinche('player1', state, turnOrder);
      expect(result.valid).toBe(false);
    });
  });

  describe('processBid', () => {
    it('should update state with new bid', () => {
      const state = createInitialBiddingState();
      const bid: Bid = {
        playerId: 'player1',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const newState = processBid(bid, state);
      expect(newState.currentBid).toEqual(bid);
      expect(newState.bids).toHaveLength(1);
      expect(newState.passes).toBe(0);
    });

    it('should reset passes on new bid', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        passes: 2,
      };

      const bid: Bid = {
        playerId: 'player1',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const newState = processBid(bid, state);
      expect(newState.passes).toBe(0);
    });
  });

  describe('processPass', () => {
    it('should increment pass count', () => {
      const state = createInitialBiddingState();

      const newState = processPass('player1', state);
      expect(newState.passes).toBe(1);
    });

    it('should trigger redeal after 4 passes without bid', () => {
      let state = createInitialBiddingState();

      state = processPass('player1', state);
      state = processPass('player2', state);
      state = processPass('player3', state);
      state = processPass('player4', state);

      expect(state.status).toBe('redeal');
    });

    it('should end auction after 3 passes with bid', () => {
      let state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      state = processPass('player2', state);
      state = processPass('player3', state);
      state = processPass('player4', state);

      expect(state.status).toBe('ended');
      expect(state.winningBid).toEqual(state.currentBid);
    });
  });

  describe('processCoinche', () => {
    it('should end auction immediately', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1',
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
      };

      const newState = processCoinche('player2', state, turnOrder);
      expect(newState.coinched).toBe(true);
      expect(newState.coinchedBy).toBe('player2');
      expect(newState.status).toBe('ended');
    });
  });

  describe('processSurcoinche', () => {
    it('should end auction immediately', () => {
      const state: BiddingState = {
        ...createInitialBiddingState(),
        currentBid: {
          playerId: 'player1', // Team A (index 0)
          contractType: 'spades',
          value: 80,
          timestamp: new Date().toISOString(),
        },
        coinched: true,
        coinchedBy: 'player2',
      };

      // Player3 is partner of player1 (both Team A)
      const newState = processSurcoinche('player3', state, turnOrder);
      expect(newState.surcoinched).toBe(true);
      expect(newState.status).toBe('ended');
    });
  });

  describe('getWinningTeam', () => {
    it('should return teamA for player at index 0', () => {
      const bid: Bid = {
        playerId: 'player1',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const team = getWinningTeam(bid, turnOrder);
      expect(team).toBe('teamA');
    });

    it('should return teamB for player at index 1', () => {
      const bid: Bid = {
        playerId: 'player2',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const team = getWinningTeam(bid, turnOrder);
      expect(team).toBe('teamB');
    });

    it('should return teamA for player at index 2', () => {
      const bid: Bid = {
        playerId: 'player3',
        contractType: 'spades',
        value: 80,
        timestamp: new Date().toISOString(),
      };

      const team = getWinningTeam(bid, turnOrder);
      expect(team).toBe('teamA');
    });
  });
});
