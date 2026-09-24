import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CustomFranchise } from '../../../types';
import { POPULAR_FRANCHISES } from '../../../constants';

interface FranchisesTabProps {
  enabledFranchises: string[];
  setEnabledFranchises: React.Dispatch<React.SetStateAction<string[]>>;
  customFranchises: CustomFranchise[];
  setCustomFranchises: React.Dispatch<React.SetStateAction<CustomFranchise[]>>;
}

export const FranchisesTab: React.FC<FranchisesTabProps> = ({
  enabledFranchises,
  setEnabledFranchises,
  customFranchises,
  setCustomFranchises,
}) => {
  const [newFranchiseName, setNewFranchiseName] = useState('');
  const [newFranchiseKeywords, setNewFranchiseKeywords] = useState('');

  const toggleFranchise = (id: string) => {
    setEnabledFranchises((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
    });
  };

  const handleAddCustomFranchise = () => {
    if (!newFranchiseName.trim()) return;
    const id = `custom-${Date.now()}`;
    const keywords = newFranchiseKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const newFranchise: CustomFranchise = {
      id,
      name: newFranchiseName.trim(),
      color: 'bg-teal-50 text-teal-600 border-teal-200',
      keywords: keywords.length > 0 ? keywords : [newFranchiseName.trim().toLowerCase()],
      is_enabled: true,
    };

    setCustomFranchises((prev) => [...prev, newFranchise]);
    setEnabledFranchises((prev) => [...prev, id]);
    setNewFranchiseName('');
    setNewFranchiseKeywords('');
  };

  const handleDeleteCustomFranchise = (id: string) => {
    setCustomFranchises((prev) => prev.filter((f) => f.id !== id));
    setEnabledFranchises((prev) => prev.filter((item) => item !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-black uppercase tracking-wide text-retro-text mb-1">
          Franchises à Afficher dans la Barre Latérale
        </h4>
        <p className="text-[11px] text-retro-textMuted mb-4">
          Cochez ou décochez les sagas que vous souhaitez voir apparaître dans votre menu.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POPULAR_FRANCHISES.map((franchise) => {
            const isChecked = Array.isArray(enabledFranchises) && enabledFranchises.includes(franchise.id);
            return (
              <label
                key={franchise.id}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-white border-retro-primary shadow-retro'
                    : 'bg-retro-bg border-retro-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-retro-text">{franchise.name}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFranchise(franchise.id)}
                  className="w-4 h-4 rounded text-retro-primary focus:ring-retro-primary"
                />
              </label>
            );
          })}

          {customFranchises.map((custom) => {
            const isChecked = Array.isArray(enabledFranchises) && enabledFranchises.includes(custom.id);
            return (
              <div
                key={custom.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isChecked
                    ? 'bg-white border-retro-cyan shadow-retro'
                    : 'bg-retro-bg border-retro-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFranchise(custom.id)}
                    className="w-4 h-4 rounded text-retro-cyan focus:ring-retro-cyan"
                  />
                  <span className="text-xs font-bold text-retro-text">{custom.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCustomFranchise(custom.id)}
                  className="p-1 rounded-md text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ajouter une nouvelle franchise personnalisée */}
      <div className="p-4 rounded-2xl bg-retro-bg border border-retro-border space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-retro-text">
          <Plus className="w-4 h-4 text-retro-primary" />
          <span>Ajouter une Franchise Personnalisée</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-retro-textMuted mb-1">
              Nom de la Franchise (ex: Castlevania)
            </label>
            <input
              type="text"
              value={newFranchiseName}
              onChange={(e) => setNewFranchiseName(e.target.value)}
              placeholder="Nom affiché dans le menu"
              className="w-full px-3 py-2 rounded-xl bg-white border border-retro-border text-xs text-retro-text focus:outline-none focus:border-retro-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-retro-textMuted mb-1">
              Mots-clés séparés par virgules
            </label>
            <input
              type="text"
              value={newFranchiseKeywords}
              onChange={(e) => setNewFranchiseKeywords(e.target.value)}
              placeholder="ex: castlevania, belmont, dracula"
              className="w-full px-3 py-2 rounded-xl bg-white border border-retro-border text-xs text-retro-text focus:outline-none focus:border-retro-primary"
            />
          </div>
        </div>

        <button
          onClick={handleAddCustomFranchise}
          disabled={!newFranchiseName.trim()}
          className="px-4 py-2 rounded-xl bg-white border border-retro-border text-xs font-bold text-retro-primary hover:border-retro-primary disabled:opacity-50 transition-all shadow-sm"
        >
          + Ajouter la franchise
        </button>
      </div>
    </div>
  );
};
