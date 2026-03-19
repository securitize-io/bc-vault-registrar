/**
 * Copyright 2026 Securitize Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

pragma solidity ^0.8.24;

import {Errors} from "./Errors.sol";

/**
 * @title IVaultRegistrar
 * @dev Interface for the VaultRegistrar contract
 */
interface IVaultRegistrar is Errors {
    /**
     * @dev Emitted when a vault is registered under an investor identity
     * @param investor The investor wallet address
     * @param vault The vault address that was registered
     * @param token The token address
     * @param investorId The investor ID
     * @param sender The operator address that called registerVault
     */
    event VaultRegistered(
        address indexed investor,
        address indexed vault,
        address token,
        string investorId,
        address indexed sender
    );

    /**
     * @dev Emitted when a vault registration is revoked
     * @param investor The investor wallet address
     * @param vault The vault address that was unregistered
     * @param token The token address
     * @param investorId The investor ID
     * @param sender The address that called the unregisterVault function
     */
    event VaultUnregistered(
        address indexed investor,
        address indexed vault,
        address token,
        string investorId,
        address indexed sender
    );

    /**
     * @dev Emitted when an investor invalidates a previously granted operator permission
     * @param investor The investor wallet address
     * @param operator The operator whose permission was invalidated
     * @param newNonce The new nonce value (any signature built with the previous nonce is now invalid)
     */
    event OperatorPermissionInvalidated(address indexed investor, address indexed operator, uint256 newNonce);

    /**
     * @dev Emitted when an investor signature is successfully verified during vault registration
     * @param investor The investor wallet address whose signature was verified
     * @param operator The operator address that submitted the signature
     * @param nonce The per-operator nonce bound to the signature
     * @param deadline The expiration timestamp of the signature
     * @param signature The raw EIP-712 signature bytes provided by the operator
     */
    event InvestorSignatureVerified(
        address indexed investor,
        address indexed operator,
        uint256 nonce,
        uint256 deadline,
        bytes signature
    );

    /**
     * @dev Registers a vault address under an existing investor identity
     * @param vaultAddress The vault address to register
     * @param investorWalletAddress The investor's wallet address (signer)
     * @param deadline Unix timestamp after which the signature is invalid
     * @param signature EIP-712 signature — supports EOA (ECDSA) and smart contract wallets (ERC-1271)
     */
    function registerVault(
        address vaultAddress,
        address investorWalletAddress,
        uint256 deadline,
        bytes calldata signature
    ) external;

    /**
     * @dev Checks if a vault is registered for an investor
     * @param vaultAddress The vault address to check
     * @param investorWalletAddress The investor's wallet address
     * @return True if the vault is registered for the investor
     * @custom:selector 0xd3da927f
     */
    function isRegistered(address vaultAddress, address investorWalletAddress) external view returns (bool);

    /**
     * @dev Revokes the registration of a vault address
     * @param vaultAddress The vault address to unregister
     * @param investorWalletAddress The investor's wallet address
     * @custom:selector 0x8c0c5b0e
     */
    function unregisterVault(address vaultAddress, address investorWalletAddress) external;

    /**
     * @dev Returns the token address
     * @return The token address
     * @custom:selector 0x69eb0b1b
     */
    function token() external view returns (address);

    /**
     * @dev Returns the current nonce for an investor-operator pair
     * @param investor The investor wallet address
     * @param operator The operator address
     * @return The current nonce
     */
    function operatorNonce(address investor, address operator) external view returns (uint256);

    /**
     * @dev Invalidates all signatures the caller previously granted to an operator
     * @param operator The operator address whose permission should be invalidated.
     *        Must currently hold OPERATOR_ROLE — reverts with {NotAnOperator} otherwise.
     */
    function invalidateOperatorPermission(address operator) external;
}
