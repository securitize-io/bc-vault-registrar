import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployVaultRegistrar } from './fixture';

describe('VaultRegistrar', function () {
    const INVESTOR_ID = 'investor-123';

    describe('Deployment', function () {
        it('should deploy with correct token address', async function () {
            const { vaultRegistrar, mockDSToken } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.token()).to.equal(await mockDSToken.getAddress());
        });

        it('should set deployer as admin', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            const DEFAULT_ADMIN_ROLE = await vaultRegistrar.DEFAULT_ADMIN_ROLE();
            const hasRole = await vaultRegistrar.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
            expect(hasRole).to.be.true;
        });

        it('should not be paused initially', async function () {
            const { vaultRegistrar } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.paused()).to.be.false;
        });
    });

    describe('Role Management', function () {
        it('should allow admin to grant OPERATOR_ROLE to a protocol', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            const OPERATOR_ROLE = await vaultRegistrar.OPERATOR_ROLE();

            // Note: protocol2 doesn't have OPERATOR_ROLE yet (only protocol1 has it in fixture)
            const tx = vaultRegistrar.connect(admin).addOperator(protocol2.address);
            await expect(tx)
                .to.emit(vaultRegistrar, 'RoleGranted')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            const isOperator = await vaultRegistrar.isOperator(protocol2.address);
            expect(isOperator).to.be.true;
        });

        it('should revert when granting role to zero address', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            
            await expect(vaultRegistrar.connect(admin).addOperator(ZERO_ADDRESS)).to.be.reverted;
        });

        it('should revert when revoking role from zero address', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            
            await expect(vaultRegistrar.connect(admin).removeOperator(ZERO_ADDRESS)).to.be.reverted;
        });

        it('should revert when non-admin tries to grant role', async function () {
            const { vaultRegistrar, protocol2, unauthorized } = await loadFixture(deployVaultRegistrar);

            await expect(vaultRegistrar.connect(unauthorized).addOperator(protocol2.address)).to.be.reverted;
        });

        it('should allow admin to revoke OPERATOR_ROLE from a protocol', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            const OPERATOR_ROLE = await vaultRegistrar.OPERATOR_ROLE();

            // Grant role first
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            // Then revoke it
            await expect(vaultRegistrar.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'RoleRevoked')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            const isOperator = await vaultRegistrar.isOperator(protocol2.address);
            expect(isOperator).to.be.false;
        });

        it('should emit ProtocolAuthorized event when adding an operator', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);

            await expect(vaultRegistrar.connect(admin).addOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'ProtocolAuthorized')
                .withArgs(protocol2.address);
        });

        it('should not emit ProtocolAuthorized when adding an operator that already has the role', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);

            // Grant role first time - should emit event
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            // Grant role second time - should NOT emit event
            const tx = vaultRegistrar.connect(admin).addOperator(protocol2.address);
            await expect(tx).to.not.emit(vaultRegistrar, 'ProtocolAuthorized');

            // Verify role is still granted
            const isOperator = await vaultRegistrar.isOperator(protocol2.address);
            expect(isOperator).to.be.true;
        });

        it('should emit ProtocolRevoked event when removing an operator', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);

            // Grant role first
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            // Then revoke it and verify ProtocolRevoked event
            await expect(vaultRegistrar.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'ProtocolRevoked')
                .withArgs(protocol2.address);
        });

        it('should not emit ProtocolRevoked when removing an operator that does not have the role', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);

            // Verify protocol2 doesn't have the role initially
            const isOperatorBefore = await vaultRegistrar.isOperator(protocol2.address);
            expect(isOperatorBefore).to.be.false;

            // Try to remove role - should NOT emit event
            const tx = vaultRegistrar.connect(admin).removeOperator(protocol2.address);
            await expect(tx).to.not.emit(vaultRegistrar, 'ProtocolRevoked');

            // Verify role is still not granted
            const isOperatorAfter = await vaultRegistrar.isOperator(protocol2.address);
            expect(isOperatorAfter).to.be.false;
        });
    });

    describe('registerVault', function () {
        it('should register a vault successfully when protocol calls registerVault', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup: protocol1 already has OPERATOR_ROLE (from fixture), register investor, mint tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Protocol calls registerVault (firmado por protocol1)
            await expect(vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address))
                .to.emit(vaultRegistrar, 'VaultRegistered')
                .withArgs(investor1.address, vaults[0].address, await mockDSToken.getAddress(), INVESTOR_ID, protocol1.address);

            // Verify vault is registered
            const isWallet = await mockRegistryService.isWallet(vaults[0].address);
            expect(isWallet).to.be.true;
            const investorId = await mockRegistryService.getInvestor(vaults[0].address);
            expect(investorId).to.equal(INVESTOR_ID);
        });

        it('should revert when caller does not have OPERATOR_ROLE', async function () {
            const { vaultRegistrar, investor1, vaults, unauthorized } = await loadFixture(deployVaultRegistrar);

            await expect(vaultRegistrar.connect(unauthorized).registerVault(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when investor is not found', async function () {
            const { vaultRegistrar, protocol1, investor1, vaults } = await loadFixture(deployVaultRegistrar);

            // protocol1 already has OPERATOR_ROLE but investor is not registered
            await expect(vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when vault is already registered', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Register vault directly (simulating already registered)
            await mockRegistryService.registerInvestor(vaults[0].address, 'other-investor');

            await expect(vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when investor has no balance', async function () {
            const { vaultRegistrar, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup: protocol1 has OPERATOR_ROLE, register investor, but NO tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            // No minting - investor has 0 balance

            await expect(vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when vault address is zero', async function () {
            const { vaultRegistrar, protocol1, investor1 } = await loadFixture(deployVaultRegistrar);

            await expect(
                vaultRegistrar
                    .connect(protocol1)
                    .registerVault('0x0000000000000000000000000000000000000000', investor1.address),
            ).to.be.reverted;
        });

        it('should revert when investor address is zero', async function () {
            const { vaultRegistrar, protocol1, vaults } = await loadFixture(deployVaultRegistrar);

            await expect(
                vaultRegistrar
                    .connect(protocol1)
                    .registerVault(vaults[0].address, '0x0000000000000000000000000000000000000000'),
            ).to.be.reverted;
        });

        it('should revert when contract is paused', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, admin, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Pause (firmado por admin)
            await vaultRegistrar.connect(admin).pause();

            await expect(vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address)).to.be
                .reverted;
        });
    });

    describe('isRegistered', function () {
        it('should return true when vault is registered for investor', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup: register investor, mint tokens, and register vault
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address);

            // Check if vault is registered
            const isRegistered = await vaultRegistrar.isRegistered(vaults[0].address, investor1.address);
            expect(isRegistered).to.be.true;
        });

        it('should return false when vault is not registered', async function () {
            const { vaultRegistrar, mockRegistryService, investor1, vaults } = await loadFixture(deployVaultRegistrar);

            // Setup: register investor but don't register vault
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            // Check if vault is registered
            const isRegistered = await vaultRegistrar.isRegistered(vaults[0].address, investor1.address);
            expect(isRegistered).to.be.false;
        });

        it('should revert with VaultBelongsToDifferentInvestor when vault belongs to different investor', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, investor2, vaults } =
                await loadFixture(deployVaultRegistrar);

            // Setup: register both investors
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');
            await mockDSToken.mint(investor1.address, 1000);

            // Register vault for investor1
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address);

            // Check if vault is registered for investor2 (should revert with VaultBelongsToDifferentInvestor)
            await expect(vaultRegistrar.isRegistered(vaults[0].address, investor2.address))
                .to.be.revertedWithCustomError(vaultRegistrar, 'VaultBelongsToDifferentInvestor')
                .withArgs(vaults[0].address, INVESTOR_ID);
        });

        it('should return false when vault address is not registered', async function () {
            const { vaultRegistrar, mockRegistryService, investor1, vaults } = await loadFixture(deployVaultRegistrar);

            // Setup: register investor but vault is not registered
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            // Check if unregistered vault is registered
            const isRegistered = await vaultRegistrar.isRegistered(vaults[0].address, investor1.address);
            expect(isRegistered).to.be.false;
        });

        it('should return false when investor is not registered', async function () {
            const { vaultRegistrar, vaults, investor1 } = await loadFixture(deployVaultRegistrar);

            // Check if vault is registered for unregistered investor
            const isRegistered = await vaultRegistrar.isRegistered(vaults[0].address, investor1.address);
            expect(isRegistered).to.be.false;
        });
    });

    describe('unregisterVault', function () {
        it('should revert with NotImplemented error', async function () {
            const { vaultRegistrar, protocol1, investor1, vaults } = await loadFixture(deployVaultRegistrar);

            // unregisterVault should always revert with NotImplemented
            await expect(vaultRegistrar.connect(protocol1).unregisterVault(vaults[0].address, investor1.address))
                .to.be.revertedWithCustomError(vaultRegistrar, 'NotImplemented');
        });
    });

    describe('Pause/Unpause', function () {
        it('should allow admin to pause', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);

            await vaultRegistrar.connect(admin).pause();
            const isPaused = await vaultRegistrar.paused();
            expect(isPaused).to.be.true;
        });

        it('should allow admin to unpause', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);

            await vaultRegistrar.connect(admin).pause();
            await vaultRegistrar.connect(admin).unpause();
            const isPaused = await vaultRegistrar.paused();
            expect(isPaused).to.be.false;
        });

        it('should revert when non-admin tries to pause', async function () {
            const { vaultRegistrar, unauthorized } = await loadFixture(deployVaultRegistrar);

            await expect(vaultRegistrar.connect(unauthorized).pause()).to.be.reverted;
        });
    });

    describe('DeFi Protocol Integration', function () {
        it('should create and register vault on first deposit', async function () {
            const { vaultRegistrar, mockDeFiProtocol, mockDSToken, mockRegistryService, investor1 } =
                await loadFixture(deployVaultRegistrar);

            // Setup: registrar inversor y mint tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Investor aprueba tokens al MockDeFiProtocol
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);

            // Investor deposita (firmado por investor1)
            // MockDeFiProtocol transfiere tokens desde investor1 hacia el vault creado
            const tx = await mockDeFiProtocol.connect(investor1).deposit(1000);
            
            // Obtener el vault address después de la transacción
            const vaultAddress = await mockDeFiProtocol.investorVaults(investor1.address);
            
            // Verificar el evento con los valores correctos
            await expect(tx)
                .to.emit(vaultRegistrar, 'VaultRegistered')
                .withArgs(
                    investor1.address,
                    vaultAddress,
                    await mockDSToken.getAddress(),
                    INVESTOR_ID,
                    await mockDeFiProtocol.getAddress(),
                );

            // Verificar que los tokens fueron transferidos al vault
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should deposit to existing vault without registering again', async function () {
            const { vaultRegistrar, mockDeFiProtocol, mockDSToken, mockRegistryService, investor1 } =
                await loadFixture(deployVaultRegistrar);

            // Setup: registrar inversor y mint tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 2000);

            // First deposit - creates vault and registers
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 2000);
            await mockDeFiProtocol.connect(investor1).deposit(1000);

            const vaultAddress = await mockDeFiProtocol.investorVaults(investor1.address);
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);

            // Second deposit - should only transfer tokens, not register again
            await expect(mockDeFiProtocol.connect(investor1).deposit(1000))
                .to.emit(mockDeFiProtocol, 'Deposit')
                .withArgs(investor1.address, vaultAddress, 1000);

            // Verify tokens were added
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(2000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should revert deposit when investor is not registered', async function () {
            const { mockDeFiProtocol, mockDSToken, investor2 } = await loadFixture(deployVaultRegistrar);

            // Mint tokens but don't register investor
            await mockDSToken.mint(investor2.address, 1000);
            await mockDSToken.connect(investor2).approve(await mockDeFiProtocol.getAddress(), 1000);

            // Deposit should fail because investor is not registered
            await expect(mockDeFiProtocol.connect(investor2).deposit(1000)).to.be.reverted;
        });

        it('should revert deposit when investor has no balance', async function () {
            const { mockDeFiProtocol, mockRegistryService, investor2 } = await loadFixture(deployVaultRegistrar);

            // Register investor but don't mint tokens
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');

            // Deposit should fail because investor has 0 balance
            await expect(mockDeFiProtocol.connect(investor2).deposit(1000)).to.be.reverted;
        });

        it('should revert deposit when contract is paused', async function () {
            const { vaultRegistrar, mockDeFiProtocol, mockDSToken, mockRegistryService, admin, investor1 } =
                await loadFixture(deployVaultRegistrar);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);

            // Pause (firmado por admin)
            await vaultRegistrar.connect(admin).pause();

            // Deposit should fail when paused
            await expect(mockDeFiProtocol.connect(investor1).deposit(1000)).to.be.reverted;
        });

        it('should handle multiple investors depositing', async function () {
            const { mockDeFiProtocol, mockDSToken, mockRegistryService, investor1, investor2 } =
                await loadFixture(deployVaultRegistrar);

            // Setup both investors
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.mint(investor2.address, 500);

            // Approve and deposit for investor1
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);
            await mockDeFiProtocol.connect(investor1).deposit(1000);

            // Approve and deposit for investor2
            await mockDSToken.connect(investor2).approve(await mockDeFiProtocol.getAddress(), 500);
            await mockDeFiProtocol.connect(investor2).deposit(500);

            // Verify both vaults exist and have correct balances
            const vault1 = await mockDeFiProtocol.investorVaults(investor1.address);
            const vault2 = await mockDeFiProtocol.investorVaults(investor2.address);
            expect(vault1).to.not.equal(vault2);
            expect(await mockDSToken.balanceOf(vault1)).to.equal(1000);
            expect(await mockDSToken.balanceOf(vault2)).to.equal(500);
        });
    });

    describe('Upgradability', function () {
        it('should return implementation address', async function () {
            const { vaultRegistrar } = await loadFixture(deployVaultRegistrar);

            const implAddress = await vaultRegistrar.getImplementationAddress();
            expect(implAddress).to.not.equal('0x0000000000000000000000000000000000000000');
        });

        it('should return initialized version', async function () {
            const { vaultRegistrar } = await loadFixture(deployVaultRegistrar);

            const version = await vaultRegistrar.getInitializedVersion();
            expect(version).to.equal(1);
        });
    });
});
