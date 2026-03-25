import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { VaultRegistrar } from '../typechain-types';
import { deployVaultRegistrar } from './fixture';

describe('VaultRegistrar', function () {
    const INVESTOR_ID = 'investor-123';

    // ── EIP-712 signing helper ───────────────────────────────────────────────
    async function signRegisterVault(
        signer: HardhatEthersSigner,
        vaultRegistrar: VaultRegistrar,
        investor: string,
        operator: string,
        token: string,
        deadline: number,
    ): Promise<string> {
        const nonce = await vaultRegistrar.operatorNonce(investor, operator);
        const chainId = (await hre.ethers.provider.getNetwork()).chainId;

        return signer.signTypedData(
            {
                name: 'VaultRegistrar',
                version: '1',
                chainId,
                verifyingContract: await vaultRegistrar.getAddress(),
            },
            {
                RegisterVault: [
                    { name: 'investor', type: 'address' },
                    { name: 'operator', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            },
            { investor, operator, token, nonce, deadline },
        );
    }

    // ── Deployment ──────────────────────────────────────────────────────────
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

    // ── Role Management ─────────────────────────────────────────────────────
    describe('Role Management', function () {
        it('should allow admin to grant OPERATOR_ROLE to a protocol', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            const OPERATOR_ROLE = await vaultRegistrar.OPERATOR_ROLE();

            const tx = vaultRegistrar.connect(admin).addOperator(protocol2.address);
            await expect(tx)
                .to.emit(vaultRegistrar, 'RoleGranted')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            expect(await vaultRegistrar.isOperator(protocol2.address)).to.be.true;
        });

        it('should revert when granting role to zero address', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(admin).addOperator(hre.ethers.ZeroAddress)).to.be.reverted;
        });

        it('should revert when revoking role from zero address', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(admin).removeOperator(hre.ethers.ZeroAddress)).to.be.reverted;
        });

        it('should revert when non-admin tries to grant role', async function () {
            const { vaultRegistrar, protocol2, unauthorized } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(unauthorized).addOperator(protocol2.address)).to.be.reverted;
        });

        it('should allow admin to revoke OPERATOR_ROLE from a protocol', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            const OPERATOR_ROLE = await vaultRegistrar.OPERATOR_ROLE();

            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            await expect(vaultRegistrar.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'RoleRevoked')
                .withArgs(OPERATOR_ROLE, protocol2.address, admin.address);

            expect(await vaultRegistrar.isOperator(protocol2.address)).to.be.false;
        });

        it('should emit ProtocolAuthorized when adding an operator', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(admin).addOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'ProtocolAuthorized')
                .withArgs(protocol2.address);
        });

        it('should not emit ProtocolAuthorized when adding an operator that already has the role', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);
            await expect(vaultRegistrar.connect(admin).addOperator(protocol2.address)).to.not.emit(
                vaultRegistrar,
                'ProtocolAuthorized',
            );
            expect(await vaultRegistrar.isOperator(protocol2.address)).to.be.true;
        });

        it('should emit ProtocolRevoked when removing an operator', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);
            await expect(vaultRegistrar.connect(admin).removeOperator(protocol2.address))
                .to.emit(vaultRegistrar, 'ProtocolRevoked')
                .withArgs(protocol2.address);
        });

        it('should not emit ProtocolRevoked when removing an operator that does not have the role', async function () {
            const { vaultRegistrar, admin, protocol2 } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.isOperator(protocol2.address)).to.be.false;
            await expect(vaultRegistrar.connect(admin).removeOperator(protocol2.address)).to.not.emit(
                vaultRegistrar,
                'ProtocolRevoked',
            );
        });
    });

    // ── registerVault ───────────────────────────────────────────────────────
    describe('registerVault', function () {
        it('should register a vault with a valid investor signature', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            )
                .to.emit(vaultRegistrar, 'VaultRegistered')
                .withArgs(investor1.address, vaults[0].address, await mockDSToken.getAddress(), INVESTOR_ID, protocol1.address)
                .and.to.emit(vaultRegistrar, 'InvestorSignatureVerified')
                .withArgs(investor1.address, protocol1.address, 0, deadline, sig);

            expect(await mockRegistryService.getInvestor(vaults[0].address)).to.equal(INVESTOR_ID);
        });

        it('should NOT increment operatorNonce after successful registration', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            expect(await vaultRegistrar.operatorNonce(investor1.address, protocol1.address)).to.equal(0);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig);

            expect(await vaultRegistrar.operatorNonce(investor1.address, protocol1.address)).to.equal(0);
        });

        it('should revert when signature is expired', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) - 1;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'SignatureExpired');
        });

        it('should allow the same signature to be reused for multiple vaults', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig);
            await vaultRegistrar.connect(protocol1).registerVault(vaults[1].address, investor1.address, deadline, sig);

            expect(await mockRegistryService.getInvestor(vaults[0].address)).to.equal(INVESTOR_ID);
            expect(await mockRegistryService.getInvestor(vaults[1].address)).to.equal(INVESTOR_ID);
        });

        it('should revert after investor invalidates operator permission', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            // Use the signature once
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig);

            // Investor revokes operator permission — nonce becomes 1
            await expect(vaultRegistrar.connect(investor1).invalidateOperatorPermission(protocol1.address))
                .to.emit(vaultRegistrar, 'OperatorPermissionInvalidated')
                .withArgs(investor1.address, protocol1.address, 1);

            expect(await vaultRegistrar.operatorNonce(investor1.address, protocol1.address)).to.equal(1);

            // Old sig (built with nonce 0) is now invalid
            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[1].address, investor1.address, deadline, sig),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvalidInvestorSignature');
        });

        it('should only invalidate the targeted operator, not others', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, admin, protocol1, protocol2, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            const deadline = (await time.latest()) + 600;
            const sig1 = await signRegisterVault(
                investor1, vaultRegistrar, investor1.address, protocol1.address, await mockDSToken.getAddress(), deadline,
            );
            const sig2 = await signRegisterVault(
                investor1, vaultRegistrar, investor1.address, protocol2.address, await mockDSToken.getAddress(), deadline,
            );

            // Invalidate only protocol1
            await vaultRegistrar.connect(investor1).invalidateOperatorPermission(protocol1.address);

            // protocol1's old sig fails
            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig1),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvalidInvestorSignature');

            // protocol2's sig still works
            await expect(
                vaultRegistrar.connect(protocol2).registerVault(vaults[1].address, investor1.address, deadline, sig2),
            ).to.emit(vaultRegistrar, 'VaultRegistered');
        });

        it('should revert when a different operator submits the signature (cross-protocol attack)', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, protocol2, admin, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await vaultRegistrar.connect(admin).addOperator(protocol2.address);

            const deadline = (await time.latest()) + 600;
            // Signature is bound to protocol1 as operator
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            // protocol2 tries to submit protocol1's signature
            await expect(
                vaultRegistrar.connect(protocol2).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvalidInvestorSignature');
        });

        it('should revert when signature is from a different investor (wrong signer)', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, investor2, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            // investor2 signs but investor1 is passed as the investor
            const sig = await signRegisterVault(
                investor2,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvalidInvestorSignature');
        });

        it('should revert when caller does not have OPERATOR_ROLE', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, unauthorized, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                unauthorized.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar
                    .connect(unauthorized)
                    .registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.reverted;
        });

        it('should revert when vault address is zero', async function () {
            const { vaultRegistrar, mockDSToken, protocol1, investor1 } = await loadFixture(deployVaultRegistrar);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar
                    .connect(protocol1)
                    .registerVault(hre.ethers.ZeroAddress, investor1.address, deadline, sig),
            ).to.be.reverted;
        });

        it('should revert when investor address is zero', async function () {
            const { vaultRegistrar, protocol1 } = await loadFixture(deployVaultRegistrar);

            const deadline = (await time.latest()) + 600;
            const fakeSig = '0x' + '00'.repeat(65);

            await expect(
                vaultRegistrar
                    .connect(protocol1)
                    .registerVault(hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, deadline, fakeSig),
            ).to.be.reverted;
        });

        it('should revert when contract is paused', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, admin, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await vaultRegistrar.connect(admin).pause();

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.reverted;
        });

        it('should revert when investor is not found in registry', async function () {
            const { vaultRegistrar, mockDSToken, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvestorNotFound');
        });

        it('should revert when vault is already registered', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig1 = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig1);

            // Try to register the same vault again with a fresh signature
            const deadline2 = (await time.latest()) + 600;
            const sig2 = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline2,
            );
            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline2, sig2),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'VaultAlreadyRegistered');
        });

        it('operatorNonce should remain unchanged on failed registration', async function () {
            const { vaultRegistrar, mockDSToken, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            // investor not registered — will fail at _registerVaultInternal
            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.be.reverted;

            expect(await vaultRegistrar.operatorNonce(investor1.address, protocol1.address)).to.equal(0);
        });
    });

    // ── invalidateOperatorPermission ────────────────────────────────────────
    describe('invalidateOperatorPermission', function () {
        it('should revert when operator address is zero', async function () {
            const { vaultRegistrar, investor1 } = await loadFixture(deployVaultRegistrar);
            await expect(
                vaultRegistrar.connect(investor1).invalidateOperatorPermission(hre.ethers.ZeroAddress),
            ).to.be.revertedWithCustomError(vaultRegistrar, 'InvalidAddress');
        });

        it('should allow re-authorization with new signature after invalidation', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            // Investor invalidates — nonce becomes 1
            await vaultRegistrar.connect(investor1).invalidateOperatorPermission(protocol1.address);

            // Investor signs again with nonce 1
            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1, vaultRegistrar, investor1.address, protocol1.address, await mockDSToken.getAddress(), deadline,
            );

            await expect(
                vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig),
            ).to.emit(vaultRegistrar, 'VaultRegistered');
        });
    });

    // ── isRegistered ────────────────────────────────────────────────────────
    describe('isRegistered', function () {
        it('should return true when vault is registered for investor', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig);

            expect(await vaultRegistrar.isRegistered(vaults[0].address, investor1.address)).to.be.true;
        });

        it('should return false when vault is not registered', async function () {
            const { vaultRegistrar, mockRegistryService, investor1, vaults } = await loadFixture(deployVaultRegistrar);
            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            expect(await vaultRegistrar.isRegistered(vaults[0].address, investor1.address)).to.be.false;
        });

        it('should return false when vault belongs to different investor', async function () {
            const { vaultRegistrar, mockDSToken, mockRegistryService, protocol1, investor1, investor2, vaults } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                protocol1.address,
                await mockDSToken.getAddress(),
                deadline,
            );
            await vaultRegistrar.connect(protocol1).registerVault(vaults[0].address, investor1.address, deadline, sig);

            expect(await vaultRegistrar.isRegistered(vaults[0].address, investor2.address)).to.be.false;
        });

        it('should return false when investor is not registered', async function () {
            const { vaultRegistrar, vaults, investor1 } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.isRegistered(vaults[0].address, investor1.address)).to.be.false;
        });
    });

    // ── unregisterVault ─────────────────────────────────────────────────────
    describe('unregisterVault', function () {
        it('should revert with NotImplemented error', async function () {
            const { vaultRegistrar, protocol1, investor1, vaults } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(protocol1).unregisterVault(vaults[0].address, investor1.address))
                .to.be.revertedWithCustomError(vaultRegistrar, 'NotImplemented');
        });
    });

    // ── Pause/Unpause ────────────────────────────────────────────────────────
    describe('Pause/Unpause', function () {
        it('should allow admin to pause', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            await vaultRegistrar.connect(admin).pause();
            expect(await vaultRegistrar.paused()).to.be.true;
        });

        it('should allow admin to unpause', async function () {
            const { vaultRegistrar, admin } = await loadFixture(deployVaultRegistrar);
            await vaultRegistrar.connect(admin).pause();
            await vaultRegistrar.connect(admin).unpause();
            expect(await vaultRegistrar.paused()).to.be.false;
        });

        it('should revert when non-admin tries to pause', async function () {
            const { vaultRegistrar, unauthorized } = await loadFixture(deployVaultRegistrar);
            await expect(vaultRegistrar.connect(unauthorized).pause()).to.be.reverted;
        });
    });

    // ── DeFi Protocol Integration ───────────────────────────────────────────
    describe('DeFi Protocol Integration', function () {
        it('should create and register vault on first deposit', async function () {
            const { vaultRegistrar, mockDeFiProtocol, mockDSToken, mockRegistryService, investor1 } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );

            const tx = await mockDeFiProtocol.connect(investor1).deposit(1000, deadline, sig);
            const vaultAddress = await mockDeFiProtocol.investorVaults(investor1.address);

            await expect(tx)
                .to.emit(vaultRegistrar, 'VaultRegistered')
                .withArgs(investor1.address, vaultAddress, await mockDSToken.getAddress(), INVESTOR_ID, await mockDeFiProtocol.getAddress());

            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should deposit to existing vault without registering again', async function () {
            const { mockDeFiProtocol, mockDSToken, mockRegistryService, investor1, vaultRegistrar } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 2000);
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 2000);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );

            // First deposit — creates vault and registers
            await mockDeFiProtocol.connect(investor1).deposit(1000, deadline, sig);
            const vaultAddress = await mockDeFiProtocol.investorVaults(investor1.address);
            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(1000);

            // Second deposit — no signature needed (vault already exists)
            await expect(mockDeFiProtocol.connect(investor1).deposit(1000, 0, '0x'))
                .to.emit(mockDeFiProtocol, 'Deposit')
                .withArgs(investor1.address, vaultAddress, 1000);

            expect(await mockDSToken.balanceOf(vaultAddress)).to.equal(2000);
            expect(await mockDSToken.balanceOf(investor1.address)).to.equal(0);
        });

        it('should revert deposit when investor is not registered', async function () {
            const { mockDeFiProtocol, mockDSToken, vaultRegistrar, investor2 } =
                await loadFixture(deployVaultRegistrar);

            await mockDSToken.mint(investor2.address, 1000);
            await mockDSToken.connect(investor2).approve(await mockDeFiProtocol.getAddress(), 1000);

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor2,
                vaultRegistrar,
                investor2.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(mockDeFiProtocol.connect(investor2).deposit(1000, deadline, sig)).to.be.reverted;
        });

        it('should revert deposit when contract is paused', async function () {
            const { vaultRegistrar, mockDeFiProtocol, mockDSToken, mockRegistryService, admin, investor1 } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);
            await vaultRegistrar.connect(admin).pause();

            const deadline = (await time.latest()) + 600;
            const sig = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );

            await expect(mockDeFiProtocol.connect(investor1).deposit(1000, deadline, sig)).to.be.reverted;
        });

        it('should handle multiple investors depositing', async function () {
            const { mockDeFiProtocol, mockDSToken, mockRegistryService, vaultRegistrar, investor1, investor2 } =
                await loadFixture(deployVaultRegistrar);

            await mockRegistryService.registerInvestor(investor1.address, INVESTOR_ID);
            await mockRegistryService.registerInvestor(investor2.address, 'investor-456');
            await mockDSToken.mint(investor1.address, 1000);
            await mockDSToken.mint(investor2.address, 500);

            await mockDSToken.connect(investor1).approve(await mockDeFiProtocol.getAddress(), 1000);
            await mockDSToken.connect(investor2).approve(await mockDeFiProtocol.getAddress(), 500);

            const deadline = (await time.latest()) + 600;

            const sig1 = await signRegisterVault(
                investor1,
                vaultRegistrar,
                investor1.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );
            await mockDeFiProtocol.connect(investor1).deposit(1000, deadline, sig1);

            const sig2 = await signRegisterVault(
                investor2,
                vaultRegistrar,
                investor2.address,
                await mockDeFiProtocol.getAddress(),
                await mockDSToken.getAddress(),
                deadline,
            );
            await mockDeFiProtocol.connect(investor2).deposit(500, deadline, sig2);

            const vault1 = await mockDeFiProtocol.investorVaults(investor1.address);
            const vault2 = await mockDeFiProtocol.investorVaults(investor2.address);
            expect(vault1).to.not.equal(vault2);
            expect(await mockDSToken.balanceOf(vault1)).to.equal(1000);
            expect(await mockDSToken.balanceOf(vault2)).to.equal(500);
        });
    });

    // ── Upgradability ────────────────────────────────────────────────────────
    describe('Upgradability', function () {
        it('should return implementation address', async function () {
            const { vaultRegistrar } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.getImplementationAddress()).to.not.equal(hre.ethers.ZeroAddress);
        });

        it('should return initialized version', async function () {
            const { vaultRegistrar } = await loadFixture(deployVaultRegistrar);
            expect(await vaultRegistrar.getInitializedVersion()).to.equal(1);
        });
    });
});
