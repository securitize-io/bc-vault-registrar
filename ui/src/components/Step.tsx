interface StepProps {
    number: number;
    title: string;
    active: boolean;
    done: boolean;
}

export function Step({ number, title, active, done }: StepProps) {
    return (
        <div className={`flex items-center gap-3 ${active ? 'opacity-100' : 'opacity-40'}`}>
            <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
                {done ? '✓' : number}
            </div>
            <span className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{title}</span>
        </div>
    );
}
