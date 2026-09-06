import React, { useState, useEffect } from 'react';
import { Wifi, Eye, EyeOff, Copy, Check, ShieldCheck } from 'lucide-react';
import { AppSettings, RemoteConfig } from '../../../types';

interface NetworkSectionProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, val: any) => void;
  remoteConfig?: RemoteConfig;
  onSaveRemoteConfig?: (cfg: RemoteConfig) => Promise<void>;
}

export const NetworkSection: React.FC<NetworkSectionProps> = ({
  settings,
  updateSetting,
  remoteConfig,
  onSaveRemoteConfig,
}) => {
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localPort, setLocalPort] = useState(remoteConfig?.port || 8080);
  const [localPin, setLocalPin] = useState(remoteConfig?.pin || '1234');
  const detectedIp = '192.168.1.50';

  useEffect(() => {
    if (remoteConfig) {
      setLocalPort(remoteConfig.port);
      setLocalPin(remoteConfig.pin);
    }
  }, [remoteConfig]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`http://${detectedIp}:${localPort}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNetwork = async (port: number, pin: string) => {
    if (onSaveRemoteConfig && remoteConfig) {
      await onSaveRemoteConfig({
        ...remoteConfig,
        port,
        pin,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Serveur Remote PWA */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
        className="p-5 rounded-3xl border shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-purple-600" />
          <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
            Serveur Web & Télécommande Mobile (Kaïro Remote)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold mb-1">
              Port du Serveur Remote
            </label>
            <input
              type="number"
              value={localPort}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 8080;
                setLocalPort(val);
                handleSaveNetwork(val, localPin);
              }}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full text-xs font-mono p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <p style={{ color: 'var(--text-muted)' }} className="text-[10px] mt-1">Par défaut : 8080</p>
          </div>

          <div>
            <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold mb-1">
              Code PIN d'Accès Sécurisé
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={localPin}
                  onChange={(e) => {
                    setLocalPin(e.target.value);
                    handleSaveNetwork(localPort, e.target.value);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border pr-9 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-[10px] mt-1">
              Requis pour l'accès sans manette physique locale
            </p>
          </div>

          <label
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
            }}
            className="sm:col-span-2 flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors"
          >
            <div>
              <div style={{ color: 'var(--text-primary)' }} className="text-xs font-black">
                Démarrer le serveur remote automatiquement
              </div>
              <div style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                Permet le contrôle à distance dès l'allumage de la borne
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings?.remote_autostart ?? true)}
              onChange={(e) => updateSetting('remote_autostart', e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
            />
          </label>
        </div>
      </div>

      {/* 2. Adresse IP & Connexion */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
        className="p-5 rounded-3xl border shadow-xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
            Adresse de Connexion Télécommande
          </h3>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
          className="p-4 rounded-2xl border flex items-center justify-between"
        >
          <div>
            <div style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold uppercase">
              URL Locale de la borne
            </div>
            <div style={{ color: 'var(--accent-primary)' }} className="text-sm font-mono font-bold">
              http://{detectedIp}:{localPort}
            </div>
          </div>

          <button
            onClick={handleCopyUrl}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:opacity-80 text-xs font-bold shadow-2xs cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
