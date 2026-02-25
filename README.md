# CricketVue | Premium Cricket Insights

Welcome to your live cricket prediction and insights platform.

## Getting Real Match Data

To display real-time, actual cricket matches happening right now, follow these steps:

1. **Get an API Key**:
   - Go to [CricketData.org](https://cricketdata.org/) and sign up for a free account.
   - Copy your **API Key** from your dashboard.

2. **Configure Environment Variables**:
   - Create a file named `.env.local` in the root of your project.
   - Add your key like this:
     ```
     CRICKET_API_KEY=your_actual_api_key_here
     ```

3. **Sync Data**:
   - Run the app and go to the Dashboard.
   - Click the **"Refresh Live Scores"** button.
   - The app will fetch real matches from the API and save them to your Firebase Firestore database.

## Features
- **Real-time Scores**: Connected via Firebase Firestore listeners.
- **AI Insights**: Playful match predictions powered by Google Gemini (Genkit).
- **Virtual Betting**: Place bets using a mock token system.
- **Admin Settlement**: Manually mark bets as Won/Lost in the "My Bets" section to test the wallet balance.
