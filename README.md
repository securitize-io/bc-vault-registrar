# Securitize Vault Whitelister

An intermediary contract that allows authorized DeFi protocols to whitelist vault addresses under existing investor identities, maintaining compliance with Securitize's KYC requirements while enabling segregated custody for DeFi use cases.

## Overview

The Vault Whitelister contract enables authorized protocols (with EXCHANGE role) to register vault addresses under existing investor identities in Securitize's Registry Service. This allows DeFi protocols to operate custody vaults while maintaining full KYC/AML compliance.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  DeFi Protocol   │────▶│ VaultWhitelister │────▶│    DSToken       │
│ (OPERATOR_ROLE)  │     │                  │     │                  │
└──────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                  │                        │
                                  │                        ▼
                                  │              ┌──────────────────┐
                                  │              │ RegistryService  │
                                  │              │  (getDSService)  │
                                  │              └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ RegistryService  │
                         │ (addWallet)      │
                         └──────────────────┘
```

## Features

- **One DSToken per Whitelister**: Each deployment is tied to a specific DSToken
- **Role-Based Access Control**: Uses OpenZeppelin's AccessControl for managing operators
- **OPERATOR_ROLE**: Protocols with OPERATOR_ROLE can whitelist vaults
- **Investor Verification**: Validates investor exists and has token balance
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

### Deploy VaultWhitelister

```bash
npx hardhat deploy-vault-whitelister --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy a UUPS upgradeable proxy for the VaultWhitelister contract. The task will output:
- Proxy address
- Implementation address

### Deploy MockDeFiProtocol

```bash
npx hardhat deploy-mock-defi-protocol --vaultwhitelister <VAULT_WHITELISTER_ADDRESS> --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy the MockDeFiProtocol contract for testing purposes. The task will output:
- Contract address

## Contract Functions

### `initialize(address _dsToken)`
Initializes the contract with the DSToken address.

### `whitelist(address vaultAddress, address investorWalletAddress)`
Registers a vault address under an existing investor identity.

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE or OPERATOR_ROLE
- Investor wallet must be registered in RegistryService
- Vault must not already be registered
- Investor wallet must have balance > 0
- Contract must not be paused
- Both addresses must not be zero address

### `addOperator(address operator)`
Grants OPERATOR_ROLE to an address (admin only).

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE
- Operator address must not be zero address

### `removeOperator(address operator)`
Revokes OPERATOR_ROLE from an address (admin only).

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE
- Operator address must not be zero address

### `isAdmin(address account)`
Checks if an address has the admin role.

### `isOperator(address account)`
Checks if an address has the operator role.

### `pause()`
Pauses the contract (admin only).

### `unpause()`
Unpauses the contract (admin only).

## Events

- `VaultWhitelisted(address indexed investor, address indexed vault, address indexed dsToken, string investorId)`

The contract also emits standard AccessControl events:
- `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)`
- `RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)`

## License

Apache-2.0
