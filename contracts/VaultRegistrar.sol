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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BaseVaultRegistrar} from "./BaseVaultRegistrar.sol";
import {IVaultRegistrar} from "./IVaultRegistrar.sol";
import {IDSServiceConsumer} from "./interfaces/IDSServiceConsumer.sol";
import {IDSRegistryService} from "./interfaces/IDSRegistryService.sol";

/**
 * @title VaultRegistrar
 * @dev Allows authorized DeFi protocols to register vault addresses under existing investor identities
 */
contract VaultRegistrar is IVaultRegistrar, BaseVaultRegistrar {
    /// @dev The token address this vault registrar is associated with
    address public token;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _token The token address
     */
    function initialize(address _token) public initializer notZeroAddress(_token) {
        __BaseVaultRegistrar_init();

        token = _token;
    }

    /**
     * @dev Validates that a vault belongs to the expected investor, reverts if it belongs to a different investor
     * @param registryService The registry service instance
     * @param vaultAddress The vault address to check
     * @param expectedInvestorId The expected investor ID
     */
    function _validateVaultBelongsToInvestor(
        IDSRegistryService registryService,
        address vaultAddress,
        string memory expectedInvestorId
    ) private view {
        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (keccak256(bytes(vaultInvestorId)) != keccak256(bytes(expectedInvestorId))) {
            revert VaultBelongsToDifferentInvestor(vaultAddress, vaultInvestorId);
        }
    }

    /**
     * @dev Registers a vault address under an existing investor identity
     * @param vaultAddress The vault address to register
     * @param investorWalletAddress The investor's wallet address
     */
    function registerVault(
        address vaultAddress,
        address investorWalletAddress
    ) external whenNotPaused onlyAdminOrOperator notZeroAddress(vaultAddress) notZeroAddress(investorWalletAddress) {
        address _token = token;

        // Get Registry Service
        IDSRegistryService registryService = IDSRegistryService(
            IDSServiceConsumer(_token).getDSService(REGISTRY_SERVICE)
        );

        // Get investor ID from the investor wallet
        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            revert InvestorNotFound(investorWalletAddress);
        }

        // Check if vault is already registered
        if (registryService.isWallet(vaultAddress)) {
            // Check if it belongs to a different investor
            _validateVaultBelongsToInvestor(registryService, vaultAddress, investorId);
            
            // If it belongs to the same investor, it's already registered
            revert VaultAlreadyRegistered(vaultAddress);
        }

        // Check investor wallet has balance > 0
        if (IERC20(_token).balanceOf(investorWalletAddress) == 0) {
            revert InvestorHasNoBalance(investorWalletAddress);
        }

        // Register the vault under the investor identity
        registryService.addWallet(vaultAddress, investorId);

        emit VaultRegistered(investorWalletAddress, vaultAddress, _token, investorId, _msgSender());
    }

    /**
     * @dev Checks if a vault is registered for an investor
     * @param vaultAddress The vault address to check
     * @param investorWalletAddress The investor's wallet address
     * @return True if the vault is registered for the investor
     */
    function isRegistered(
        address vaultAddress,
        address investorWalletAddress
    ) external view returns (bool) {
        // Get Registry Service
        IDSRegistryService registryService = IDSRegistryService(
            IDSServiceConsumer(token).getDSService(REGISTRY_SERVICE)
        );

        // Check if vault is registered as wallet
        if (!registryService.isWallet(vaultAddress)) {
            return false;
        }

        // Get investor ID from vault
        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (bytes(vaultInvestorId).length == 0) {
            return false;
        }

        // Get investor ID from investor wallet
        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            return false;
        }

        // Compare investor IDs - if different, revert with specific error
        _validateVaultBelongsToInvestor(registryService, vaultAddress, investorId);

        return true;
    }

    /**
     * @dev Revokes the registration of a vault address
     * @notice Currently not implemented - reverts with NotImplemented error
     */
    function unregisterVault(
        address /* vaultAddress */,
        address /* investorWalletAddress */
    ) external pure {
        revert NotImplemented();
    }
}
