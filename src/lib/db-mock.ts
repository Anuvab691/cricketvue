// This file simulates the database layer for the preview.
// In a real app, this would use Prisma client.

export type User = {
  id: string;
  username: string;
  tokenBalance: number;
  isActive: boolean;
};

export type Match = {
  id: string;
  teamA: string;
  teamB: string;
  startTime: string;
  status: 'upcoming' | 'live' | 'finished';
  markets: Market[];
};

export type Market = {
  id: string;
  matchId: string;
  type: 'match_winner' | 'next_ball';
  status: 'open' | 'closed';
  selections: Selection[];
};

export type Selection = {
  id: string;
  marketId: string;
  name: string;
  odds: number;
};

export type Bet = {
  id: string;
  userId: string;
  selectionId: string;
  matchInfo: string;
  selectionName: string;
  stake: number;
  odds: number;
  potentialWin: number;
  betType: 'pre_match' | 'live_micro';
  status: 'open' | 'won' | 'lost';
  createdAt: string;
};

export type Transaction = {
  id: string;
  userId: string;
  type: 'bet' | 'win' | 'loss';
  amount: number;
  balanceAfter: number;
  createdAt: string;
};

const MOCK_USER: User = {
  id: 'user_1',
  username: 'DemoUser',
  tokenBalance: 2500.0,
  isActive: true,
};

const MOCK_MATCHES: Match[] = [
  {
    id: 'm1',
    teamA: 'India',
    teamB: 'Australia',
    startTime: new Date().toISOString(),
    status: 'live',
    markets: [
      {
        id: 'mark1',
        matchId: 'm1',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 's1', marketId: 'mark1', name: 'India', odds: 1.85 },
          { id: 's2', marketId: 'mark1', name: 'Australia', odds: 2.10 },
        ],
      },
      {
        id: 'mark2',
        matchId: 'm1',
        type: 'next_ball',
        status: 'open',
        selections: [
          { id: 's3', marketId: 'mark2', name: 'Next Ball 6', odds: 5.0 },
          { id: 's4', marketId: 'mark2', name: 'Next Ball Wicket', odds: 3.5 },
        ],
      },
    ],
  },
  {
    id: 'm2',
    teamA: 'England',
    teamB: 'South Africa',
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'upcoming',
    markets: [
      {
        id: 'mark3',
        matchId: 'm2',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 's5', marketId: 'mark3', name: 'England', odds: 1.95 },
          { id: 's6', marketId: 'mark3', name: 'South Africa', odds: 1.95 },
        ],
      },
    ],
  },
];

let bets: Bet[] = [];
let transactions: Transaction[] = [];
let user = { ...MOCK_USER };

export const db = {
  getUser: () => user,
  getMatches: () => MOCK_MATCHES,
  getMatchById: (id: string) => MOCK_MATCHES.find(m => m.id === id),
  getBets: () => bets,
  getTransactions: () => transactions,
  placeBet: (betData: Omit<Bet, 'id' | 'createdAt' | 'status'>) => {
    if (user.tokenBalance < betData.stake) {
      throw new Error('Insufficient balance');
    }
    
    const newBet: Bet = {
      ...betData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: 'open',
    };
    
    user.tokenBalance -= betData.stake;
    bets = [newBet, ...bets];
    
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      type: 'bet',
      amount: -betData.stake,
      balanceAfter: user.tokenBalance,
      createdAt: new Date().toISOString(),
    };
    transactions = [newTransaction, ...transactions];
    
    return { bet: newBet, user };
  },
  settleBet: (betId: string, result: 'won' | 'lost') => {
    const betIndex = bets.findIndex(b => b.id === betId);
    if (betIndex === -1) return;
    
    const bet = bets[betIndex];
    if (bet.status !== 'open') return;
    
    bet.status = result;
    
    if (result === 'won') {
      user.tokenBalance += bet.potentialWin;
      const winTransaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        type: 'win',
        amount: bet.potentialWin,
        balanceAfter: user.tokenBalance,
        createdAt: new Date().toISOString(),
      };
      transactions = [winTransaction, ...transactions];
    }
  }
};