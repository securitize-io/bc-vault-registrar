import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployVaultWhitelister } from './fixture';

describe('VaultWhitelister', function () {
    const INVESTOR_ID = 'investor-123';

    describe('Deployment', function () {
        it('should deploy with correct DSToken address', async function () {
            const { vaultWhitelister, mockDSToken } = await loadFixture(deployVaultWhitelister);
            expect(await vaultWhitelister.dsToken()).to.equal(await mockDSToken.getAddress());
        });

        it('should set deployer as admin', async function () {
            const { vaultWhitelister, admin } = await loadFixture(deployVaultWhitelister);
            const DEFAULT_ADMIN_ROLE = await vaultWhitelister.DEFAULT_ADMIN_ROLE();
            const hasRole = await vaultWhitelister.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
            expect(hasRole).to.be.true;
        });

        it('should not be paused initially', async function () {
            const { vaultWhitelister } = await loadFixture(deployVaultWhitelister);
            expect(await vaultWhitelister.paused()).to.be.false;
        });
    });

    describe('Role Management', function () {
        it('should allow admin to grant OPERATOR_ROLE to a protocol', async function () {
            const { vaultWhitelister, admin, protocol2 } = await loadFixture(deployVaultWhitelister);
            const OPERATOR_ROLE = await vaultWhitelister.OPERATOR_ROLE();

            // Note: protocol2 doesn't have OPERATOR_ROLE yet (only protocol1 has it in fixture)
            const tx = vaultWhitelister.connect(admin).addOperator(protocol2.address);
            await expect(tx)
                .to.emit(vaultWhitelister, 'RoleGranted')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            const isOperator = await vaultWhitelister.isOperator(protocol2.address);
            expect(isOperator).to.be.true;
        });

        it('should revert when granting role to zero address', async function () {
            const { vaultWhitelister, admin } = await loadFixture(deployVaultWhitelister);
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            
            await expect(vaultWhitelister.connect(admin).addOperator(ZERO_ADDRESS)).to.be.reverted;
        });

        it('should revert when revoking role from zero address', async function () {
            const { vaultWhitelister, admin } = await loadFixture(deployVaultWhitelister);
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            
            await expect(vaultWhitelister.connect(admin).removeOperator(ZERO_ADDRESS)).to.be.reverted;
        });

        it('should revert when non-admin tries to grant role', async function () {
            const { vaultWhitelister, protocol2, unauthorized } = await loadFixture(deployVaultWhitelister);

            await expect(vaultWhitelister.connect(unauthorized).addOperator(protocol2.address)).to.be.reverted;
        });

        it('should allow admin to revoke OPERATOR_ROLE from a protocol', async function () {
            const { vaultWhitelister, admin, protocol2 } = await loadFixture(deployVaultWhitelister);
            const OPERATOR_ROLE = await vaultWhitelister.OPERATOR_ROLE();

            // Grant role first
            await vaultWhitelister.connect(admin).addOperator(protocol2.address);

            // Then revoke it
            await expect(vaultWhitelister.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultWhitelister, 'RoleRevoked')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            const isOperator = await vaultWhitelister.isOperator(protocol2.address);
            expect(isOperator).to.be.false;
        });

        it('should emit ProtocolAuthorized event when adding an operator', async function () {
            const { vaultWhitelister, admin, protocol2 } = await loadFixture(deployVaultWhitelister);

            await expect(vaultWhitelister.connect(admin).addOperator(protocol2.address))
                .to.emit(vaultWhitelister, 'ProtocolAuthorized')
                .withArgs(protocol2.address);
        });

        it('should emit ProtocolRevoked event when removing an operator', async function () {
            const { vaultWhitelister, admin, protocol2 } = await loadFixture(deployVaultWhitelister);

            // Grant role first
            await vaultWhitelister.connect(admin).addOperator(protocol2.address);

            // Then revoke it and verify ProtocolRevoked event
            await expect(vaultWhitelister.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultWhitelister, 'ProtocolRevoked')
                .withArgs(protocol2.address);
        });
    });

    describe('Whitelist', function () {
        it('should whitelist a vault successfully when protocol calls whitelist', async function () {
            const { vaultWhitelister, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultWhitelister);

            // Setup: protocol1 already has OPERATOR_ROLE (from fixture), register investor, mint tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Protocol calls whitelist (firmado por protocol1)
            await expect(vaultWhitelister.connect(protocol1).whitelist(vaults[0].address, investor1.address))
                .to.emit(vaultWhitelister, 'VaultWhitelisted')
                .withArgs(investor1.address, vaults[0].address, await mockDSToken.getAddress(), INVESTOR_ID);

            // Verify vault is registered
            const isWallet = await mockRegistryService.isWallet(vaults[0].address);
            expect(isWallet).to.be.true;
            const investorId = await mockRegistryService.getInvestor(vaults[0].address);
            expect(investorId).to.equal(INVESTOR_ID);
        });

        it('should revert when caller does not have OPERATOR_ROLE', async function () {
            const { vaultWhitelister, investor1, vaults, unauthorized } = await loadFixture(deployVaultWhitelister);

            await expect(vaultWhitelister.connect(unauthorized).whitelist(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when investor is not found', async function () {
            const { vaultWhitelister, protocol1, investor1, vaults } = await loadFixture(deployVaultWhitelister);

            // protocol1 already has OPERATOR_ROLE but investor is not registered
            await expect(vaultWhitelister.connect(protocol1).whitelist(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when vault is already registered', async function () {
            const { vaultWhitelister, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultWhitelister);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Register vault directly (simulating already registered)
            await mockRegistryService.registerInvestor(vaults[0].address, 'other-investor');

            await expect(vaultWhitelister.connect(protocol1).whitelist(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when investor has no balance', async function () {
            const { vaultWhitelister, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultWhitelister);

            // Setup: protocol1 has OPERATOR_ROLE, register investor, but NO tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            // No minting - investor has 0 balance

            await expect(vaultWhitelister.connect(protocol1).whitelist(vaults[0].address, investor1.address)).to.be
                .reverted;
        });

        it('should revert when vault address is zero', async function () {
            const { vaultWhitelister, protocol1, investor1 } = await loadFixture(deployVaultWhitelister);

            await expect(
                vaultWhitelister
                    .connect(protocol1)
                    .whitelist('0x0000000000000000000000000000000000000000', investor1.address),
            ).to.be.reverted;
        });

        it('should revert when investor address is zero', async function () {
            const { vaultWhitelister, protocol1, vaults } = await loadFixture(deployVaultWhitelister);

            await expect(
                vaultWhitelister
                    .connect(protocol1)
                    .whitelist(vaults[0].address, '0x0000000000000000000000000000000000000000'),
            ).to.be.reverted;
        });

        it('should revert when contract is paused', async function () {
            const { vaultWhitelister, mockDSToken, mockRegistryService, admin, protocol1, investor1, vaults } =
                await loadFixture(deployVaultWhitelister);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);

            // Pause (firmado por admin)
            await vaultWhitelister.connect(admin).pause();

            await expect(vaultWhitelister.connect(protocol1).whitelist(vaults[0].address, investor1.address)).to.be
                .reverted;
        });
    });

    describe('Pause/Unpause', function () {
        it('should allow admin to pause', async function () {
            const { vaultWhitelister, admin } = await loadFixture(deployVaultWhitelister);

            await vaultWhitelister.connect(admin).pause();
            const isPaused = await vaultWhitelister.paused();
            expect(isPaused).to.be.true;
        });

        it('should allow admin to unpause', async function () {
            const { vaultWhitelister, admin } = await loadFixture(deployVaultWhitelister);

            await vaultWhitelister.connect(admin).pause();
            await vaultWhitelister.connect(admin).unpause();
            const isPaused = await vaultWhitelister.paused();
            expect(isPaused).to.be.false;
        });

        it('should revert when non-admin tries to pause', async function () {
            const { vaultWhitelister, unauthorized } = await loadFixture(deployVaultWhitelister);

            await expect(vaultWhitelister.connect(unauthorized).pause()).to.be.reverted;
        });
    });

    describe('DeFi Protocol Integration', function () {
        it('should create and whitelist vault on first deposit', async function () {
            const { vaultWhitelister, mockDeFiProtocol, mockDSToken, mockRegistryService, investor1 } =
                await loadFixture(deployVaultWhitelister);

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
                .to.emit(vaultWhitelister, 'VaultWhitelisted')
                .withArgs(
                    investor1.address,
                    vaultAddress,
                    await mockDSToken.getAddress(),
                    INVESTOR_ID,
                );

            // Verificar que los tokens fueron transferidos al vault
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should deposit to existing vault without whitelisting again', async function () {
            const { vaultWhitelister, mockDeFiProtocol, mockDSToken, mockRegistryService, investor1 } =
                await loadFixture(deployVaultWhitelister);

            // Setup: registrar inversor y mint tokens
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 2000);

            // First deposit - creates vault and whitelists
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 2000);
            await mockDeFiProtocol.connect(investor1).deposit(1000);

            const vaultAddress = await mockDeFiProtocol.investorVaults(investor1.address);
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);

            // Second deposit - should only transfer tokens, not whitelist again
            await expect(mockDeFiProtocol.connect(investor1).deposit(1000))
                .to.emit(mockDeFiProtocol, 'Deposit')
                .withArgs(investor1.address, vaultAddress, 1000);

            // Verify tokens were added
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(2000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should revert deposit when investor is not registered', async function () {
            const { mockDeFiProtocol, mockDSToken, investor2 } = await loadFixture(deployVaultWhitelister);

            // Mint tokens but don't register investor
            await mockDSToken.mint(investor2.address, 1000);
            await mockDSToken.connect(investor2).approve(await mockDeFiProtocol.getAddress(), 1000);

            // Deposit should fail because investor is not registered
            await expect(mockDeFiProtocol.connect(investor2).deposit(1000)).to.be.reverted;
        });

        it('should revert deposit when investor has no balance', async function () {
            const { mockDeFiProtocol, mockRegistryService, investor2 } = await loadFixture(deployVaultWhitelister);

            // Register investor but don't mint tokens
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');

            // Deposit should fail because investor has 0 balance
            await expect(mockDeFiProtocol.connect(investor2).deposit(1000)).to.be.reverted;
        });

        it('should revert deposit when contract is paused', async function () {
            const { vaultWhitelister, mockDeFiProtocol, mockDSToken, mockRegistryService, admin, investor1 } =
                await loadFixture(deployVaultWhitelister);

            // Setup
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);

            // Pause (firmado por admin)
            await vaultWhitelister.connect(admin).pause();

            // Deposit should fail when paused
            await expect(mockDeFiProtocol.connect(investor1).deposit(1000)).to.be.reverted;
        });

        it('should handle multiple investors depositing', async function () {
            const { mockDeFiProtocol, mockDSToken, mockRegistryService, investor1, investor2 } =
                await loadFixture(deployVaultWhitelister);

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
            const { vaultWhitelister } = await loadFixture(deployVaultWhitelister);

            const implAddress = await vaultWhitelister.getImplementationAddress();
            expect(implAddress).to.not.equal('0x0000000000000000000000000000000000000000');
        });

        it('should return initialized version', async function () {
            const { vaultWhitelister } = await loadFixture(deployVaultWhitelister);

            const version = await vaultWhitelister.getInitializedVersion();
            expect(version).to.equal(1);
        });
    });
});
