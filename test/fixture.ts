import hre from 'hardhat';

export const deployWhitelister = async () => {
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

    // Deploy Whitelister via proxy (initialized by admin)
    const Whitelister = await hre.ethers.getContractFactory('Whitelister');
    const whitelister = await hre.upgrades.deployProxy(Whitelister, [dsTokenAddress], {
        initializer: 'initialize',
        kind: 'uups',
    });
    await whitelister.waitForDeployment();

    // Deploy MockDeFiProtocol
    const mockDeFiProtocol = await hre.ethers.deployContract('MockDeFiProtocol', [
        await whitelister.getAddress(),
        await mockDSToken.getAddress(),
    ]);
    await mockDeFiProtocol.waitForDeployment();

    // Grant OPERATOR_ROLE to MockDeFiProtocol (required to call whitelist())
    await whitelister.addOperator(await mockDeFiProtocol.getAddress());

    // Grant OPERATOR_ROLE to protocol1 for direct whitelist tests
    // protocol2 is used for tests that verify addOperator, so we don't grant the role here
    await whitelister.addOperator(protocol1.address);

    return {
        whitelister,
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
