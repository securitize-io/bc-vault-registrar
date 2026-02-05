# Securitize VaultRegistrar Smart Contract

An intermediary contract that allows authorized DeFi protocols to register vault addresses under existing investor identities, maintaining compliance with Securitize's KYC requirements while enabling segregated custody for DeFi use cases.

## Overview

The VaultRegistrar contract enables authorized protocols (with OPERATOR_ROLE) to register vault addresses under existing investor identities in Securitize's Registry Service. This allows DeFi protocols to operate custody vaults while maintaining full KYC/AML compliance.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  DeFi Protocol   │────▶│  VaultRegistrar │────▶│    DSToken       │
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

- **One DSToken per VaultRegistrar**: Each deployment is tied to a specific DSToken
- **Role-Based Access Control**: Uses OpenZeppelin's AccessControl for managing operators
- **OPERATOR_ROLE**: Protocols with OPERATOR_ROLE can register vaults
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

### Deploy VaultRegistrar

```bash
npx hardhat deploy-vault-registrar --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy a UUPS upgradeable proxy for the VaultRegistrar contract. The task will output:
- Proxy address
- Implementation address

### Deploy MockDeFiProtocol

```bash
npx hardhat deploy-mock-defi-protocol --vaultRegistrar <VAULT_REGISTRAR_ADDRESS> --dstoken <DSTOKEN_ADDRESS> --network <NETWORK>
```

This will deploy the MockDeFiProtocol contract for testing purposes. The task will output:
- Contract address

## Contract Functions

### `initialize(address _token)`
Initializes the contract with the token address.

### `registerVault(address vaultAddress, address investorWalletAddress)`
Registers a vault address under an existing investor identity.

**Requirements:**
- Caller must have DEFAULT_ADMIN_ROLE or OPERATOR_ROLE
- Investor wallet must be registered in RegistryService
- Vault must not already be registered
- Investor wallet must have balance > 0
- Contract must not be paused
- Both addresses must not be zero address

### `isRegistered(address vaultAddress, address investorWalletAddress)`
Checks if a vault is registered for an investor.

**Returns:**
- `bool`: `true` if the vault is registered for the investor, `false` otherwise

**Requirements:**
- View function (no state changes)
- Both addresses must be valid (non-zero)

### `unregisterVault(address vaultAddress, address investorWalletAddress)`
Revokes the registration of a vault address.

**Requirements:**
- Currently reverts with `NotImplemented` error (not yet implemented)

### `token()`
Returns the token address associated with this vault registrar.

**Returns:**
- `address`: The token address

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

- `VaultRegistered(address indexed investor, address indexed vault, address token, string investorId, address indexed sender)`
  - Emitted when a vault is successfully registered for an investor
  - `sender` is the address that called the `registerVault()` function

- `VaultUnregistered(address indexed investor, address indexed vault, address token, string investorId, address indexed sender)`
  - Emitted when a vault registration is revoked

The contract also emits standard AccessControl events:
- `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)`
- `RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)`

## License

Apache-2.0
