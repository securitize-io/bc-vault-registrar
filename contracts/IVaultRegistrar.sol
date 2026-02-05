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

pragma solidity ^0.8.22;

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
     * @param sender The address that called the registerVault function
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
     * @dev Registers a vault address under an existing investor identity
     * @param vaultAddress The vault address to register
     * @param investorWalletAddress The investor's wallet address
     * @custom:selector 0x05c4fdf9
     */
    function registerVault(address vaultAddress, address investorWalletAddress) external;

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
}
