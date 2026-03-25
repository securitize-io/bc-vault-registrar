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

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {BaseVaultRegistrar} from "./BaseVaultRegistrar.sol";
import {IVaultRegistrar} from "./IVaultRegistrar.sol";
import {IDSServiceConsumer} from "./interfaces/IDSServiceConsumer.sol";
import {IDSRegistryService} from "./interfaces/IDSRegistryService.sol";

/**
 * @title VaultRegistrar
 * @dev Allows authorized DeFi protocols to register vault addresses under existing investor identities
 */
contract VaultRegistrar is IVaultRegistrar, BaseVaultRegistrar {
    /// @dev EIP-712 typehash for the RegisterVault struct
    bytes32 private constant REGISTER_TYPEHASH =
        keccak256(
            "RegisterVault(address investor,address operator,address token,uint256 nonce,uint256 deadline)"
        );

    /// @dev The token address this vault registrar is associated with
    address public token;

    /// @dev Per-investor, per-operator nonces for EIP-712 signature invalidation
    mapping(address investor => mapping(address operator => uint256 nonce)) private _operatorNonces;

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
     * @dev Registers a vault address under an existing investor identity
     * @param vaultAddress The vault address to register
     * @param investorWalletAddress The investor's wallet address (signer)
     * @param deadline Unix timestamp after which the signature is invalid
     * @param signature EIP-712 signature — supports EOA (ECDSA) and smart contract wallets (ERC-1271)
     *
     * @notice The nonce is intentionally NOT incremented after a successful registration.
     *         The signature acts as a standing permission: the investor signs once and the
     *         operator can reuse the same signature to register any number of vaults on their
     *         behalf, for as long as the deadline has not passed.
     *
     *         To revoke access, the investor calls {invalidateOperatorPermission}, which
     *         increments the per-operator nonce and renders any previously issued signature
     *         invalid. Revoking one operator's permission does not affect nonces for other
     *         operators.
     */
    function registerVault(
        address vaultAddress,
        address investorWalletAddress,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused onlyRole(OPERATOR_ROLE) notZeroAddress(vaultAddress) notZeroAddress(investorWalletAddress) {
        if (block.timestamp > deadline) revert SignatureExpired();

        address operator = _msgSender();
        uint256 nonce = _operatorNonces[investorWalletAddress][operator];

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REGISTER_TYPEHASH,
                    investorWalletAddress,
                    operator,
                    token,
                    nonce,
                    deadline
                )
            )
        );

        if (!SignatureChecker.isValidSignatureNow(investorWalletAddress, digest, signature)) {
            revert InvalidInvestorSignature();
        }

        _registerVaultInternal(vaultAddress, investorWalletAddress);

        emit InvestorSignatureVerified(investorWalletAddress, operator, nonce, deadline, signature);
    }

    /**
     * @dev Checks if a vault is registered for an investor
     * @param vaultAddress The vault address to check
     * @param investorWalletAddress The investor's wallet address
     * @return True if the vault is registered for the investor
     */
    function isRegistered(address vaultAddress, address investorWalletAddress) external view returns (bool) {
        IDSRegistryService registryService = IDSRegistryService(
            IDSServiceConsumer(token).getDSService(REGISTRY_SERVICE)
        );

        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (bytes(vaultInvestorId).length == 0) {
            return false;
        }

        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            return false;
        }

        if (keccak256(bytes(vaultInvestorId)) != keccak256(bytes(investorId))) {
            return false;
        }

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

    /**
     * @dev Returns the current nonce for an investor-operator pair
     * @param investor The investor wallet address
     * @param operator The operator address
     * @return The current nonce
     */
    function operatorNonce(address investor, address operator) external view returns (uint256) {
        return _operatorNonces[investor][operator];
    }

    /**
     * @dev Invalidates all signatures the investor previously granted to an operator
     * @notice Increments the nonce for the caller-operator pair, rendering any existing
     *         signatures built with the previous nonce invalid.
     * @param operator The operator address whose permission should be invalidated
     */
    function invalidateOperatorPermission(address operator) external notZeroAddress(operator) {
        uint256 newNonce = ++_operatorNonces[_msgSender()][operator];
        emit OperatorPermissionInvalidated(_msgSender(), operator, newNonce);
    }

    /**
     * @dev Validates that a vault belongs to the expected investor by comparing investor IDs
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
     * @dev Core registration logic — validates investor identity and adds the vault to the registry
     * @param vaultAddress The vault address to register
     * @param investorWalletAddress The investor's wallet address
     */
    function _registerVaultInternal(address vaultAddress, address investorWalletAddress) private {
        address _token = token;

        IDSRegistryService registryService = IDSRegistryService(
            IDSServiceConsumer(_token).getDSService(REGISTRY_SERVICE)
        );

        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            revert InvestorNotFound(investorWalletAddress);
        }

        string memory vaultInvestorId = registryService.getInvestor(vaultAddress);
        if (bytes(vaultInvestorId).length > 0) {
            _validateVaultBelongsToInvestor(vaultAddress, vaultInvestorId, investorId);
            revert VaultAlreadyRegistered(vaultAddress);
        }

        registryService.addWallet(vaultAddress, investorId);

        emit VaultRegistered(investorWalletAddress, vaultAddress, _token, investorId, _msgSender());
    }
}
