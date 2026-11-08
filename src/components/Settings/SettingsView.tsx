import React, { useState } from 'react';
import { UserSettings } from '../../types/chess';
import { sounds } from '../../services/sound';
import { COACH_PERSONAS, coachVoice } from '../../services/coachPersona';
import {
  Key,
  Shield,
  Check,
  Eye,
  EyeOff,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  ExternalLink,
  Trash2,
} from 'lucide-react';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [formState, setFormState] = useState<UserSettings>(settings);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = (updated?: Partial<UserSettings>) => {
    const toSave = { ...formState, ...updated };
    setFormState(toSave);
    onUpdateSettings(toSave);
    sounds.setEnabled(toSave.soundEnabled);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });

    try {
      const res = await fetch('/api/coach/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formState.aiProvider,
          apiKey: formState.customApiKey || undefined,
          endpoint: formState.customEndpoint || undefined,
          model: formState.customModel || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestStatus({
          loading: false,
          success: true,
          message: `Connection verified! (${data.provider} / ${data.model})`,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: data.error || 'Connection failed',
        });
      }
    } catch (e: unknown) {
      setTestStatus({
        loading: false,
        success: false,
        message: e instanceof Error ? e.message : 'Network error testing API connection',
      });
    }
  };

  const handleRemoveKey = () => {
    const updated = {
      ...formState,
      customApiKey: '',
    };
    setFormState(updated);
    onUpdateSettings(updated);
    setTestStatus({ loading: false });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-xs text-zinc-400">
          Configure your AI Coach LLM providers, board themes, and gameplay preferences.
        </p>
      </div>

      {/* SECTION 4: AI API KEY SETTINGS */}
      <div className="p-6 rounded-2xl bg-[#141519] border border-zinc-800 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Coach Provider & Key</h2>
            <p className="text-xs text-zinc-400">
              Select your preferred LLM provider for post-game tactical explanations.
            </p>
          </div>
        </div>

        {/* Provider Radio Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormState({ ...formState, aiProvider: 'gemini' })}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              formState.aiProvider === 'gemini'
                ? 'bg-emerald-600/15 border-emerald-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Built-in Gemini Coach</span>
              {formState.aiProvider === 'gemini' && (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <span className="text-[11px] text-zinc-400">
              Powered by server-side Gemini 3.8 Flash. Zero configuration needed out-of-the-box.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFormState({ ...formState, aiProvider: 'openai_compatible' })}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              formState.aiProvider === 'openai_compatible'
                ? 'bg-emerald-600/15 border-emerald-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Custom OpenAI-Compatible API</span>
              {formState.aiProvider === 'openai_compatible' && (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <span className="text-[11px] text-zinc-400">
              Bring your own OpenAI, DeepSeek, OpenRouter, or local proxy endpoint and key.
            </span>
          </button>
        </div>

        {/* Custom API Credentials Form */}
        {formState.aiProvider === 'openai_compatible' ? (
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={formState.customEndpoint}
                onChange={(e) => setFormState({ ...formState, customEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={formState.customApiKey}
                  onChange={(e) => setFormState({ ...formState, customApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={formState.customModel}
                onChange={(e) => setFormState({ ...formState, customModel: e.target.value })}
                placeholder="gpt-4o-mini, gpt-4o, deepseek-chat"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Optional Custom Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={formState.customApiKey}
                  onChange={(e) => setFormState({ ...formState, customApiKey: e.target.value })}
                  placeholder="AIzaSy... (leave blank to use system key)"
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Connection Button & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus.loading}
              className="py-2 px-4 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {testStatus.loading ? 'Testing...' : 'Test API Connection'}
            </button>

            {formState.customApiKey && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="py-2 px-3 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Key</span>
              </button>
            )}
          </div>

          {testStatus.message && (
            <div
              className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                testStatus.success
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Security & Offline Notice */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Security Architecture & Engine Independence</span>
          </div>
          <p className="leading-relaxed">
            API keys are passed securely to your backend proxy and are never exposed in browser bundles or logged.
            The Stockfish chess engine runs locally in your browser and works completely offline even with no API key configured.
          </p>
        </div>
      </div>

      {/* SECTION: VIRTUAL COACH PERSONAS & AVATARS */}
      <div className="p-6 rounded-2xl bg-[#141519] border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Virtual Coach Personas & Voice</h2>
              <p className="text-xs text-zinc-400">
                Choose your AI companion persona, speaking voice style, and real-time guidance behavior.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const currentPersona = formState.coachPersona || 'nolan';
              coachVoice.speak(
                `Hello! I am your AI chess coach. Ready to elevate your game together?`,
                currentPersona
              );
            }}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Voice</span>
          </button>
        </div>

        {/* Coach Personas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COACH_PERSONAS.map((persona) => {
            const isSelected = (formState.coachPersona || 'nolan') === persona.id;
            return (
              <div
                key={persona.id}
                onClick={() => handleSave({ coachPersona: persona.id })}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/20 border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${persona.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                      >
                        {persona.badge}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">{persona.name}</span>
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {persona.badge}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-medium">
                          {persona.title}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {persona.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] italic text-zinc-500 truncate max-w-[190px]">
                    {persona.tagline}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      coachVoice.speak(
                        `Hi, I'm ${persona.name}. ${persona.tagline}`,
                        persona.id
                      );
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                    title={`Hear ${persona.name}'s voice`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coach Preferences Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 transition-colors">
            <input
              type="checkbox"
              checked={formState.playCoachEnabled}
              onChange={(e) => handleSave({ playCoachEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 bg-zinc-800 border-zinc-700"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">
                Play Coach Mode (Real-Time Companion)
              </span>
              <span className="text-[11px] text-zinc-400">
                Live move advice, tiered hints, and encouragement during live matches.
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 transition-colors">
            <input
              type="checkbox"
              checked={formState.coachVoiceEnabled}
              onChange={(e) => {
                const isEnabled = e.target.checked;
                coachVoice.setEnabled(isEnabled);
                handleSave({ coachVoiceEnabled: isEnabled });
              }}
              className="w-4 h-4 rounded text-emerald-600 bg-zinc-800 border-zinc-700"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">
                Coach Voice Narration (Web Speech API)
              </span>
              <span className="text-[11px] text-zinc-400">
                Speaks tactical tips, move classifications, and blunder warnings out loud.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Board & Audio Preferences */}
      <div className="p-6 rounded-2xl bg-[#141519] border border-zinc-800 space-y-6">
        <h2 className="text-sm font-bold text-white">Board & Audio Preferences</h2>

        {/* Theme Selector */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-2">
            Chessboard Theme
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { id: 'emerald', label: 'Classic Emerald', light: '#ebecd0', dark: '#779952' },
                { id: 'charcoal', label: 'Dark Charcoal', light: '#71717a', dark: '#3f3f46' },
                { id: 'wood', label: 'Natural Wood', light: '#f0d9b5', dark: '#b58863' },
                { id: 'ocean', label: 'Ocean Blue', light: '#dae3ed', dark: '#587ca8' },
              ] as const
            ).map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => handleSave({ boardTheme: th.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                  formState.boardTheme === th.id
                    ? 'border-emerald-500 bg-emerald-950/15 ring-1 ring-emerald-500/50'
                    : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850'
                }`}
              >
                <div className="w-full h-8 rounded grid grid-cols-4 overflow-hidden border border-black/20">
                  <div style={{ backgroundColor: th.light }} />
                  <div style={{ backgroundColor: th.dark }} />
                  <div style={{ backgroundColor: th.light }} />
                  <div style={{ backgroundColor: th.dark }} />
                </div>
                <span className="text-xs font-medium text-zinc-200">{th.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.soundEnabled}
              onChange={(e) => handleSave({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 bg-zinc-900 border-zinc-700"
            />
            <span className="text-xs text-zinc-300">Sound Effects (Web Audio)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.showCoordinates}
              onChange={(e) => handleSave({ showCoordinates: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 bg-zinc-900 border-zinc-700"
            />
            <span className="text-xs text-zinc-300">Rank & File Coordinates</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.highlightLegalMoves}
              onChange={(e) => handleSave({ highlightLegalMoves: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 bg-zinc-900 border-zinc-700"
            />
            <span className="text-xs text-zinc-300">Highlight Legal Moves</span>
          </label>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Settings saved
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSave()}
            className="py-2.5 px-6 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
