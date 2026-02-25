# **App Name**: CricketVue

## Core Features:

- Secure User Authentication: Enables users to securely log in to their personal customer panel to access all betting and match-related features.
- Dynamic Match Dashboard: Presents a clear, live-updating overview of current and upcoming cricket matches, alongside the user's virtual token balance.
- Detailed Match & Betting Interface: Offers a dedicated page for each match, displaying pre-match and live micro-betting markets, dynamic odds, an intuitive stake input, auto potential win calculation, and a place bet button.
- Virtual Bet Placement & Tracking: Allows users to place virtual bets, automatically deducting the stake. Provides a 'My Bets' page to track the status (open, won, lost) and details of all placed bets and transactions.
- AI-Generated Match Insights: An AI-powered tool generates engaging, playful facts or lighthearted predictions related to specific matches to enhance user interest and interaction.
- Admin Market Settlement Backend: Implements backend functionality for administrators to manually update match statuses and settle betting markets, which automatically triggers virtual win calculations and payouts to user balances.
- Robust Virtual Economy Transactions: Ensures the integrity of the virtual token system by handling all balance deductions, additions, and transaction recordings atomically via PostgreSQL database transactions, preventing any negative balances or data inconsistencies.

## Style Guidelines:

- A dark color scheme evokes a modern, engaging feel, suitable for extended use. The primary color is a vibrant blue (#1754CE) for interactivity and important elements, while a very dark, subtle blue-tinted charcoal (#1B1E22) forms the background. A bright cyan accent (#33D6FF) is used sparingly for highlights and calls to action, ensuring excellent contrast and readability.
- The font 'Inter' (sans-serif) is chosen for both headlines and body text due to its clean, highly legible, and objective aesthetic, complementing the application's modern and direct interface.
- Utilize simple, outline-style icons that maintain a clean and uncluttered look within the dark theme. Icons should clearly represent their function without being overly decorative, aligning with the app's 'simple' and 'clean' design principles.
- The interface features a responsive sidebar layout for easy navigation, optimizing screen space across various devices while keeping core content readily accessible. Content areas will prioritize clarity and readability, aligning with the clean and simple design requirement.
- Incorporate subtle and quick animations for user feedback, such as confirming bet placements or indicating data loading. These animations should enhance user experience without creating distractions or slowing down interaction.