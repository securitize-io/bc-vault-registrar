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
     * @dev Validates that a vault belongs to the expected investor by comparing investor IDs
     * @param vaultAddress The address of the vault to validate
     * @param vaultInvestorId The investor ID associated with the vault
     * @param expectedInvestorId The expected investor ID that the vault should belong to
     * @notice Reverts with VaultBelongsToDifferentInvestor if the vault belongs to a different investor
     */
    function _validateVaultBelongsToInvestor(
        address vaultAddress,
        string memory vaultInvestorId,
        string memory expectedInvestorId
    ) private pure {
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

        // Check if vault is already registered - if getInvestor returns non-empty, vault is registered
        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (bytes(vaultInvestorId).length > 0) {
            // Vault is registered - validate it belongs to the same investor
            // If different, revert with specific error; if same, revert with already registered
            _validateVaultBelongsToInvestor(vaultAddress, vaultInvestorId, investorId);

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

        // Get investor ID from vault - if empty, vault is not registered
        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (bytes(vaultInvestorId).length == 0) {
            return false;
        }

        // Get investor ID from investor wallet - if empty, investor is not registered
        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            return false;
        }

        // Vault is registered - validate it belongs to the same investor
        // If different, revert with specific error
        _validateVaultBelongsToInvestor( vaultAddress, vaultInvestorId, investorId);

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
