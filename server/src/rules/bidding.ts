/**
 * Coinche Bidding Phase Logic
 * 
 * Implements the bidding system from specs/rules.md:
 * - Minimum bid of 80 points
 * - Trump options: clubs, diamonds, hearts, spades, no-trump, all-trump
 * - Coinche (double) and Surcoinche (redouble)
 * - Passing and auction end logic
 * 
 * FIXME: there is no priority bidding for coinche, only higher contracts are valid.
 */

export type ContractType = 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'no_trump' | 'all_trump';

export interface Bid {
  playerId: string;
  contractType: ContractType;
  value: number;
  timestamp: string;
}

export interface BiddingState {
  currentBid: Bid | null;
  coinched: boolean;
  coinchedBy: string | null;
  surcoinched: boolean;
  passes: number; // Consecutive passes
  bids: Bid[];
  status: 'active' | 'ended' | 'redeal';
  winningBid: Bid | null;
}

// Contract type priority (for equal values)
const CONTRACT_PRIORITY: Record<ContractType, number> = {
  clubs: 1,
  diamonds: 2,
  hearts: 3,
  spades: 4,
  no_trump: 5,
  all_trump: 6,
};

const MIN_BID_VALUE = 80;

/**
 * Check if a bid is valid
 */
export const isValidBid = (
  bid: Bid,
  currentState: BiddingState,
): { valid: boolean; reason?: string } => {
  // First bid must be at least 80
  if (!currentState.currentBid && bid.value < MIN_BID_VALUE) {
    return { valid: false, reason: `Minimum bid is ${MIN_BID_VALUE} points` };
  }

  // If there's a current bid, new bid must be higher
  if (currentState.currentBid) {
    const currentValue = currentState.currentBid.value;
    const currentPriority = CONTRACT_PRIORITY[currentState.currentBid.contractType];
    const newPriority = CONTRACT_PRIORITY[bid.contractType];

    // Must either increase value or have higher priority at same value
    if (bid.value < currentValue) {
      return { valid: false, reason: 'Bid value must be higher than current bid' };
    }

    if (bid.value === currentValue && newPriority <= currentPriority) {
      return {
        valid: false,
        reason: 'At same value, must bid higher priority contract (clubs < diamonds < hearts < spades < no-trump < all-trump)',
      };
    }
  }

  // Cannot bid after coinche/surcoinche
  if (currentState.coinched || currentState.surcoinched) {
    return { valid: false, reason: 'Cannot bid after coinche/surcoinche' };
  }

  return { valid: true };
};

/**
 * Check if a player can coinche
 */
export const canCoinche = (
  playerId: string,
  currentState: BiddingState,
  turnOrder: string[],
): { valid: boolean; reason?: string } => {
  // Must have an active bid
  if (!currentState.currentBid) {
    return { valid: false, reason: 'No active bid to coinche' };
  }

  // Already coinched
  if (currentState.coinched) {
    return { valid: false, reason: 'Bid already coinched' };
  }

  // Cannot coinche your own team's bid
  const bidderIndex = turnOrder.indexOf(currentState.currentBid.playerId);
  const coincherIndex = turnOrder.indexOf(playerId);
  const sameTeam = Math.abs(bidderIndex - coincherIndex) === 2; // Partners are 2 seats apart

  if (sameTeam) {
    return { valid: false, reason: 'Cannot coinche your own team' };
  }

  return { valid: true };
};

/**
 * Check if a player can surcoinche
 */
export const canSurcoinche = (
  playerId: string,
  currentState: BiddingState,
  turnOrder: string[],
): { valid: boolean; reason?: string } => {
  // Must be coinched first
  if (!currentState.coinched) {
    return { valid: false, reason: 'Bid must be coinched first' };
  }

  // Already surcoinched
  if (currentState.surcoinched) {
    return { valid: false, reason: 'Bid already surcoinched' };
  }

  // Must be from the bidding team
  if (!currentState.currentBid) {
    return { valid: false, reason: 'No active bid' };
  }

  const bidderIndex = turnOrder.indexOf(currentState.currentBid.playerId);
  const surcoincherIndex = turnOrder.indexOf(playerId);
  const sameTeam = Math.abs(bidderIndex - surcoincherIndex) === 2;

  if (!sameTeam) {
    return { valid: false, reason: 'Only bidding team can surcoinche' };
  }

  return { valid: true };
};

/**
 * Process a bid action
 */
export const processBid = (
  bid: Bid,
  currentState: BiddingState,
): BiddingState => {
  const validation = isValidBid(bid, currentState);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return {
    ...currentState,
    currentBid: bid,
    bids: [...currentState.bids, bid],
    passes: 0, // Reset pass count
    coinched: false, // Reset coinche state
    coinchedBy: null,
    surcoinched: false,
  };
};

/**
 * Process a pass action
 */
export const processPass = (
  playerId: string,
  currentState: BiddingState,
): BiddingState => {
  const newPasses = currentState.passes + 1;

  // Four passes without a bid = redeal
  if (!currentState.currentBid && newPasses === 4) {
    return {
      ...currentState,
      passes: newPasses,
      status: 'redeal',
    };
  }

  // Three passes after a bid = auction ends
  if (currentState.currentBid && newPasses === 3) {
    return {
      ...currentState,
      passes: newPasses,
      status: 'ended',
      winningBid: currentState.currentBid,
    };
  }

  return {
    ...currentState,
    passes: newPasses,
  };
};

/**
 * Process a coinche action
 */
export const processCoinche = (
  playerId: string,
  currentState: BiddingState,
  turnOrder: string[],
): BiddingState => {
  const validation = canCoinche(playerId, currentState, turnOrder);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Coinche ends bidding immediately
  return {
    ...currentState,
    coinched: true,
    coinchedBy: playerId,
    passes: 0,
    status: 'ended',
    winningBid: currentState.currentBid,
  };
};

/**
 * Process a surcoinche action
 */
export const processSurcoinche = (
  playerId: string,
  currentState: BiddingState,
  turnOrder: string[],
): BiddingState => {
  const validation = canSurcoinche(playerId, currentState, turnOrder);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Surcoinche ends bidding immediately
  return {
    ...currentState,
    surcoinched: true,
    status: 'ended',
    winningBid: currentState.currentBid,
  };
};

/**
 * Create initial bidding state
 */
export const createInitialBiddingState = (): BiddingState => ({
  currentBid: null,
  coinched: false,
  coinchedBy: null,
  surcoinched: false,
  passes: 0,
  bids: [],
  status: 'active',
  winningBid: null,
});

/**
 * Get the team that won the bid
 */
export const getWinningTeam = (winningBid: Bid, turnOrder: string[]): 'teamA' | 'teamB' => {
  const bidderIndex = turnOrder.indexOf(winningBid.playerId);
  // Team A: players at index 0 and 2
  // Team B: players at index 1 and 3
  return bidderIndex % 2 === 0 ? 'teamA' : 'teamB';
};
