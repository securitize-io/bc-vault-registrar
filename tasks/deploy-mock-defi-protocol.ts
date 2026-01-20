import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

interface DeployMockDeFiProtocolArgs {
    whitelister: string;
    dstoken: string;
    verify?: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

task('deploy-mock-defi-protocol', 'Deploys the MockDeFiProtocol contract')
    .addParam('whitelister', 'The Whitelister address')
    .addParam('dstoken', 'The DSToken address')
    .addFlag('verify', 'Verify the contract on Etherscan')
    .setAction(async (args: DeployMockDeFiProtocolArgs, hre: HardhatRuntimeEnvironment) => {
        const { whitelister, dstoken, verify } = args;

        console.log('Deploying MockDeFiProtocol...');
        console.log('Whitelister address:', whitelister);
        console.log('DSToken address:', dstoken);

        const mockDeFiProtocol = await hre.ethers.deployContract('MockDeFiProtocol', [
            whitelister,
            dstoken,
        ]);

        await mockDeFiProtocol.waitForDeployment();

        const address = await mockDeFiProtocol.getAddress();

        console.log('MockDeFiProtocol deployed successfully!');
        console.log('Address:', address);

        if (verify) {
            console.log('\nWaiting 40 seconds before verifying...');
            await delay(40000);

            console.log(`Verifying MockDeFiProtocol at ${address} on ${hre.network.name}...`);

            try {
                await hre.run('verify:verify', {
                    address: address,
                    constructorArguments: [whitelister, dstoken],
                });
                console.log('Contract verified successfully!');
            } catch (error) {
                console.error(`Verification failed for MockDeFiProtocol at ${address}:`, error);
            }
        }

        return {
            mockDeFiProtocol,
            address,
        };
    });
