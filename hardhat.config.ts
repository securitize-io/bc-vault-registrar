import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';
import './tasks/index';

const config: HardhatUserConfig = {
    mocha: {
        parallel: false,
    },
    solidity: {
        version: '0.8.22',
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        sepolia: {
            chainId: 11155111,
            url: process.env.SEPOLIA_RPC_URL ?? '',
            accounts: [process.env.DEPLOYER_PRIV_KEY!].filter((x) => x),
        },
        arbitrum: {
            chainId: 421614,
            gas: 'auto',
            url: process.env.ARBITRUM_RPC_URL ?? '',
            accounts: [process.env.DEPLOYER_PRIV_KEY!].filter((x) => x),
            allowUnlimitedContractSize: true,
        },
        optimism: {
            chainId: 11155420,
            url: process.env.OPTIMISM_RPC_URL ?? '',
            accounts: [process.env.DEPLOYER_PRIV_KEY!].filter((x) => x),
        },
        avaxtest: {
            url: process.env.AVAX_TESTNET_RPC_URL ?? '',
            accounts: [process.env.DEPLOYER_PRIV_KEY!].filter((x) => x),
        },
    },
    etherscan: {
        apiKey: process.env.API_KEY_ETHERSCAN,
    },
};

export default config;
