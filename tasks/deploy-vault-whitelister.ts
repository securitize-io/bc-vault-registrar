import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

interface DeployVaultWhitelisterArgs {
    dstoken: string;
    verify?: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

task('deploy-vault-whitelister', 'Deploys the VaultWhitelister contract')
    .addParam('dstoken', 'The DSToken address')
    .addFlag('verify', 'Verify the contract on Etherscan')
    .setAction(async (args: DeployVaultWhitelisterArgs, hre: HardhatRuntimeEnvironment) => {
        const { dstoken, verify } = args;

        console.log('Deploying VaultWhitelister...');
        console.log('DSToken address:', dstoken);

        const VaultWhitelister = await hre.ethers.getContractFactory('VaultWhitelister');

        const vaultWhitelister = await hre.upgrades.deployProxy(VaultWhitelister, [dstoken], {
            initializer: 'initialize',
            kind: 'uups',
        });

        await vaultWhitelister.waitForDeployment();

        const proxyAddress = await vaultWhitelister.getAddress();
        const implementationAddress = await vaultWhitelister.getImplementationAddress();

        console.log('VaultWhitelister deployed successfully!');
        console.log('Proxy address:', proxyAddress);
        console.log('Implementation address:', implementationAddress);

        if (verify) {
            console.log('\nWaiting 40 seconds before verifying...');
            await delay(40000);

            console.log(`Verifying VaultWhitelister implementation at ${implementationAddress} on ${hre.network.name}...`);

            try {
                await hre.run('verify:verify', {
                    address: implementationAddress,
                    constructorArguments: [],
                });
                console.log('Contract verified successfully!');
            } catch (error) {
                console.error(`Verification failed for VaultWhitelister at ${implementationAddress}:`, error);
            }
        }

        return {
            vaultWhitelister,
            proxyAddress,
            implementationAddress,
        };
    });
