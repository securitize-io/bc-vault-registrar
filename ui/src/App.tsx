import { useAccount } from 'wagmi';
import { ConnectButton } from './components/ConnectButton';
import { DepositFlow } from './components/DepositFlow';

export default function App() {
    const { isConnected } = useAccount();

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* header */}
            <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white">VaultRegistrar</h1>
                    <p className="text-xs text-gray-500">Reference UI — Sepolia testnet</p>
                </div>
                <ConnectButton />
            </header>

            {/* main */}
            <main className="max-w-xl mx-auto px-6 py-10">
                {!isConnected ? (
                    <div className="text-center space-y-3 mt-20">
                        <p className="text-2xl font-semibold">Connect your wallet</p>
                        <p className="text-gray-400 text-sm">
                            Connect MetaMask to simulate a vault deposit and registration.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold">Deposit &amp; Register Vault</h2>
                            <p className="text-sm text-gray-400 mt-1">
                                Sign an EIP-712 authorization, approve tokens, then deposit into the mock DeFi
                                protocol. The protocol will register your vault automatically.
                            </p>
                        </div>
                        <DepositFlow />
                    </div>
                )}
            </main>
        </div>
    );
}
