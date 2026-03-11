export const VaultRegistrarAbi = [
    {
        name: 'operatorNonce',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'investor', type: 'address' },
            { name: 'operator', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'invalidateOperatorPermission',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'operator', type: 'address' }],
        outputs: [],
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
    {
        name: 'OperatorPermissionInvalidated',
        type: 'event',
        inputs: [
            { name: 'investor', type: 'address', indexed: true },
            { name: 'operator', type: 'address', indexed: true },
            { name: 'newNonce', type: 'uint256', indexed: false },
        ],
    },
] as const;
