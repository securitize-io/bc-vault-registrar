import hre from 'hardhat';
import type { VaultRegistrar, MockDSToken, MockDeFiProtocol, MockRegistryService } from '../typechain-types';

export const deployVaultRegistrar = async () => {
    const [admin, protocol1, protocol2, investor1, investor2, unauthorized, ...vaults] = await hre.ethers.getSigners();

    // Deploy mock registry service
    const mockRegistryService = (await hre.ethers.deployContract('MockRegistryService', [])) as unknown as MockRegistryService;
    const registryServiceAddress = await mockRegistryService.getAddress();

    // Deploy mock DSToken
    const mockDSToken = (await hre.ethers.deployContract('MockDSToken', [
        'TestToken',
        'TT',
        6,
        registryServiceAddress,
    ])) as unknown as MockDSToken;
    const dsTokenAddress = await mockDSToken.getAddress();

    // Deploy VaultRegistrar via proxy (initialized by admin)
    const VaultRegistrar = await hre.ethers.getContractFactory('VaultRegistrar');
    const vaultRegistrar = (await hre.upgrades.deployProxy(VaultRegistrar, [dsTokenAddress], {
        initializer: 'initialize',
        kind: 'uups',
    })) as unknown as VaultRegistrar;
    await vaultRegistrar.waitForDeployment();

    // Deploy MockDeFiProtocol
    const mockDeFiProtocol = (await hre.ethers.deployContract('MockDeFiProtocol', [
        await vaultRegistrar.getAddress(),
        await mockDSToken.getAddress(),
    ])) as unknown as MockDeFiProtocol;
    await mockDeFiProtocol.waitForDeployment();

    // Grant OPERATOR_ROLE to MockDeFiProtocol (required to call registerVault())
    await vaultRegistrar.addOperator(await mockDeFiProtocol.getAddress());

    // Grant OPERATOR_ROLE to protocol1 for direct registerVault tests
    // protocol2 is used for tests that verify addOperator, so we don't grant the role here
    await vaultRegistrar.addOperator(protocol1.address);

    return {
        vaultRegistrar,
        mockDSToken,
        mockRegistryService,
        mockDeFiProtocol,
        admin,
        protocol1,
        protocol2,
        investor1,
        investor2,
        unauthorized,
        vaults,
    };
};
