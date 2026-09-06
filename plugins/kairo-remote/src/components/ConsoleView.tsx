import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Send, Trash2, ChevronUp, ChevronDown, Copy, CheckCircle } from 'lucide-react';
import { ThemeMode } from '../types';

interface ConsoleEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  timestamp: Date;
  error?: string;
}

interface ConsoleViewProps {
  pin: string;
  theme?: ThemeMode;
}

const QUICK_COMMANDS = [
  { label: 'IP / Réseau', cmd: 'ipconfig' },
  { label: 'Processus', cmd: 'tasklist' },
  { label: 'Version OS', cmd: 'ver' },
  { label: 'Hostname', cmd: 'hostname' },
  { label: 'Qui suis-je ?', cmd: 'whoami' },
  { label: 'Ports ouverts', cmd: 'netstat -an' },
  { label: 'Statut Git', cmd: 'git status' },
  { label: 'Echo test', cmd: 'echo KaïroOS Console OK' },
];

export const ConsoleView: React.FC<ConsoleViewProps> = ({ pin, theme }) => {
  const isDark = theme === 'dark';
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ConsoleEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setLoading(true);
    const id = `${Date.now()}-${Math.random()}`;
    try {
      const res = await fetch('/api/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Kairo-Pin': pin },
        body: JSON.stringify({ command: trimmed }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setHistory(prev => [...prev, {
          id, command: trimmed, stdout: json.data.stdout || '',
          stderr: json.data.stderr || '', exit_code: json.data.exit_code ?? 0, timestamp: new Date(),
        }]);
      } else {
        setHistory(prev => [...prev, {
          id, command: trimmed, stdout: '', stderr: '', exit_code: -1,
          timestamp: new Date(), error: json.error || 'Erreur inconnue',
        }]);
      }
      setCmdHistory(prev => [trimmed, ...prev.filter(c => c !== trimmed)].slice(0, 50));
      setCmdHistoryIdx(-1);
    } catch (e: any) {
      setHistory(prev => [...prev, {
        id, command: trimmed, stdout: '', stderr: '', exit_code: -1,
        timestamp: new Date(), error: e.message || 'Erreur réseau',
      }]);
    } finally {
      setLoading(false);
      setInput('');
      inputRef.current?.focus();
    }
  }, [pin]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); executeCommand(input); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(cmdHistoryIdx + 1, cmdHistory.length - 1);
      setCmdHistoryIdx(idx); setInput(cmdHistory[idx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(cmdHistoryIdx - 1, -1);
      setCmdHistoryIdx(idx); setInput(idx === -1 ? '' : cmdHistory[idx]);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700"><Terminal className="w-5 h-5" /></div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Console Admin</h2>
          <p className="text-xs text-slate-500">Commandes à distance • Sécurisé par PIN</p>
        </div>
        <button onClick={() => setHistory([])}
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Vider</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_COMMANDS.map(qc => (
          <button key={qc.cmd} onClick={() => executeCommand(qc.cmd)} disabled={loading}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 transition-colors disabled:opacity-50">
            {qc.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs space-y-3">
        {history.length === 0 && (
          <div className="text-slate-500 text-center py-8 select-none">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Console prête — tapez une commande ou utilisez les raccourcis ci-dessus</p>
          </div>
        )}
        {history.map(entry => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="text-slate-500 text-[10px]">{fmt(entry.timestamp)}</span>
              <span className="text-emerald-500">$</span>
              <span className="flex-1 text-emerald-300">{entry.command}</span>
              <button onClick={() => copyToClipboard(entry.stdout || entry.error || '', entry.id)}
                className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
                {copied === entry.id ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            {entry.error && <pre className="text-red-400 whitespace-pre-wrap break-all pl-4 border-l-2 border-red-800">⚠ {entry.error}</pre>}
            {entry.stdout && <pre className="text-slate-200 whitespace-pre-wrap break-all pl-4 border-l-2 border-slate-700">{entry.stdout}</pre>}
            {entry.stderr && <pre className="text-amber-400 whitespace-pre-wrap break-all pl-4 border-l-2 border-amber-800">{entry.stderr}</pre>}
            {!entry.error && entry.exit_code !== 0 && <div className="text-red-500 text-[10px] pl-4">↳ exit code {entry.exit_code}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <span className="text-emerald-500 font-mono text-sm select-none">$</span>
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown} placeholder="Saisissez une commande… (↑↓ historique)"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none font-mono"
            disabled={loading} autoComplete="off" spellCheck={false} />
          {cmdHistory.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <button onClick={() => { const i = Math.min(cmdHistoryIdx+1, cmdHistory.length-1); setCmdHistoryIdx(i); setInput(cmdHistory[i]||''); }}
                className="text-slate-400 hover:text-slate-600"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={() => { const i = Math.max(cmdHistoryIdx-1,-1); setCmdHistoryIdx(i); setInput(i===-1?'':cmdHistory[i]); }}
                className="text-slate-400 hover:text-slate-600"><ChevronDown className="w-3 h-3" /></button>
            </div>
          )}
        </div>
        <button onClick={() => executeCommand(input)} disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 flex items-center gap-1.5">
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
