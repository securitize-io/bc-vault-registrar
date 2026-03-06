import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
    chains: [sepolia],
    connectors: [injected()],
    transports: {
        [sepolia.id]: http(import.meta.env.VITE_RPC_URL),
    },
});

export const CONTRACT_ADDRESSES = {
    vaultRegistrar: import.meta.env.VITE_VAULT_REGISTRAR_ADDRESS as `0x${string}`,
    mockDeFiProtocol: import.meta.env.VITE_MOCK_DEFI_PROTOCOL_ADDRESS as `0x${string}`,
    mockDSToken: import.meta.env.VITE_MOCK_DS_TOKEN_ADDRESS as `0x${string}`,
};
