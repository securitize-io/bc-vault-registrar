export const VaultRegistrarAbi = [
    {
        name: 'nonces',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'isRegistered',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'vaultAddress', type: 'address' },
            { name: 'investorWalletAddress', type: 'address' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'DOMAIN_SEPARATOR',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
    },
] as const;
