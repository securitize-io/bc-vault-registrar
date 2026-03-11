import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from './components/ConnectButton';
import { DepositFlow } from './components/DepositFlow';
import { RevokePanel } from './components/RevokePanel';

type Tab = 'deposit' | 'revoke';

export default function App() {
    const { isConnected } = useAccount();
    const [tab, setTab] = useState<Tab>('deposit');

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
                        {/* tabs */}
                        <div className="flex border-b border-gray-800">
                            <TabButton active={tab === 'deposit'} onClick={() => setTab('deposit')}>
                                Deposit &amp; Register
                            </TabButton>
                            <TabButton active={tab === 'revoke'} onClick={() => setTab('revoke')}>
                                Revoke Permission
                            </TabButton>
                        </div>

                        {tab === 'deposit' && (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-semibold">Deposit &amp; Register Vault</h2>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Sign once to grant the DeFi protocol a standing permission. The same signature
                                        can be reused for any number of vault registrations until you revoke it.
                                    </p>
                                </div>
                                <DepositFlow />
                            </div>
                        )}

                        {tab === 'revoke' && (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-semibold">Revoke Operator Permission</h2>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Increment your nonce for a specific operator, invalidating any signature they
                                        currently hold.
                                    </p>
                                </div>
                                <RevokePanel />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
        >
            {children}
        </button>
    );
}
