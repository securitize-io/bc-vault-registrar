import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connect, isPending } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 font-mono">
                    {address.slice(0, 6)}…{address.slice(-4)}
                </span>
                <button
                    onClick={() => disconnect()}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 transition-colors"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
            {isPending ? 'Connecting…' : 'Connect MetaMask'}
        </button>
    );
}
