import hre from 'hardhat';

export const deployVaultWhitelister = async () => {
    const [admin, protocol1, protocol2, investor1, investor2, unauthorized, ...vaults] = await hre.ethers.getSigners();

    // Deploy mock registry service
    const mockRegistryService = await hre.ethers.deployContract('MockRegistryService', []);
    const registryServiceAddress = await mockRegistryService.getAddress();

    // Deploy mock DSToken
    const mockDSToken = await hre.ethers.deployContract('MockDSToken', [
        'TestToken',
        'TT',
        6,
        registryServiceAddress,
    ]);
    const dsTokenAddress = await mockDSToken.getAddress();

    // Deploy VaultWhitelister via proxy (initialized by admin)
    const VaultWhitelister = await hre.ethers.getContractFactory('VaultWhitelister');
    const vaultWhitelister = await hre.upgrades.deployProxy(VaultWhitelister, [dsTokenAddress], {
        initializer: 'initialize',
        kind: 'uups',
    });
    await vaultWhitelister.waitForDeployment();

    // Deploy MockDeFiProtocol
    const mockDeFiProtocol = await hre.ethers.deployContract('MockDeFiProtocol', [
        await vaultWhitelister.getAddress(),
        await mockDSToken.getAddress(),
    ]);
    await mockDeFiProtocol.waitForDeployment();

    // Grant OPERATOR_ROLE to MockDeFiProtocol (necesario para llamar whitelist())
    await vaultWhitelister.addOperator(await mockDeFiProtocol.getAddress());

    // Grant OPERATOR_ROLE to protocol1 para tests directos de whitelist
    // protocol2 se usa para tests que verifican addOperator, así que no le damos el rol aquí
    await vaultWhitelister.addOperator(protocol1.address);

    return {
        vaultWhitelister,
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
        // Keep old names for backward compatibility
        owner: admin,
        protocol: protocol1,
        investor: investor1,
        vault: vaults[0],
        unknownWallet: unauthorized,
    };
};
