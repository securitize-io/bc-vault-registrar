# VaultRegistrar — Reference UI

A web3 reference application that demonstrates and tests the end-to-end vault registration flow introduced in VaultRegistrar v2. Built with Vite, React, wagmi v2, and viem.

This UI serves two purposes:
- **Internal testing tool** — simulate the full deposit and vault registration flow on a testnet
- **Integration reference** — shows partners exactly how to implement EIP-712 signing and the deposit flow on their own frontends

---

## Overview

The registration flow consists of three steps:

```
1. Sign      →  Investor signs EIP-712 typed data authorizing vault registration
2. Approve   →  Investor approves DSToken spend to the DeFi protocol
3. Deposit   →  DeFi protocol creates vault, calls registerVaultWithSig, transfers tokens
```

The UI connects to two mock contracts (`MockDeFiProtocol` and `MockDSToken`) alongside the real `VaultRegistrar` proxy.

---

## Prerequisites

- Node.js v20+
- MetaMask browser extension
- A funded Sepolia wallet (for gas)
- Deployed contract addresses (see [Contract Setup](#contract-setup))

---

## Installation

```bash
cd ui
npm install
```

---

## Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

```env
# Chain (defaults to Sepolia)
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Contract addresses
VITE_VAULT_REGISTRAR_ADDRESS=0x...
VITE_MOCK_DEFI_PROTOCOL_ADDRESS=0x...
VITE_MOCK_DS_TOKEN_ADDRESS=0x...
```

| Variable | Description |
|---|---|
| `VITE_CHAIN_ID` | EVM chain ID. Use `11155111` for Sepolia |
| `VITE_RPC_URL` | JSON-RPC endpoint (Infura, Alchemy, etc.) |
| `VITE_VAULT_REGISTRAR_ADDRESS` | VaultRegistrar proxy address |
| `VITE_MOCK_DEFI_PROTOCOL_ADDRESS` | MockDeFiProtocol contract address |
| `VITE_MOCK_DS_TOKEN_ADDRESS` | MockDSToken contract address |

---

## Contract Setup

Before running the UI you need the three contracts deployed and configured on the target network.

### 1. Deploy VaultRegistrar

```bash
npx hardhat deploy-vault-registrar \
  --dstoken <DSTOKEN_ADDRESS> \
  --network sepolia
```

### 2. Deploy MockDeFiProtocol

```bash
npx hardhat deploy-mock-defi-protocol \
  --vault-registrar <VAULT_REGISTRAR_ADDRESS> \
  --dstoken <DSTOKEN_ADDRESS> \
  --network sepolia
```

### 3. Grant OPERATOR_ROLE to MockDeFiProtocol

```bash
npx hardhat add-operator \
  --registrar <VAULT_REGISTRAR_ADDRESS> \
  --operator  <MOCK_DEFI_PROTOCOL_ADDRESS> \
  --network sepolia
```

### 4. Register investor and mint tokens

The investor wallet must be registered in the DS Registry and hold a non-zero DSToken balance. This step is done off-chain via Securitize's admin tooling or directly on the MockRegistryService if testing locally.

---

## Running

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Flow Walkthrough

### Connect wallet

Click **Connect MetaMask** in the header. Make sure MetaMask is set to the same network as `VITE_CHAIN_ID`.

Once connected the UI displays:
- **Investor address** — your connected wallet
- **DSToken balance** — your current token balance
- **Nonce** — your current VaultRegistrar nonce (increments after each successful registration)
- **Existing vault** — shown if you have already deposited before

---

### Step 1 — Sign

Enter the deposit amount and click **Continue to Sign**.

The UI shows the exact **EIP-712 typed data** your wallet will be asked to sign:

```json
{
  "domain": {
    "name": "VaultRegistrar",
    "version": "1",
    "chainId": 11155111,
    "verifyingContract": "0x..."
  },
  "types": {
    "RegisterVault": [
      { "name": "investor",  "type": "address" },
      { "name": "operator",  "type": "address" },
      { "name": "token",     "type": "address" },
      { "name": "nonce",     "type": "uint256" },
      { "name": "deadline",  "type": "uint256" }
    ]
  },
  "message": {
    "investor":  "0x<your wallet>",
    "operator":  "0x<MockDeFiProtocol>",
    "token":     "0x<MockDSToken>",
    "nonce":     0,
    "deadline":  "<now + 10 minutes>"
  }
}
```

Click **Sign with Wallet** — MetaMask will prompt you with the structured data. The signature is:

- **Single-use** — the nonce is consumed on success
- **Operator-bound** — only `MockDeFiProtocol` can submit it
- **Time-bounded** — expires 10 minutes from signing

> If you already have a vault from a previous deposit, the signing step is skipped and you go directly to Approve.

---

### Step 2 — Approve

The UI checks your current DSToken allowance for `MockDeFiProtocol`. If the allowance is already sufficient it skips to the next step automatically.

Otherwise click **Approve** — MetaMask will prompt an `ERC20.approve` transaction.

---

### Step 3 — Deposit

Click **Deposit**. This sends a single transaction to `MockDeFiProtocol.deposit(amount, deadline, signature)`.

Internally the protocol:
1. Creates a `MockVault` contract (first deposit only)
2. Calls `VaultRegistrar.registerVaultWithSig(vault, investor, deadline, sig)` (first deposit only)
3. Transfers your DSTokens from your wallet to the vault

On success the UI shows:
- Transaction hash
- Vault address

---

## Project Structure

```
ui/
├── .env.example            # Environment variable template
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── src/
    ├── main.tsx            # App entry point — WagmiProvider setup
    ├── App.tsx             # Root layout and wallet gate
    ├── wagmi.config.ts     # wagmi config + contract addresses
    ├── index.css           # Tailwind base styles
    ├── vite-env.d.ts       # Vite env type declarations
    ├── abis/
    │   ├── VaultRegistrar.ts       # nonces, isRegistered, DOMAIN_SEPARATOR
    │   ├── MockDeFiProtocol.ts     # deposit, investorVaults
    │   └── MockDSToken.ts          # approve, allowance, balanceOf, decimals
    └── components/
        ├── ConnectButton.tsx       # MetaMask connect/disconnect
        ├── DepositFlow.tsx         # Main 3-step flow
        ├── TypedDataDisplay.tsx    # EIP-712 data preview panel
        └── Step.tsx                # Stepper indicator
```

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Vite | 6 | Build tool |
| wagmi | 2 | React hooks for wallet + contract interaction |
| viem | 2 | Low-level EVM types and utilities |
| @tanstack/react-query | 5 | Async state management (required by wagmi) |
| Tailwind CSS | 3 | Utility-first styling |

---

## Key Integration Points for Partners

### Fetching the nonce

```ts
const nonce = await publicClient.readContract({
    address: VAULT_REGISTRAR_ADDRESS,
    abi: VaultRegistrarAbi,
    functionName: 'nonces',
    args: [investorAddress],
});
```

### Building and signing the EIP-712 typed data

```ts
const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

const signature = await walletClient.signTypedData({
    domain: {
        name: 'VaultRegistrar',
        version: '1',
        chainId,
        verifyingContract: VAULT_REGISTRAR_ADDRESS,
    },
    types: {
        RegisterVault: [
            { name: 'investor',  type: 'address' },
            { name: 'operator',  type: 'address' },
            { name: 'token',     type: 'address' },
            { name: 'nonce',     type: 'uint256' },
            { name: 'deadline',  type: 'uint256' },
        ],
    },
    primaryType: 'RegisterVault',
    message: {
        investor:  investorAddress,
        operator:  DEFI_PROTOCOL_ADDRESS,  // must match msg.sender when calling registerVaultWithSig
        token:     DS_TOKEN_ADDRESS,
        nonce,
        deadline:  BigInt(deadline),
    },
});
```

### Submitting the deposit

```ts
await walletClient.writeContract({
    address: DEFI_PROTOCOL_ADDRESS,
    abi: MockDeFiProtocolAbi,
    functionName: 'deposit',
    args: [amount, BigInt(deadline), signature],
});
```

The signature is passed through to `registerVaultWithSig` inside `deposit` — the investor never calls the registrar directly.

---

## Build

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

---

## License

Apache-2.0
