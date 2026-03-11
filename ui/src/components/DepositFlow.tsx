import { useState } from 'react';
import { useAccount, useReadContract, useSignTypedData, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, type Hex, ContractFunctionRevertedError } from 'viem';
import { CONTRACT_ADDRESSES } from '../wagmi.config';
import { VaultRegistrarAbi } from '../abis/VaultRegistrar';
import { MockDeFiProtocolAbi } from '../abis/MockDeFiProtocol';
import { MockDSTokenAbi } from '../abis/MockDSToken';
import { TypedDataDisplay } from './TypedDataDisplay';
import { Step } from './Step';

const DEADLINE_SECONDS = 600; // 10 minutes

type FlowStep = 'input' | 'sign' | 'approve' | 'deposit' | 'done';

interface TxResult {
    hash: Hex;
    vaultAddress: string;
}

export function DepositFlow() {
    const { address: investor } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();

    const [amount, setAmount] = useState('');
    const [step, setStep] = useState<FlowStep>('input');
    const [deadline, setDeadline] = useState<number>(0);
    const [signature, setSignature] = useState<Hex | null>(null);
    // Nonce that was used when the current signature was built
    const [nonceAtSign, setNonceAtSign] = useState<bigint | null>(null);
    const [result, setResult] = useState<TxResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    // True while waiting for the tx receipt after submission
    const [isWaitingReceipt, setIsWaitingReceipt] = useState(false);

    // ── reads ──────────────────────────────────────────────────────────────
    const { data: operatorNonce, refetch: refetchNonce } = useReadContract({
        address: CONTRACT_ADDRESSES.vaultRegistrar,
        abi: VaultRegistrarAbi,
        functionName: 'operatorNonce',
        args: [investor!, CONTRACT_ADDRESSES.mockDeFiProtocol],
        query: { enabled: !!investor },
    });

    const { data: decimals } = useReadContract({
        address: CONTRACT_ADDRESSES.mockDSToken,
        abi: MockDSTokenAbi,
        functionName: 'decimals',
    });

    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: CONTRACT_ADDRESSES.mockDSToken,
        abi: MockDSTokenAbi,
        functionName: 'balanceOf',
        args: [investor!],
        query: { enabled: !!investor },
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: CONTRACT_ADDRESSES.mockDSToken,
        abi: MockDSTokenAbi,
        functionName: 'allowance',
        args: [investor!, CONTRACT_ADDRESSES.mockDeFiProtocol],
        query: { enabled: !!investor },
    });

    const { data: existingVault } = useReadContract({
        address: CONTRACT_ADDRESSES.mockDeFiProtocol,
        abi: MockDeFiProtocolAbi,
        functionName: 'investorVaults',
        args: [investor!],
        query: { enabled: !!investor },
    });

    // ── sign typed data ────────────────────────────────────────────────────
    const { signTypedDataAsync, isPending: isSigning } = useSignTypedData();

    // ── write contracts ────────────────────────────────────────────────────
    const { writeContractAsync: approveAsync, isPending: isApproving } = useWriteContract();
    const { writeContractAsync: depositAsync, isPending: isDepositing } = useWriteContract();

    const dec = decimals ?? 6;
    const parsedAmount = amount ? parseUnits(amount, dec) : 0n;
    const formattedBalance = balance !== undefined ? formatUnits(balance, dec) : '…';
    const hasEnoughAllowance = allowance !== undefined && parsedAmount > 0n && allowance >= parsedAmount;
    const vaultAlreadyExists =
        existingVault && existingVault !== '0x0000000000000000000000000000000000000000';

    // Signature is still valid when it exists and was built with the current nonce
    const sigIsValid =
        signature !== null &&
        nonceAtSign !== null &&
        operatorNonce !== undefined &&
        nonceAtSign === operatorNonce;

    // Full reset — clears everything including signature
    function reset() {
        setStep('input');
        setSignature(null);
        setNonceAtSign(null);
        setDeadline(0);
        setResult(null);
        setError(null);
        setAmount('');
    }

    // Partial reset — keeps signature so it can be reused
    function resetForNextDeposit() {
        setStep('input');
        setResult(null);
        setError(null);
        setAmount('');
    }

    // ── step handlers ──────────────────────────────────────────────────────
    async function handleSign() {
        if (!investor || operatorNonce === undefined) return;
        setError(null);

        const dl = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS;
        setDeadline(dl);

        try {
            const sig = await signTypedDataAsync({
                domain: {
                    name: 'VaultRegistrar',
                    version: '1',
                    chainId,
                    verifyingContract: CONTRACT_ADDRESSES.vaultRegistrar,
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
                primaryType: 'RegisterVault',
                message: {
                    investor,
                    operator: CONTRACT_ADDRESSES.mockDeFiProtocol,
                    token: CONTRACT_ADDRESSES.mockDSToken,
                    nonce: operatorNonce,
                    deadline: BigInt(dl),
                },
            });
            setSignature(sig);
            setNonceAtSign(operatorNonce);
            setStep('approve');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Signing rejected');
        }
    }

    async function handleApprove() {
        setError(null);
        try {
            await approveAsync({
                address: CONTRACT_ADDRESSES.mockDSToken,
                abi: MockDSTokenAbi,
                functionName: 'approve',
                args: [CONTRACT_ADDRESSES.mockDeFiProtocol, parsedAmount],
            });
            await refetchAllowance();
            setStep('deposit');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Approve failed');
        }
    }

    async function handleDeposit() {
        if (!signature || !publicClient || !investor) return;
        setError(null);

        const callArgs = {
            address: CONTRACT_ADDRESSES.mockDeFiProtocol,
            abi: MockDeFiProtocolAbi,
            functionName: 'deposit',
            args: [parsedAmount, BigInt(deadline), signature],
            account: investor as `0x${string}`,
        } as const;

        try {
            await publicClient.simulateContract(callArgs);
        } catch (e: unknown) {
            if (e instanceof ContractFunctionRevertedError) {
                setError(`Contract reverted: ${e.data?.errorName ?? e.shortMessage}`);
            } else {
                setError(e instanceof Error ? e.message : 'Simulation failed');
            }
            return;
        }

        try {
            const hash = await depositAsync(callArgs);

            setIsWaitingReceipt(true);
            try {
                await publicClient.waitForTransactionReceipt({ hash });

                const vault = await publicClient.readContract({
                    address: CONTRACT_ADDRESSES.mockDeFiProtocol,
                    abi: MockDeFiProtocolAbi,
                    functionName: 'investorVaults',
                    args: [investor as `0x${string}`],
                });

                await Promise.all([refetchBalance(), refetchNonce()]);
                setResult({ hash, vaultAddress: vault as string });
                setStep('done');
            } finally {
                setIsWaitingReceipt(false);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Deposit failed');
        }
    }

    // ── derived step numbers for stepper ──────────────────────────────────
    const stepIndex = { input: 0, sign: 1, approve: 2, deposit: 3, done: 4 };
    const current = stepIndex[step];

    return (
        <div className="space-y-6">
            {/* stepper */}
            <div className="flex items-center gap-6">
                <Step number={1} title="Sign" active={current >= 1} done={current > 1} />
                <div className="h-px flex-1 bg-gray-700" />
                <Step number={2} title="Approve" active={current >= 2} done={current > 2} />
                <div className="h-px flex-1 bg-gray-700" />
                <Step number={3} title="Deposit" active={current >= 3} done={current > 3} />
            </div>

            {/* investor info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Investor" value={investor ?? '—'} mono />
                <InfoRow label="DSToken balance" value={`${formattedBalance} tokens`} />
                <InfoRow
                    label="Operator nonce"
                    value={operatorNonce !== undefined ? operatorNonce.toString() : '…'}
                />
                {vaultAlreadyExists && (
                    <InfoRow label="Existing vault" value={existingVault as string} mono />
                )}
            </div>

            {/* standing permission banner */}
            {sigIsValid && step === 'input' && (
                <div className="rounded-lg bg-indigo-950 border border-indigo-600 px-4 py-3 space-y-1">
                    <p className="text-sm font-medium text-indigo-300">Standing permission active</p>
                    <p className="text-xs text-indigo-400">
                        You already signed a permission for this operator. You can deposit again without re-signing.
                    </p>
                    <p className="text-xs font-mono text-indigo-500 break-all">{signature}</p>
                </div>
            )}

            {/* stale signature warning */}
            {signature !== null && !sigIsValid && step === 'input' && (
                <div className="rounded-lg bg-yellow-950 border border-yellow-700 px-4 py-3">
                    <p className="text-sm text-yellow-400">
                        Your previous signature was invalidated (nonce changed). You need to sign again.
                    </p>
                </div>
            )}

            {/* ── step: input ── */}
            {step === 'input' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Deposit amount</label>
                        <input
                            type="number"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 100"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    {vaultAlreadyExists ? (
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-400">
                                You already have a vault. Skipping registration — going straight to approve.
                            </p>
                            <ActionButton onClick={() => setStep('approve')} disabled={!parsedAmount}>
                                Continue to Approve
                            </ActionButton>
                        </div>
                    ) : sigIsValid ? (
                        <div className="space-y-2">
                            <ActionButton onClick={() => setStep('approve')} disabled={!parsedAmount}>
                                Use existing signature → Approve
                            </ActionButton>
                            <button
                                onClick={() => setStep('sign')}
                                className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                Re-sign instead
                            </button>
                        </div>
                    ) : (
                        <ActionButton onClick={() => setStep('sign')} disabled={!parsedAmount}>
                            Continue to Sign
                        </ActionButton>
                    )}
                </div>
            )}

            {/* ── step: sign ── */}
            {step === 'sign' && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Your wallet will prompt you to sign the following EIP-712 typed data. This grants the DeFi
                        protocol a <span className="text-white">standing permission</span> to register vaults on your
                        behalf — the same signature can be reused for future deposits until you revoke it.
                    </p>
                    {operatorNonce !== undefined && (
                        <TypedDataDisplay
                            investor={investor!}
                            operator={CONTRACT_ADDRESSES.mockDeFiProtocol}
                            token={CONTRACT_ADDRESSES.mockDSToken}
                            nonce={operatorNonce.toString()}
                            deadline={Math.floor(Date.now() / 1000) + DEADLINE_SECONDS}
                            verifyingContract={CONTRACT_ADDRESSES.vaultRegistrar}
                            chainId={chainId}
                        />
                    )}
                    <ActionButton onClick={handleSign} loading={isSigning}>
                        Sign with Wallet
                    </ActionButton>
                </div>
            )}

            {/* ── step: approve ── */}
            {step === 'approve' && (
                <div className="space-y-4">
                    {signature && (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Signature</p>
                            <p className="text-xs font-mono text-green-400 break-all bg-gray-900 rounded p-3">
                                {signature}
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-gray-400">
                        Approve the DeFi protocol to spend <span className="text-white">{amount} tokens</span>.
                    </p>
                    {hasEnoughAllowance ? (
                        <div className="space-y-2">
                            <p className="text-sm text-green-400">✓ Allowance already sufficient</p>
                            <ActionButton onClick={() => setStep('deposit')}>Continue to Deposit</ActionButton>
                        </div>
                    ) : (
                        <ActionButton onClick={handleApprove} loading={isApproving}>
                            Approve {amount} tokens
                        </ActionButton>
                    )}
                </div>
            )}

            {/* ── step: deposit ── */}
            {step === 'deposit' && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Ready to deposit. The protocol will create a vault (if needed), call{' '}
                        <code className="text-indigo-400">registerVaultWithSig</code>, and transfer your tokens.
                    </p>
                    <ActionButton onClick={handleDeposit} loading={isDepositing || isWaitingReceipt}>
                        {isDepositing ? 'Confirm in wallet…' : isWaitingReceipt ? 'Waiting for confirmation…' : `Deposit ${amount} tokens`}
                    </ActionButton>
                </div>
            )}

            {/* ── step: done ── */}
            {step === 'done' && result && (
                <div className="space-y-4">
                    <div className="rounded-lg bg-green-950 border border-green-700 p-4 space-y-3">
                        <p className="text-green-400 font-semibold">✓ Deposit successful</p>
                        <InfoRow label="Tx hash" value={result.hash} mono />
                        <InfoRow label="Vault address" value={result.vaultAddress} mono />
                    </div>
                    <div className="rounded-lg bg-indigo-950 border border-indigo-700 px-4 py-3 text-sm text-indigo-300">
                        Your signature is still valid — you can deposit again without re-signing.
                    </div>
                    <div className="flex gap-3">
                        <ActionButton onClick={resetForNextDeposit}>
                            Deposit again
                        </ActionButton>
                        <button
                            onClick={reset}
                            className="flex-1 py-3 px-4 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Start fresh
                        </button>
                    </div>
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-sm text-gray-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );
}

function ActionButton({
    onClick,
    disabled,
    loading,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                        />
                    </svg>
                    Processing…
                </span>
            ) : (
                children
            )}
        </button>
    );
}
