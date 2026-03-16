# VaultRegistrar v2 — Phase 1 Technical Design

## Background

`VaultRegistrar` allows authorized DeFi protocols (operators) to register segregated vault addresses under an existing investor identity in DSToken's registry service.

A compromised or malicious operator could:
- Register a vault they control under a legitimate investor identity
- Associate the wrong vault with an investor

---

## Objective

`registerVault` requires a valid EIP-712 investor signature for every vault registration. There is no unsigned registration path — all registrations go through the signature-verified flow.

---

## Flow

```
Investor
  │
  │  1. Signs EIP-712 typed data once — grants standing permission to operator
  ▼
DeFi Protocol (OPERATOR_ROLE)
  │
  │  2. deposit(amount) → creates vault A → registerVault(vaultA, investor, deadline, sig)
  │  3. deposit(amount) → creates vault B → registerVault(vaultB, investor, deadline, sig)
  │     (same signature reused — nonce is NOT consumed on registration)
  ▼
VaultRegistrar
  │
  │  4. Verifies signature against current per-operator nonce (EOA + ERC-1271)
  │  5. Calls registryService.addWallet(vault, investorId)
  ▼
DSToken Registry

─── later, if investor wants to revoke ───────────────────────────────────────

Investor
  │
  │  invalidateOperatorPermission(operatorAddress)
  ▼
VaultRegistrar
  │
  │  Increments _operatorNonces[investor][operator]
  │  Old signature now fails digest verification
  ▼
  (operator must obtain a fresh signature to register further vaults)
```

---

## EIP-712 Typed Data Design

### Domain

```
name:              "VaultRegistrar"
version:           "1"
chainId:           <chain id>
verifyingContract: <VaultRegistrar proxy address>
```

> `name` and `version` must remain stable across upgrades. Never change them post-deployment.

### Type

```
RegisterVault(
  address investor,
  address operator,
  address token,
  uint256 nonce,
  uint256 deadline
)
```

### Field Rationale

| Field | Binds against |
|---|---|
| `investor` | Ties signature to the specific investor — cannot be reused for another investor |
| `operator` | Ties signature to the specific protocol — cannot be reused by a different operator |
| `token` | Ties signature to this registrar's token — cannot be reused across registrar instances |
| `nonce` | Per-operator revocation — investor can invalidate all signatures for a specific operator by incrementing their nonce via `invalidateOperatorPermission` |
| `deadline` | Time-bounds the signature — limits the window during which a standing permission is active |
| `chainId` (domain) | Cross-chain protection |
| `verifyingContract` (domain) | Cross-contract protection — binds to this specific proxy |

### Why vault address is NOT included

At deposit time the investor signs before (or simultaneously with) vault creation. The vault address is not known until the DeFi protocol deploys it during the same transaction. Including vault would require a two-step UX (sign → deploy → sign again) which is unacceptable.

**Accepted tradeoff:** the operator selects the vault address. This is acceptable because:
1. The investor already trusts the operator with their tokens at deposit time
2. The operator is already permissioned (`OPERATOR_ROLE`) — this adds investor consent on top of existing trust
3. The investor retains full control via `invalidateOperatorPermission` — they can revoke the standing permission at any time, after which no further vaults can be registered without a fresh signature

---

## Nonce Strategy

Nonces are tracked in a private nested mapping in `VaultRegistrar`:

```solidity
mapping(address investor => mapping(address operator => uint256 nonce)) private _operatorNonces;
```

### Design: standing permission (not single-use)

The nonce is **not incremented** on a successful `registerVault` call. Instead the signature acts as a **standing permission**: the investor signs once and the operator can reuse that signature to register any number of vaults, for as long as the deadline holds.

This model was chosen because:
- The vault address is unknown at signing time (created during the deposit transaction), so the investor cannot pre-authorize a specific vault
- Requiring a fresh signature per vault would force the investor to be online for every protocol interaction
- The operator is already trusted via `OPERATOR_ROLE` — the signature adds investor consent, not per-vault granularity

### Revocation

The investor calls `invalidateOperatorPermission(address operator)` to increment `_operatorNonces[msg.sender][operator]`. Any signature built with the previous nonce will then fail digest verification. Revoking one operator does not affect nonces for other operators.

```solidity
function invalidateOperatorPermission(address operator) external;
```

### View function

```solidity
function operatorNonce(address investor, address operator) external view returns (uint256);
```

Used by the frontend and signing helpers to read the current nonce before constructing the EIP-712 message.

### Deadline guidance

Because the signature is reusable, the `deadline` is now the primary time-bound on the standing permission. Protocols should set deadlines that reflect their expected usage window rather than a per-deposit tight window. The investor can always revoke early via `invalidateOperatorPermission`.

---

## Deadline Handling

```solidity
if (block.timestamp > deadline) revert SignatureExpired();
```

- Deadline is passed by the caller as a Unix timestamp
- Because the same signature is reused across multiple registrations, the deadline should reflect the intended lifetime of the standing permission (hours to days), not a per-deposit window
- No minimum or maximum is enforced on-chain — the protocol decides the UX tradeoff
- The investor can always revoke early via `invalidateOperatorPermission` regardless of the deadline

---

## Operator Binding

`operator` is included in the typed data and verified against `msg.sender`:

```solidity
if (structHash.operator != msg.sender) revert InvalidInvestorSignature();
```

This prevents:
- Protocol A reusing a signature intended for Protocol B
- A malicious party intercepting and replaying a signature through a different operator

---

## ERC-1271 Support

Use OpenZeppelin `SignatureChecker.isValidSignatureNow(investor, digest, signature)`:

- EOA: recovers signer via ECDSA, compares to `investor`
- Smart contract wallet (Safe, AA): calls `isValidSignature(bytes32,bytes)` on the wallet

This makes the feature compatible with:
- MetaMask / standard EOAs
- Gnosis Safe
- ERC-4337 Account Abstraction wallets

Import: `@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol`

---


## Proposed Solidity Interface

```solidity
interface IVaultRegistrar {

    event VaultRegistered(
        address indexed investor,
        address indexed vault,
        address token,
        string investorId,
        address indexed sender
    );

    event VaultUnregistered(
        address indexed investor,
        address indexed vault,
        address token,
        string investorId,
        address indexed sender
    );

    /// @dev Emitted when an investor invalidates a previously granted operator permission
    event OperatorPermissionInvalidated(
        address indexed investor,
        address indexed operator,
        uint256 newNonce
    );

    /**
     * @dev Registers a vault under an investor identity via EIP-712 signature.
     *      The nonce is NOT consumed on success — the same signature can be reused
     *      for multiple vault registrations until the investor calls
     *      invalidateOperatorPermission or the deadline passes.
     */
    function registerVault(
        address vaultAddress,
        address investorWalletAddress,
        uint256 deadline,
        bytes calldata signature
    ) external;

    function isRegistered(address vaultAddress, address investorWalletAddress) external view returns (bool);

    function unregisterVault(address vaultAddress, address investorWalletAddress) external;

    function token() external view returns (address);

    /// @dev Returns the current nonce for an investor-operator pair
    function operatorNonce(address investor, address operator) external view returns (uint256);

    /// @dev Increments the caller's nonce for the given operator, invalidating any
    ///      signature previously issued to that operator
    function invalidateOperatorPermission(address operator) external;

}
```

---

## New Errors

To be added to `Errors.sol`:

```solidity
/// @notice Thrown when the signature deadline has passed
/// @dev Selector: 0x0819bdcd
error SignatureExpired();

/// @notice Thrown when the investor signature is invalid or does not match
/// @dev Selector: 0xac94b822
error InvalidInvestorSignature();
```

---

## Typed Data Schema (JSON — for frontend / EIP-712 wallets)

```json
{
  "types": {
    "EIP712Domain": [
      { "name": "name",              "type": "string"  },
      { "name": "version",           "type": "string"  },
      { "name": "chainId",           "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "RegisterVault": [
      { "name": "investor", "type": "address" },
      { "name": "operator", "type": "address" },
      { "name": "token",    "type": "address" },
      { "name": "nonce",    "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  },
  "primaryType": "RegisterVault",
  "domain": {
    "name":              "VaultRegistrar",
    "version":           "1",
    "chainId":           "<chain id>",
    "verifyingContract": "<VaultRegistrar proxy address>"
  },
  "message": {
    "investor": "<investor wallet address>",
    "operator": "<DeFi protocol address>",
    "token":    "<DSToken address>",
    "nonce":    "<operatorNonce(investor, operator)>",
    "deadline": "<unix timestamp>"
  }
}
```

---

## Security Analysis

| Attack Vector | Mitigation |
|---|---|
| **Cross-operator replay** | `operator` field in typed data verified against `msg.sender` — a signature for operator A cannot be submitted by operator B |
| **Cross-investor replay** | `investor` field in typed data — a signature cannot be reused for a different investor |
| **Cross-chain** | EIP-712 domain includes `chainId` |
| **Cross-registrar** | EIP-712 domain includes `verifyingContract` |
| **Expired signature reuse** | `deadline` checked against `block.timestamp` |
| **Operator registers wrong vault** | Accepted tradeoff — investor trusts operator with tokens at deposit; investor can revoke via `invalidateOperatorPermission` at any time |
| **Unlimited operator access** | Investor can call `invalidateOperatorPermission(operator)` to increment the per-operator nonce and invalidate any outstanding signature — without affecting other operators |
| **Smart wallet spoofing** | `SignatureChecker.isValidSignatureNow` delegates to ERC-1271 on the wallet — wallet controls its own auth logic |
| **Signature malleability** | OZ ECDSA library rejects malleable signatures (s > secp256k1n/2) |
| **Stale nonce after revocation** | Frontend reads `operatorNonce(investor, operator)` before signing; if the on-chain nonce no longer matches, the digest will not verify and `InvalidInvestorSignature` reverts — investor re-signs with the new nonce |
| **Upgrade breaks domain** | `name`/`version` kept stable; `verifyingContract` is the proxy (stable address) |

---

## OpenZeppelin Dependencies

| Contract | Path |
|---|---|
| `EIP712Upgradeable` | `@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol` |
| `SignatureChecker` | `@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol` |

---
