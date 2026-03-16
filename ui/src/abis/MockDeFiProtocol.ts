export const MockDeFiProtocolAbi = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        name: 'investorVaults',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'investor', type: 'address' }],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'VaultCreated',
        type: 'event',
        inputs: [
            { name: 'investor', type: 'address', indexed: true },
            { name: 'vault', type: 'address', indexed: true },
        ],
    },
    {
        name: 'Deposit',
        type: 'event',
        inputs: [
            { name: 'investor', type: 'address', indexed: true },
            { name: 'vault', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
] as const;
