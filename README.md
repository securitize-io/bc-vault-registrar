# Securitize VaultRegistrar Smart Contract

An intermediary contract that allows authorized DeFi protocols to register vault addresses under existing investor identities, maintaining compliance with Securitize's KYC requirements while enabling segregated custody for DeFi use cases.

## Overview

The VaultRegistrar contract enables authorized protocols (with `OPERATOR_ROLE`) to register vault addresses under existing investor identities in Securitize's Registry Service. Starting from v2, vault registration requires an explicit **EIP-712 investor signature**, ensuring cryptographic proof of investor consent before any vault can be whitelisted.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  DeFi Protocol   │────▶│  VaultRegistrar  │────▶│    DSToken       │
│ (OPERATOR_ROLE)  │     │                  │     │                  │
└──────────────────┘     └────────┬─────────┘     └────────┬─────────┘
         ▲                        │                        │
         │  investor sig          │                        ▼
┌──────────────────┐              │              ┌──────────────────┐
│    Investor      │              │              │ RegistryService  │
│   (EIP-712)      │              │              │  (getDSService)  │
└──────────────────┘              │              └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ RegistryService  │
                         │  (addWallet)     │
                         └──────────────────┘
```

## Features

- **One DSToken per VaultRegistrar**: Each deployment is tied to a specific DSToken
- **Role-Based Access Control**: Uses OpenZeppelin's AccessControl for managing operators
- **OPERATOR_ROLE**: Protocols with `OPERATOR_ROLE` can register vaults
- **EIP-712 Investor Consent**: `registerVault` requires a valid investor signature — supports EOA and ERC-1271 smart contract wallets
- **Standing Permission**: One signature authorizes the operator for any number of vault registrations until the investor revokes it via `invalidateOperatorPermission`
- **Per-Operator Nonce**: Each investor-operator pair tracks its own nonce — revoking one operator does not affect others
- **Vault Registration**: Registers vault addresses under investor identities
- **Pausable**: Contract can be paused by admin for emergency situations
- **Upgradeable**: Uses UUPS proxy pattern for upgradeability

## Prerequisites

- Node.js v20.11.1 (see `.nvmrc`)
- npm

## Installation

```bash
npm install
```

## Compilation

```bash
npm run compile
```

## Testing

```bash
npm test
```

## Deployment

### Deploy VaultRegistrar

```bash
npx hardhat deploy-vault-registrar --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy a UUPS upgradeable proxy for the VaultRegistrar contract. The task will output:
- Proxy address
- Implementation address

### Add Operator

Grants `OPERATOR_ROLE` to an address on a deployed VaultRegistrar.

```bash
npx hardhat add-operator \
  --registrar <VAULT_REGISTRAR_PROXY_ADDRESS> \
  --operator  <OPERATOR_ADDRESS> \
  --network   <NETWORK>
```

If the address already holds `OPERATOR_ROLE` the task exits early without sending a transaction.

### Deploy MockDeFiProtocol

```bash
npx hardhat deploy-mock-defi-protocol --vault-registrar <VAULT_REGISTRAR_ADDRESS> --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy the MockDeFiProtocol contract for testing purposes. The task will output:
- Contract address

## Contract Functions

### `initialize(address _token)`
Initializes the contract with the token address.

### `registerVault(address vaultAddress, address investorWalletAddress, uint256 deadline, bytes calldata signature)`
Registers a vault under an investor identity via EIP-712 signature. The signature is a **standing permission** — the operator can reuse it for any number of vault registrations until the deadline passes or the investor calls `invalidateOperatorPermission`.

**Requirements:**
- Caller must have `OPERATOR_ROLE`
- `signature` must be a valid EIP-712 signature from `investorWalletAddress` (EOA or ERC-1271)
- Signature must not be expired (`block.timestamp <= deadline`)
- Investor wallet must be registered in RegistryService
- Vault must not already be registered
- Contract must not be paused
- Both addresses must not be zero address

**EIP-712 typed data the investor signs:**
```
domain:  { name: "VaultRegistrar", version: "1", chainId, verifyingContract }
type:    RegisterVault(address investor, address operator, address token, uint256 nonce, uint256 deadline)
nonce:   operatorNonce(investor, operator)  — per-operator, only increments on invalidateOperatorPermission
```

### `isRegistered(address vaultAddress, address investorWalletAddress)`
Checks if a vault is registered for an investor.

**Returns:** `true` if the vault is registered under the investor's identity, `false` otherwise.

### `unregisterVault(address vaultAddress, address investorWalletAddress)`
Currently not implemented — reverts with `NotImplemented`.

### `operatorNonce(address investor, address operator)`
Returns the current nonce for an investor-operator pair. Used to construct the EIP-712 typed data before signing.

### `invalidateOperatorPermission(address operator)`
Increments the caller's nonce for the given operator, invalidating any signature previously issued to them. Only affects the caller-operator pair — other operators are unaffected.

### `token()`
Returns the DSToken address associated with this vault registrar.

### `addOperator(address operator)`
Grants `OPERATOR_ROLE` to an address. Admin only.

### `removeOperator(address operator)`
Revokes `OPERATOR_ROLE` from an address. Admin only.

### `isAdmin(address account)` / `isOperator(address account)`
Role check helpers.

### `pause()` / `unpause()`
Emergency pause controls. Admin only.

## Events

- `VaultRegistered(address indexed investor, address indexed vault, address token, string investorId, address indexed sender)`
  — Emitted when a vault is successfully registered.

- `VaultUnregistered(address indexed investor, address indexed vault, address token, string investorId, address indexed sender)`
  — Emitted when a vault registration is revoked.

- `OperatorPermissionInvalidated(address indexed investor, address indexed operator, uint256 newNonce)`
  — Emitted when an investor revokes a previously granted operator permission.

- `ProtocolAuthorized(address indexed protocol)` — Emitted when `OPERATOR_ROLE` is granted.
- `ProtocolRevoked(address indexed protocol)` — Emitted when `OPERATOR_ROLE` is revoked.

Standard AccessControl events:
- `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)`
- `RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)`

## Errors

| Error | Description |
|---|---|
| `InvestorNotFound(address wallet)` | Investor wallet is not registered in the registry |
| `VaultAlreadyRegistered(address vault)` | Vault address is already registered |
| `VaultBelongsToDifferentInvestor(address vault, string vaultInvestorId)` | Vault is registered under a different investor |
| `InvalidAddress()` | A zero address was provided |
| `SignatureExpired()` | The signature deadline has passed |
| `InvalidInvestorSignature()` | Signature is invalid, from the wrong signer, or bound to a different operator |
| `NotImplemented()` | Called a function that is not yet implemented |

## Reference UI

A minimal web UI for testing the full deposit and vault registration flow is available in the `ui/` directory.

```bash
cd ui
cp .env.example .env   # fill in contract addresses and RPC URL
npm install
npm run dev
```

The UI allows an investor to sign the EIP-712 typed data once, reuse that signature across multiple deposits, and revoke operator permission — covering the full `registerVault` standing-permission flow.

## License

Apache-2.0
