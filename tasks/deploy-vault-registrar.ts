import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

interface DeployVaultRegistrarArgs {
    dstoken: string;
    verify?: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

task('deploy-vault-registrar', 'Deploys the VaultRegistrar contract')
    .addParam('dstoken', 'The DSToken address')
    .addFlag('verify', 'Verify the contract on Etherscan')
    .setAction(async (args: DeployVaultRegistrarArgs, hre: HardhatRuntimeEnvironment) => {
        const { dstoken, verify } = args;

        console.log('Deploying VaultRegistrar...');
        console.log('DSToken address:', dstoken);

        const VaultRegistrar = await hre.ethers.getContractFactory('VaultRegistrar');

        const vaultRegistrar = await hre.upgrades.deployProxy(VaultRegistrar, [dstoken], {
            initializer: 'initialize',
            kind: 'uups',
        });

        await vaultRegistrar.waitForDeployment();

        const proxyAddress = await vaultRegistrar.getAddress();
        const implementationAddress = await vaultRegistrar.getImplementationAddress();

        console.log('VaultRegistrar deployed successfully!');
        console.log('Proxy address:', proxyAddress);
        console.log('Implementation address:', implementationAddress);

        if (verify) {
            console.log('\nWaiting 40 seconds before verifying...');
            await delay(40000);

            console.log(`Verifying VaultRegistrar implementation at ${implementationAddress} on ${hre.network.name}...`);

            try {
                await hre.run('verify:verify', {
                    address: implementationAddress,
                    constructorArguments: [],
                });
                console.log('Contract verified successfully!');
            } catch (error) {
                console.error(`Verification failed for VaultRegistrar at ${implementationAddress}:`, error);
            }
        }

        return {
            vaultRegistrar,
            proxyAddress,
            implementationAddress,
        };
    });
