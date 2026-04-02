import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const NotesModal = ({
    showNotes,
    setShowNotes,
    portfolioNotes,
    setPortfolioNotes,
    saveNotes,
    isSavingNotes
}) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [originalNotes, setOriginalNotes] = useState('');

    useEffect(() => {
        if (showNotes) {
            setOriginalNotes(portfolioNotes);
            setIsEnabled(false);
        }
    }, [showNotes]);

    const handleChange = (e) => {
        const newValue = e.target.value;
        setPortfolioNotes(newValue);

        if (!isEnabled && newValue.trim() !== originalNotes.trim()) {
            setIsEnabled(true);
        }
    };

    if (!showNotes) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">📝 Portfolio Notes</h2>
                    <button
                        onClick={() => {
                            setPortfolioNotes(originalNotes);
                            setIsEnabled(false);
                            setShowNotes(false);
                        }}
                        style={{ backgroundColor: '#d3d9de', appearance: 'none', WebkitAppearance: 'none' }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors bg-blue-600 "
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Notes content */}
                <div className="p-6 flex-1 overflow-y-auto" >
                    <textarea
                        value={portfolioNotes}
                        onChange={handleChange}
                        style={{ backgroundColor: '#d3d9de', appearance: 'none', WebkitAppearance: 'none', color:'black'}}
                        placeholder="Write your notes... Return anytime to find your notes here

Ideas:
- Investment goals
- Research notes
- Trading strategies
- Performance observations
- Reminders"
                        className="w-full h-96 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={async () => {
                            await saveNotes();
                            setOriginalNotes(portfolioNotes);
                            setIsEnabled(false);
                            setShowNotes(false);
                        }}
                        disabled={!isEnabled || isSavingNotes}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white ${isEnabled && !isSavingNotes ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                        <Save size={18} />
                        {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotesModal;