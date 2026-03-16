import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { type Hex } from 'viem';
import { CONTRACT_ADDRESSES } from '../wagmi.config';
import { VaultRegistrarAbi } from '../abis/VaultRegistrar';

export function RevokePanel() {
    const { address: investor } = useAccount();
    const publicClient = usePublicClient();

    const [operator, setOperator] = useState<string>(CONTRACT_ADDRESSES.mockDeFiProtocol);
    const [txHash, setTxHash] = useState<Hex | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revokedNonce, setRevokedNonce] = useState<bigint | null>(null);

    const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(operator);

    const { data: currentNonce, refetch: refetchNonce } = useReadContract({
        address: CONTRACT_ADDRESSES.vaultRegistrar,
        abi: VaultRegistrarAbi,
        functionName: 'operatorNonce',
        args: [investor!, operator as `0x${string}`],
        query: { enabled: !!investor && isValidAddress },
    });

    const { writeContractAsync: revokeAsync, isPending: isRevoking } = useWriteContract();

    async function handleRevoke() {
        if (!investor || !publicClient || !isValidAddress) return;
        setError(null);
        setTxHash(null);
        setRevokedNonce(null);

        try {
            const hash = await revokeAsync({
                address: CONTRACT_ADDRESSES.vaultRegistrar,
                abi: VaultRegistrarAbi,
                functionName: 'invalidateOperatorPermission',
                args: [operator as `0x${string}`],
            });

            await publicClient.waitForTransactionReceipt({ hash });
            const { data: newNonce } = await refetchNonce();
            setRevokedNonce(newNonce ?? null);
            setTxHash(hash);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Revoke failed');
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Invalidate the standing permission you granted to an operator. Any signature built with the previous
                nonce will be rejected. You can re-authorize the operator by signing again with the new nonce.
            </p>

            {/* operator input */}
            <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Operator address</label>
                <input
                    type="text"
                    value={operator}
                    onChange={(e) => {
                        setOperator(e.target.value);
                        setTxHash(null);
                        setError(null);
                        setRevokedNonce(null);
                    }}
                    placeholder="0x…"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
            </div>

            {/* nonce display */}
            {isValidAddress && currentNonce !== undefined && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500">Current nonce for this operator: </span>
                    <span className="text-white font-mono">{currentNonce.toString()}</span>
                </div>
            )}

            {/* revoke button */}
            <button
                onClick={handleRevoke}
                disabled={!isValidAddress || isRevoking}
                className="w-full py-3 px-4 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
                {isRevoking ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Revoking…
                    </span>
                ) : (
                    'Revoke operator permission'
                )}
            </button>

            {/* success */}
            {txHash && revokedNonce !== null && (
                <div className="rounded-lg bg-green-950 border border-green-700 p-4 space-y-2 text-sm">
                    <p className="text-green-400 font-semibold">✓ Permission revoked</p>
                    <div className="space-y-1 text-gray-400">
                        <p>
                            New nonce:{' '}
                            <span className="text-white font-mono">{revokedNonce.toString()}</span>
                        </p>
                        <p>
                            Tx:{' '}
                            <span className="font-mono text-gray-300 break-all">{txHash}</span>
                        </p>
                    </div>
                    <p className="text-yellow-400 text-xs">
                        Any existing signature for this operator is now invalid. Re-sign to grant access again.
                    </p>
                </div>
            )}

            {/* error */}
            {error && (
                <div className="rounded-lg bg-red-950 border border-red-700 p-3 text-sm text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
