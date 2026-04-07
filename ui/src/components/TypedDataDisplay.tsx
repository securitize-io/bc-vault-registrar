interface TypedDataDisplayProps {
    investor: string;
    operator: string;
    token: string;
    nonce: string;
    deadline: number;
    verifyingContract: string;
    chainId: number;
}

export function TypedDataDisplay({
    investor,
    operator,
    token,
    nonce,
    deadline,
    verifyingContract,
    chainId,
}: TypedDataDisplayProps) {
    const data = {
        domain: {
            name: 'VaultRegistrar',
            version: '1',
            chainId,
            verifyingContract,
        },
        types: {
            RegisterVault: [
                { name: 'investor', type: 'address' },
                { name: 'operator', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ],
        },
        message: {
            investor,
            operator,
            token,
            nonce,
            deadline: new Date(deadline * 1000).toISOString(),
            deadlineUnix: deadline,
        },
    };

    return (
        <div className="rounded-lg bg-gray-900 border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    EIP-712 Typed Data
                </span>
            </div>
            <pre className="p-4 text-xs text-green-400 font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}
