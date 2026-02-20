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

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import {Errors} from "./Errors.sol";

/**
 * @title BaseVaultRegistrar
 * @dev Abstract base contract with common functionality for vault registrar contracts
 */
abstract contract BaseVaultRegistrar is Errors, UUPSUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
    /// @dev Service ID for Registry Service in DSToken
    uint256 public constant REGISTRY_SERVICE = 4;

    /// @dev Role for operators who can call register vault
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @dev Emitted when a protocol is authorized as an operator
    event ProtocolAuthorized(address indexed protocol);

    /// @dev Emitted when a protocol's operator role is revoked
    event ProtocolRevoked(address indexed protocol);

    /// @dev Storage gap for future upgrades
    uint256[48] private __gap;

    /// @dev Modifier to allow only DEFAULT_ADMIN_ROLE or OPERATOR_ROLE
    modifier onlyAdminOrOperator() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) && !hasRole(OPERATOR_ROLE, _msgSender())) {
            revert IAccessControl.AccessControlUnauthorizedAccount(_msgSender(), OPERATOR_ROLE);
        }
        _;
    }

    /// @dev Modifier to validate that address is not zero
    modifier notZeroAddress(address account) {
        if (account == address(0)) {
            revert InvalidAddress();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the base contract
     */
    function __BaseVaultRegistrar_init() internal onlyInitializing {
        __UUPSUpgradeable_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Checks if an address has the admin role
     * @param account Address to check
     * @return bool True if the address has admin role
     */
    function isAdmin(address account) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    /**
     * @dev Checks if an address has the operator role
     * @param account Address to check
     * @return bool True if the address has operator role
     */
    function isOperator(address account) public view returns (bool) {
        return hasRole(OPERATOR_ROLE, account);
    }

    /**
     * @dev Grants operator role to an address
     * @param operator Address to grant operator role
     */
    function addOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) notZeroAddress(operator) {
        if (_grantRole(OPERATOR_ROLE, operator)) {
            emit ProtocolAuthorized(operator);
        }
    }

    /**
     * @dev Revokes operator role from an address
     * @param operator Address to revoke operator role
     */
    function removeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) notZeroAddress(operator) {
        if (_revokeRole(OPERATOR_ROLE, operator)) {
            emit ProtocolRevoked(operator);
        }
    }

    /**
     * @dev Pauses the contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Returns proxy ERC1967 implementation address
     */
    function getImplementationAddress() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    /**
     * @dev Returns the highest version that has been initialized
     */
    function getInitializedVersion() external view returns (uint64) {
        return _getInitializedVersion();
    }

    /**
     * @dev Required by the OZ UUPS module
     */
    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
