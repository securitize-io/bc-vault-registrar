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

interface Errors {
    /// @notice Thrown when an investor is not found for a wallet
    /// @custom:selector 0xfed39497
    error InvestorNotFound(address wallet);

    /// @notice Thrown when a vault is already registered
    /// @custom:selector 0x38bfcc16
    error VaultAlreadyRegistered(address vault);

    /// @notice Thrown when an invalid address (zero address) is provided
    /// @custom:selector 0xe6c4247b
    error InvalidAddress();

    /// @notice Thrown when a vault belongs to a different investor
    /// @custom:selector 0x8df63830
    error VaultBelongsToDifferentInvestor(address vault, string vaultInvestorId);

    /// @notice Thrown when a function is not implemented
    /// @custom:selector 0xd6234725
    error NotImplemented();

    /// @notice Thrown when the signature deadline has passed
    /// @custom:selector 0x0819bdcd
    error SignatureExpired();

    /// @notice Thrown when the investor signature is invalid or does not match
    /// @custom:selector 0xac94b822
    error InvalidInvestorSignature();

    /// @notice Thrown when invalidateOperatorPermission is called for an address that does not hold OPERATOR_ROLE
    /// @custom:selector 0x308e16dd
    error NotAnOperator(address account);
}
