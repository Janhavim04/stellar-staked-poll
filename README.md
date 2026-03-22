# 🗳️ StellarStakedPoll — Stake XLM · Vote · Win

A production-ready staked polling dApp built on the Stellar blockchain for the Red Belt (Level 4) of the Stellar Dev Workshop. Users stake XLM to vote, winners split the losing pool proportionally, and voters receive VOTE tokens as proof of participation.

🌐 **Live Demo:** https://stellar-staked-poll.netlify.app

---

## ✨ Features

- **Staked Voting** — stake XLM to vote Yes or No
- **Winner Rewards** — winning side splits the losing pool proportionally
- **Inter-contract Calls** — StakedPoll calls VoteToken contract
- **Custom Token** — VOTE token minted as proof of participation
- **Real-time Countdown** — live timer showing poll deadline
- **Multi-wallet Support** — Freighter, xBull, LOBSTR, Hana
- **Smart Caching** — results load instantly from localStorage
- **Transaction Progress Bar** — step-by-step status tracking
- **Mobile Responsive** — works on all screen sizes
- **CI/CD Pipeline** — GitHub Actions runs tests on every push
- **21 passing tests** across 4 test suites

---

## 🛠️ Tech Stack

- React + Vite
- Stellar SDK (@stellar/stellar-sdk)
- StellarWalletsKit (@creit.tech/stellar-wallets-kit)
- Soroban Smart Contracts (Rust)
- Vitest for testing
- GitHub Actions for CI/CD
- Netlify for deployment

---

## 📋 Setup Instructions

1. Clone the repo:
```
   git clone https://github.com/Janhavim04/stellar-staked-poll.git
   cd stellar-staked-poll
```

2. Install dependencies:
```
   npm install
```

3. Run locally:
```
   npm run dev
```

4. Run tests:
```
   npm test
```

5. Install Freighter from https://freighter.app and switch to Testnet

6. Fund your wallet at https://friendbot.stellar.org

7. Open http://localhost:5173, connect wallet and stake XLM to vote!

---

## 📦 Smart Contracts

### StakedPoll Contract
**Address:** `CC7M7OJL3ZE6X6OAEUG5T6W3ASNTTWK4IUE52FWEHGLY7FYEWZN5DGYL`

View: https://stellar.expert/explorer/testnet/contract/CC7M7OJL3ZE6X6OAEUG5T6W3ASNTTWK4IUE52FWEHGLY7FYEWZN5DGYL

Functions:
- `initialize(admin, token_contract, deadline_seconds, min_stake)` — set up the poll
- `vote(voter, option, amount)` — stake XLM to vote (0=Yes, 1=No)
- `claim(voter)` — claim winnings after poll closes
- `get_results()` — returns (yes_stake, no_stake) tuple
- `get_deadline()` — returns poll deadline timestamp
- `has_voted(voter)` — check if wallet voted
- `get_voter_stake(voter)` — get voter's staked amount

### VoteToken Contract
**Address:** `CALJYXH3VYMYBMD4GVHM74UO5FKO7DZQ2IA2IB6NQTEXTUAEZOPT4ZL5`

View: https://stellar.expert/explorer/testnet/contract/CALJYXH3VYMYBMD4GVHM74UO5FKO7DZQ2IA2IB6NQTEXTUAEZOPT4ZL5

### Inter-contract Call
StakedPoll calls VoteToken's `mint()` function every time a user votes, minting VOTE tokens equal to their staked amount as proof of participation.

---

## 🔄 How It Works
```
User connects wallet
       ↓
Stakes XLM (min 10 XLM) to vote Yes or No
       ↓
StakedPoll calls VoteToken to mint VOTE tokens
       ↓
Poll closes after 7 days
       ↓
Winners claim proportional share of losing pool
```

---

## 🚨 Error Handling

| Error | Trigger | Message |
|---|---|---|
| Already Voted | Same wallet votes twice | "You have already voted!" |
| Poll Closed | Voting after deadline | "The poll has closed." |
| Invalid Option | Option not 0 or 1 | "Invalid option or stake too low." |
| Poll Still Open | Claiming before deadline | "Poll is still open." |
| Nothing to Claim | Voted for losing side | "Nothing to claim." |
| Already Claimed | Claiming twice | "You have already claimed." |

---

## 🧪 Tests

21 tests passing across 4 suites:

- **Stake Calculations** (6 tests) — XLM/stroops conversion, percentages, payout math
- **Vote Validation** (5 tests) — option and stake validation
- **Poll State** (5 tests) — deadline detection, winner determination
- **Results Caching** (5 tests) — localStorage cache logic

### Test Output
<img width="1109" height="823" alt="Screenshot 2026-03-16 230320" src="https://github.com/user-attachments/assets/39f9f81a-8a92-493d-b529-820482e7b52f" />


---

## 🔁 CI/CD Pipeline

GitHub Actions runs on every push to main:
- Installs dependencies
- Runs all 21 tests
- Builds the project

### CI/CD Screenshot
<img width="1907" height="935" alt="Screenshot 2026-03-22 222951" src="https://github.com/user-attachments/assets/68e9f5d5-f871-4db9-a4ed-afcee6ff4b39" />


---

## 📱 Mobile Responsive

Fully responsive design that works on all screen sizes.

<img width="1206" height="975" alt="Screenshot 2026-03-22 223034" src="https://github.com/user-attachments/assets/dd3d1e7f-69b3-4179-a8d3-12f8b34fee7d" />


---

## 💳 Supported Wallets

| Wallet | Status |
|---|---|
| Freighter | ✅ Supported |
| xBull | ✅ Supported |
| LOBSTR | ✅ Supported |
| Hana Wallet | ✅ Supported |

---

## 🎥 Demo Video

https://github.com/user-attachments/assets/d378d1ff-8e60-4513-8338-d733fce38fef
---

## 🔗 Links

- 🌐 Live App: https://stellar-staked-poll.netlify.app
- 📜 StakedPoll: https://stellar.expert/explorer/testnet/contract/CC7M7OJL3ZE6X6OAEUG5T6W3ASNTTWK4IUE52FWEHGLY7FYEWZN5DGYL
- 🪙 VoteToken: https://stellar.expert/explorer/testnet/contract/CALJYXH3VYMYBMD4GVHM74UO5FKO7DZQ2IA2IB6NQTEXTUAEZOPT4ZL5
- 💧 Testnet Faucet: https://friendbot.stellar.org
