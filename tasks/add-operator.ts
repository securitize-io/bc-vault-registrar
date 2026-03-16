import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

interface AddOperatorArgs {
    registrar: string;
    operator: string;
}

task('add-operator', 'Grants OPERATOR_ROLE to an address on a VaultRegistrar')
    .addParam('registrar', 'The VaultRegistrar proxy address')
    .addParam('operator', 'The operator address to grant the role to')
    .setAction(async (args: AddOperatorArgs, hre: HardhatRuntimeEnvironment) => {
        const { registrar, operator } = args;

        const vaultRegistrar = await hre.ethers.getContractAt('VaultRegistrar', registrar);

        const [signer] = await hre.ethers.getSigners();
        console.log('Signer:   ', signer.address);
        console.log('Registrar:', registrar);
        console.log('Operator: ', operator);

        const isAlreadyOperator = await vaultRegistrar.isOperator(operator);
        if (isAlreadyOperator) {
            console.log('\nAddress already has OPERATOR_ROLE — nothing to do.');
            return;
        }

        const tx = await vaultRegistrar.addOperator(operator);
        console.log('\nTx submitted:', tx.hash);

        const receipt = await tx.wait();
        console.log('Confirmed in block:', receipt?.blockNumber);
        console.log(`\nOperator ${operator} added successfully.`);
    });
