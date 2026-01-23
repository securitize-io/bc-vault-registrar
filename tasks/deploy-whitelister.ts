import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

interface DeployWhitelisterArgs {
    dstoken: string;
    verify?: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

task('deploy-whitelister', 'Deploys the Whitelister contract')
    .addParam('dstoken', 'The DSToken address')
    .addFlag('verify', 'Verify the contract on Etherscan')
    .setAction(async (args: DeployWhitelisterArgs, hre: HardhatRuntimeEnvironment) => {
        const { dstoken, verify } = args;

        console.log('Deploying Whitelister...');
        console.log('DSToken address:', dstoken);

        const Whitelister = await hre.ethers.getContractFactory('Whitelister');

        const whitelister = await hre.upgrades.deployProxy(Whitelister, [dstoken], {
            initializer: 'initialize',
            kind: 'uups',
        });

        await whitelister.waitForDeployment();

        const proxyAddress = await whitelister.getAddress();
        const implementationAddress = await whitelister.getImplementationAddress();

        console.log('Whitelister deployed successfully!');
        console.log('Proxy address:', proxyAddress);
        console.log('Implementation address:', implementationAddress);

        if (verify) {
            console.log('\nWaiting 40 seconds before verifying...');
            await delay(40000);

            console.log(`Verifying Whitelister implementation at ${implementationAddress} on ${hre.network.name}...`);

            try {
                await hre.run('verify:verify', {
                    address: implementationAddress,
                    constructorArguments: [],
                });
                console.log('Contract verified successfully!');
            } catch (error) {
                console.error(`Verification failed for Whitelister at ${implementationAddress}:`, error);
            }
        }

        return {
            whitelister,
            proxyAddress,
            implementationAddress,
        };
    });
