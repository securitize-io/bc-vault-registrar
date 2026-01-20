/**
 * Copyright 2025 Securitize Inc. All rights reserved.
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

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockDSToken - Test token contract for Whitelister
contract MockDSToken is ERC20 {
    /// @dev Service ID constants
    uint256 public constant REGISTRY_SERVICE = 4;

    address public registryService;
    uint8 public tokenDecimals;

    /// @dev Error thrown when a service is not implemented
    error DSServiceNotImplemented(uint256 service);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _registryService
    ) ERC20(_name, _symbol) {
        tokenDecimals = _decimals;
        registryService = _registryService;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    /// @dev Gets a service address by ID
    function getDSService(uint256 _service) public view returns (address) {
        if (_service == REGISTRY_SERVICE) {
            return registryService;
        }
        revert DSServiceNotImplemented(_service);
    }

    /// @dev Mints tokens to an address
    function mint(address _to, uint256 _amount) external returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    /// @dev Burns tokens from an address
    function burn(address _from, uint256 _amount) external returns (bool) {
        _burn(_from, _amount);
        return true;
    }
}
