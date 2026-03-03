
# CivicConnect | CricketVue

The ultimate cricket prediction and insights platform, powered by professional real-time data.

## Getting Started

1. **Authentication**: Sign up or Log in using your email and password.
2. **Dashboard**: View live and upcoming matches synced automatically from the Sportradar API.
3. **Live Insights**: Get AI-powered match predictions and facts.
4. **Mock Betting**: Use your virtual tokens to place bets on match results and micro-markets.

## Data Synchronization
The system is configured for **High-Frequency Auto-Sync**. Every 10 seconds, the terminal fetches the latest "Actual Web" data from **Sportradar** using your integrated API key.

## Technical Stack
- Next.js 15 (App Router)
- Firebase (Auth & Firestore)
- Genkit (AI Insights)
- Tailwind CSS & ShadCN UI
- **Data Source**: Sportradar API (Cricket v2)
