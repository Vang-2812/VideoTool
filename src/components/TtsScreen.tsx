import React, { useState, useEffect } from 'react';
import {
  Mic,
  Upload,
  Settings,
  Volume2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Info,
  Play,
  XCircle,
  Sparkles
} from 'lucide-react';
import { chunkTextForTTS } from '../utils/ttsChunker';
import {
  buildChirpVoiceName,
  migrateTtsProfile,
  normalizeTtsSettings
} from '../../shared/ttsConfig.js';

const MODELS = [
  { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (Preview)' },
  { id: 'gemini-2.5-flash-tts', label: 'Gemini 2.5 Flash TTS' },
  { id: 'gemini-2.5-pro-tts', label: 'Gemini 2.5 Pro TTS' }
];

const LANGUAGES = [
  {
    code: 'vi-VN',
    label: 'Tiếng Việt (Vietnamese)',
    voices: [
      // Giọng Nam
      { id: 'Charon', label: 'Charon (Giọng Nam trầm, Điềm đạm)', gender: 'male' },
      { id: 'Fenrir', label: 'Fenrir (Giọng Nam khỏe, Mạnh mẽ)', gender: 'male' },
      { id: 'Puck', label: 'Puck (Giọng Nam ấm, Tự nhiên)', gender: 'male' },
      { id: 'Algenib', label: 'Algenib (Giọng Nam trung)', gender: 'male' },
      { id: 'Alnilam', label: 'Alnilam (Giọng Nam trầm ấm)', gender: 'male' },
      { id: 'Orus', label: 'Orus (Giọng Nam dày)', gender: 'male' },
      { id: 'Achernar', label: 'Achernar (Giọng Nam dõng dạc)', gender: 'male' },
      { id: 'Iapetus', label: 'Iapetus (Giọng Nam nhẹ nhàng)', gender: 'male' },
      { id: 'Enceladus', label: 'Enceladus (Giọng Nam trẻ trung)', gender: 'male' },
      { id: 'Rasalgethi', label: 'Rasalgethi (Giọng Nam cuốn hút)', gender: 'male' },
      { id: 'Schedar', label: 'Schedar (Giọng Nam chững chạc)', gender: 'male' },
      { id: 'Umbriel', label: 'Umbriel (Giọng Nam ấm áp)', gender: 'male' },

      // Giọng Nữ
      { id: 'Aoede', label: 'Aoede (Giọng Nữ thanh, Truyền cảm)', gender: 'female' },
      { id: 'Kore', label: 'Kore (Giọng Nữ sáng, Trong trẻo)', gender: 'female' },
      { id: 'Callirrhoe', label: 'Callirrhoe (Giọng Nữ năng động)', gender: 'female' },
      { id: 'Leda', label: 'Leda (Giọng Nữ dịu dàng)', gender: 'female' },
      { id: 'Zephyr', label: 'Zephyr (Giọng Nữ êm dịu, Nhẹ nhàng)', gender: 'female' },
      { id: 'Autonoe', label: 'Autonoe (Giọng Nữ đầm ấm)', gender: 'female' },
      { id: 'Laomedeia', label: 'Laomedeia (Giọng Nữ tự tin)', gender: 'female' },
      { id: 'Despina', label: 'Despina (Giọng Nữ trẻ trung)', gender: 'female' },
      { id: 'Erinome', label: 'Erinome (Giọng Nữ thanh lịch)', gender: 'female' },
      { id: 'Achird', label: 'Achird (Giọng Nữ dễ thương)', gender: 'female' },
      { id: 'Algieba', label: 'Algieba (Giọng Nữ ấm áp)', gender: 'female' },
      { id: 'Pulcherrima', label: 'Pulcherrima (Giọng Nữ sang trọng)', gender: 'female' },
      { id: 'Sadachbia', label: 'Sadachbia (Giọng Nữ tinh tế)', gender: 'female' },
      { id: 'Sadaltager', label: 'Sadaltager (Giọng Nữ êm ái)', gender: 'female' },
      { id: 'Sulafat', label: 'Sulafat (Giọng Nữ thanh thoát)', gender: 'female' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (Giọng Nữ trưởng thành)', gender: 'female' }
    ]
  },
  {
    code: 'en-US',
    label: 'Tiếng Anh (English - US)',
    voices: [
      // Male Voices
      { id: 'Charon', label: 'Charon (Male - Deep & Calm)', gender: 'male' },
      { id: 'Fenrir', label: 'Fenrir (Male - Strong & Powerful)', gender: 'male' },
      { id: 'Puck', label: 'Puck (Male - Warm & Natural)', gender: 'male' },
      { id: 'Algenib', label: 'Algenib (Male - Balanced)', gender: 'male' },
      { id: 'Alnilam', label: 'Alnilam (Male - Deep & Warm)', gender: 'male' },
      { id: 'Orus', label: 'Orus (Male - Thick)', gender: 'male' },
      { id: 'Achernar', label: 'Achernar (Male - Authoritative)', gender: 'male' },
      { id: 'Iapetus', label: 'Iapetus (Male - Gentle)', gender: 'male' },
      { id: 'Enceladus', label: 'Enceladus (Male - Youthful)', gender: 'male' },
      { id: 'Rasalgethi', label: 'Rasalgethi (Male - Engaging)', gender: 'male' },
      { id: 'Schedar', label: 'Schedar (Male - Mature)', gender: 'male' },
      { id: 'Umbriel', label: 'Umbriel (Male - Friendly)', gender: 'male' },

      // Female Voices
      { id: 'Aoede', label: 'Aoede (Female - Clear & Expressive)', gender: 'female' },
      { id: 'Kore', label: 'Kore (Female - Bright & Crisp)', gender: 'female' },
      { id: 'Callirrhoe', label: 'Callirrhoe (Female - Energetic)', gender: 'female' },
      { id: 'Leda', label: 'Leda (Female - Gentle)', gender: 'female' },
      { id: 'Zephyr', label: 'Zephyr (Female - Soothing)', gender: 'female' },
      { id: 'Autonoe', label: 'Autonoe (Female - Warm)', gender: 'female' },
      { id: 'Laomedeia', label: 'Laomedeia (Female - Confident)', gender: 'female' },
      { id: 'Despina', label: 'Despina (Female - Young)', gender: 'female' },
      { id: 'Erinome', label: 'Erinome (Female - Elegant)', gender: 'female' },
      { id: 'Achird', label: 'Achird (Female - Sweet)', gender: 'female' },
      { id: 'Algieba', label: 'Algieba (Female - Warm)', gender: 'female' },
      { id: 'Pulcherrima', label: 'Pulcherrima (Female - Sophisticated)', gender: 'female' },
      { id: 'Sadachbia', label: 'Sadachbia (Female - Refined)', gender: 'female' },
      { id: 'Sadaltager', label: 'Sadaltager (Female - Smooth)', gender: 'female' },
      { id: 'Sulafat', label: 'Sulafat (Female - Graceful)', gender: 'female' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (Female - Mature)', gender: 'female' }
    ]
  },
  {
    code: 'en-GB',
    label: 'Tiếng Anh (English - UK)',
    voices: [
      // Male Voices
      { id: 'Charon', label: 'Charon (British Male - Deep & Calm)', gender: 'male' },
      { id: 'Fenrir', label: 'Fenrir (British Male - Strong & Powerful)', gender: 'male' },
      { id: 'Puck', label: 'Puck (British Male - Warm & Natural)', gender: 'male' },
      { id: 'Algenib', label: 'Algenib (British Male - Balanced)', gender: 'male' },
      { id: 'Alnilam', label: 'Alnilam (British Male - Deep & Warm)', gender: 'male' },
      { id: 'Orus', label: 'Orus (British Male - Thick)', gender: 'male' },
      { id: 'Achernar', label: 'Achernar (British Male - Authoritative)', gender: 'male' },
      { id: 'Iapetus', label: 'Iapetus (British Male - Gentle)', gender: 'male' },
      { id: 'Enceladus', label: 'Enceladus (British Male - Youthful)', gender: 'male' },
      { id: 'Rasalgethi', label: 'Rasalgethi (British Male - Engaging)', gender: 'male' },
      { id: 'Schedar', label: 'Schedar (British Male - Mature)', gender: 'male' },
      { id: 'Umbriel', label: 'Umbriel (British Male - Friendly)', gender: 'male' },

      // Female Voices
      { id: 'Aoede', label: 'Aoede (British Female - Clear & Expressive)', gender: 'female' },
      { id: 'Kore', label: 'Kore (British Female - Bright & Crisp)', gender: 'female' },
      { id: 'Callirrhoe', label: 'Callirrhoe (British Female - Energetic)', gender: 'female' },
      { id: 'Leda', label: 'Leda (British Female - Gentle)', gender: 'female' },
      { id: 'Zephyr', label: 'Zephyr (British Female - Soothing)', gender: 'female' },
      { id: 'Autonoe', label: 'Autonoe (British Female - Warm)', gender: 'female' },
      { id: 'Laomedeia', label: 'Laomedeia (British Female - Confident)', gender: 'female' },
      { id: 'Despina', label: 'Despina (British Female - Young)', gender: 'female' },
      { id: 'Erinome', label: 'Erinome (British Female - Elegant)', gender: 'female' },
      { id: 'Achird', label: 'Achird (British Female - Sweet)', gender: 'female' },
      { id: 'Algieba', label: 'Algieba (British Female - Warm)', gender: 'female' },
      { id: 'Pulcherrima', label: 'Pulcherrima (British Female - Sophisticated)', gender: 'female' },
      { id: 'Sadachbia', label: 'Sadachbia (British Female - Refined)', gender: 'female' },
      { id: 'Sadaltager', label: 'Sadaltager (British Female - Smooth)', gender: 'female' },
      { id: 'Sulafat', label: 'Sulafat (British Female - Graceful)', gender: 'female' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (British Female - Mature)', gender: 'female' }
    ]
  }
];

interface TtsProfile {
  id: string;
  name: string;
  mode: TtsMode;
  prompt: string;
  model: string;
  langCode: string;
  voiceName: string;
  speakingRate: number;
  outputFormat: 'wav' | 'mp3';
}

interface TtsScreenProps {
  onNavigateToAligner: (audioPath: string, scriptText: string) => void;
}

export default function TtsScreen({ onNavigateToAligner }: TtsScreenProps) {
  const initial = React.useMemo(() => normalizeTtsSettings({
    mode: localStorage.getItem('tts_mode') || undefined,
    languageCode: localStorage.getItem('tts_langCode') || undefined,
    speaker: localStorage.getItem('tts_voiceName') || undefined,
    speakingRate: localStorage.getItem('tts_speakingRate')
      ? Number(localStorage.getItem('tts_speakingRate'))
      : undefined,
    model: localStorage.getItem('tts_model') || undefined,
    prompt: localStorage.getItem('tts_prompt') || undefined,
    outputFormat: localStorage.getItem('tts_outputFormat') || undefined
  }), []);
  const [text, setText] = useState(() => localStorage.getItem('tts_text') || '');
  const [mode, setMode] = useState<TtsMode>(initial.mode);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [model, setModel] = useState(initial.model);
  const [langCode, setLangCode] = useState(initial.languageCode);
  const [voiceName, setVoiceName] = useState(initial.speaker);
  const [speakingRate, setSpeakingRate] = useState(initial.speakingRate);
  const [outputFormat, setOutputFormat] = useState<'wav' | 'mp3'>(initial.outputFormat);

  const [profiles, setProfiles] = useState<TtsProfile[]>(() => {
    const saved = localStorage.getItem('tts_profiles');
    if (saved) {
      try {
        return JSON.parse(saved).map((profile: Partial<TtsProfile>) => ({
          ...migrateTtsProfile(profile),
          outputFormat: profile.outputFormat ?? 'mp3'
        })) as TtsProfile[];
      } catch {
        // Fall through to the built-in profiles.
      }
    }
    return [
      {
        id: 'default',
        name: 'Mặc định (Default)',
        mode: 'stable',
        prompt: 'Read aloud in a warm, welcoming tone.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'en-US',
        voiceName: 'Charon',
        speakingRate: 1.0,
        outputFormat: 'mp3'
      },
      {
        id: 'deep-english-male',
        name: 'Giọng Nam trầm ấm (English)',
        mode: 'expressive',
        prompt: 'Read aloud in a deep, calm, and deliberate tone with clear articulation and natural pauses.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'en-US',
        voiceName: 'Alnilam',
        speakingRate: 1.1,
        outputFormat: 'mp3'
      },
      {
        id: 'warm-vietnamese-female',
        name: 'Giọng Nữ truyền cảm (Vietnamese)',
        mode: 'expressive',
        prompt: 'Đọc diễn cảm, ấm áp, truyền cảm hứng và tự nhiên.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'vi-VN',
        voiceName: 'Aoede',
        speakingRate: 1.0,
        outputFormat: 'mp3'
      }
    ];
  });

  const [selectedProfileId, setSelectedProfileId] = useState(() => {
    return localStorage.getItem('tts_selected_profile_id') || 'default';
  });

  // Persist profiles list
  useEffect(() => {
    localStorage.setItem('tts_profiles', JSON.stringify(profiles));
  }, [profiles]);

  // Persist selected profile ID
  useEffect(() => {
    localStorage.setItem('tts_selected_profile_id', selectedProfileId);
  }, [selectedProfileId]);

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    const prof = profiles.find(p => p.id === profileId);
    if (prof) {
      setMode(prof.mode);
      setPrompt(prof.prompt);
      setModel(prof.model);
      setLangCode(prof.langCode);
      setVoiceName(prof.voiceName);
      setSpeakingRate(prof.speakingRate);
      setOutputFormat(prof.outputFormat);
    }
  };

  const handleCreateProfile = () => {
    const name = window.prompt('Nhập tên cho Profile mới:');
    if (!name || !name.trim()) return;

    const newProfile: TtsProfile = {
      id: 'profile_' + Date.now(),
      name: name.trim(),
      mode,
      prompt,
      model,
      langCode,
      voiceName,
      speakingRate,
      outputFormat
    };

    setProfiles(prev => [...prev, newProfile]);
    setSelectedProfileId(newProfile.id);
    alert(`Đã tạo Profile "${newProfile.name}" thành công!`);
  };

  const handleUpdateProfile = () => {
    setProfiles(prev => prev.map(p => {
      if (p.id === selectedProfileId) {
        return {
          ...p,
          mode,
          prompt,
          model,
          langCode,
          voiceName,
          speakingRate,
          outputFormat
        };
      }
      return p;
    }));
    alert('Đã cập nhật thay đổi cho profile hiện tại!');
  };

  const handleDeleteProfile = () => {
    if (selectedProfileId === 'default' || selectedProfileId === 'deep-english-male' || selectedProfileId === 'warm-vietnamese-female') {
      alert('Không thể xóa các profile mẫu mặc định.');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa profile này không?')) return;

    const remaining = profiles.filter(p => p.id !== selectedProfileId);
    setProfiles(remaining);
    // Fallback to default
    setSelectedProfileId('default');
    const prof = remaining.find(p => p.id === 'default') || remaining[0];
    if (prof) {
      setMode(prof.mode);
      setPrompt(prof.prompt);
      setModel(prof.model);
      setLangCode(prof.langCode);
      setVoiceName(prof.voiceName);
      setSpeakingRate(prof.speakingRate);
      setOutputFormat(prof.outputFormat);
    }
  };

  // States
  const [googleAuthAvailable, setGoogleAuthAvailable] = useState(false);
  const [streamingAvailable, setStreamingAvailable] = useState(false);

  // Execution States
  const [loading, setLoading] = useState(false);
  const chunkProvider = mode === 'expressive'
    ? 'gemini'
    : streamingAvailable ? 'chirp-streaming' : 'cloud-rest';
  const chunks = React.useMemo(() => {
    try {
      return chunkTextForTTS(text, {
        provider: chunkProvider,
        languageCode: langCode,
        prompt: mode === 'expressive' ? prompt : undefined
      });
    } catch {
      return [];
    }
  }, [text, prompt, mode, langCode, chunkProvider]);

  const [result, setResult] = useState<TtsJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<TtsJobProgress | null>(null);
  const resultOutputFormat = result?.outputPath?.toLowerCase().endsWith('.wav')
    ? 'wav'
    : 'mp3';

  // Persist settings to localStorage on change
  useEffect(() => {
    localStorage.setItem('tts_text', text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem('tts_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('tts_prompt', prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem('tts_model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('tts_langCode', langCode);
  }, [langCode]);

  useEffect(() => {
    localStorage.setItem('tts_voiceName', voiceName);
  }, [voiceName]);

  useEffect(() => {
    localStorage.setItem('tts_speakingRate', speakingRate.toString());
  }, [speakingRate]);

  useEffect(() => {
    localStorage.setItem('tts_outputFormat', outputFormat);
  }, [outputFormat]);

  // Sync voice options when language changes
  useEffect(() => {
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (lang) {
      const isValid = lang.voices.some(v => v.id === voiceName);
      if (!isValid && lang.voices.length > 0) {
        setVoiceName(lang.voices[0].id);
      }
    }
  }, [langCode]);

  // Load key existence on mount
  useEffect(() => {
    void checkSetup();
  }, []);

  useEffect(() => window.electronAPI.onTtsJobProgress((payload) => {
    setJobProgress(payload);
  }), []);

  const checkSetup = async () => {
    try {
      const [oauth, credentials] = await Promise.all([
        window.electronAPI.getGoogleAuthStatus(),
        window.electronAPI.getGoogleCredentialsStatus()
      ]);
      const hasStreaming = credentials.status === 'valid';
      setStreamingAvailable(hasStreaming);
      setGoogleAuthAvailable(oauth.connected || hasStreaming);
    } catch (err) {
      console.error('Failed to check keys status:', err);
      setGoogleAuthAvailable(false);
      setStreamingAvailable(false);
    }
  };

  const handleImportTxt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setText(event.target?.result as string || '');
    };
    reader.readAsText(file);
    // Reset file input value so same file can be re-imported
    e.target.value = '';
  };



  const handleGenerate = async () => {
    if (!googleAuthAvailable) {
      setError('Chưa cấu hình Google Cloud OAuth hoặc service-account credentials.');
      return;
    }

    const basePath = await window.electronAPI.getTempPath();
    const outputPath = basePath.replace(/\.mp3$/i, `.${outputFormat}`);

    setLoading(true);
    setError(null);
    setResult(null);
    setJobProgress({
      phase: 'validating',
      progress: 0,
      engine: mode === 'stable' ? 'chirp-streaming' : 'gemini-rest'
    });

    try {
      const response = await window.electronAPI.synthesizeSpeech({
        mode,
        text,
        prompt: mode === 'expressive' ? prompt.trim() : undefined,
        modelName: mode === 'expressive' ? model : undefined,
        languageCode: langCode,
        speaker: voiceName,
        voiceName: mode === 'stable'
          ? buildChirpVoiceName(langCode, voiceName)
          : voiceName,
        speakingRate,
        outputPath,
        outputFormat
      });
      if (response.success) {
        setResult(response);
      } else if (!response.cancelled) {
        setError(response.error || 'Không thể tạo audio.');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tạo audio.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await window.electronAPI.cancelTtsJob();
  };

  const handleSaveAudio = async () => {
    if (!result?.outputPath) return;
    await window.electronAPI.saveFileFromTemp({
      sourcePath: result.outputPath,
      filterName: resultOutputFormat === 'wav' ? 'Audio WAV' : 'Audio MP3',
      extension: resultOutputFormat
    });
  };

  const handlePlayAudio = (filePath: string) => {
    window.electronAPI.playVideo(filePath);
  };

  const activeLanguage = LANGUAGES.find(l => l.code === langCode);
  const maleVoices = activeLanguage?.voices.filter(v => v.gender === 'male') || [];
  const femaleVoices = activeLanguage?.voices.filter(v => v.gender === 'female') || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 h-full items-start">

      {/* Left: Input Text and Configurations (3/5 cols) */}
      <div className="lg:col-span-3 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-5 signature-top-indicator">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
          <Mic className="w-4 h-4 text-primary" />
          Tạo Giọng Đọc (TTS)
        </h2>

        {/* Cấu hình mẫu (Profiles) */}
        <div className="bg-bg-dark border border-border-dark p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-accent" />
              Cấu hình mẫu (Profile)
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={handleUpdateProfile}
                title="Lưu đè cấu hình hiện tại vào Profile đang chọn"
                className="bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                Lưu đè
              </button>
              <button
                onClick={handleCreateProfile}
                title="Tạo Profile mới từ cấu hình đang hiển thị"
                className="bg-green-500/10 hover:bg-green-500/25 border border-green-500/20 hover:border-green-500/45 text-green-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                Tạo mới
              </button>
              {selectedProfileId !== 'default' && selectedProfileId !== 'deep-english-male' && selectedProfileId !== 'warm-vietnamese-female' && (
                <button
                  onClick={handleDeleteProfile}
                  title="Xóa Profile này khỏi bộ nhớ"
                  className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/45 text-red-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
          <select
            value={selectedProfileId}
            onChange={(e) => handleSelectProfile(e.target.value)}
            className="w-full bg-bg-panel border border-border-dark text-white rounded-lg px-2.5 py-2 text-xs outline-none focus:border-primary cursor-pointer"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Stable is the default; Gemini remains available as experimental. */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('stable')}
              aria-pressed={mode === 'stable'}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${mode === 'stable' ? 'bg-primary/20 border-primary/50 text-primary-light' : 'bg-bg-dark border-border-dark text-gray-500 hover:text-gray-300'}`}
            >
              Stable
            </button>
            <button
              onClick={() => setMode('expressive')}
              aria-pressed={mode === 'expressive'}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${mode === 'expressive' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-bg-dark border-border-dark text-gray-500 hover:text-gray-300'}`}
            >
              Expressive / Experimental
            </button>
          </div>

          {mode === 'stable' ? (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-[11px] text-gray-400 space-y-1">
              <div>Model: <span className="text-white">Chirp 3 HD</span></div>
              <div>Voice: <span className="text-white font-mono">{buildChirpVoiceName(langCode, voiceName)}</span></div>
              <div>{streamingAvailable ? 'Streaming cùng một voice session.' : 'Chirp REST với fallback toàn-job sang Neural2.'}</div>
            </div>
          ) : (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-[11px] text-yellow-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Experimental: giọng có thể thay đổi nhẹ giữa các lần chạy hoặc phân đoạn.
            </div>
          )}
        </div>

        {/* Text Area Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400">Văn bản thuyết minh (Script)</label>
            <label className="bg-bg-card hover:bg-bg-dark border border-border-dark hover:border-gray-500 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Import từ file .txt
              <input
                type="file"
                accept=".txt"
                onChange={handleImportTxt}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            placeholder="Nhập văn bản cần tạo giọng đọc ở đây..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white p-4 rounded-xl text-xs min-h-[160px] outline-none transition-colors font-sans leading-relaxed"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{text.length} ký tự</span>
            <span>{text.split(/\s+/).filter(Boolean).length} từ</span>
          </div>

          {/* Provider-aware chunk preview; execution remains one Main-process job. */}
          {chunks.length > 0 && (
            <div className="bg-bg-dark border border-border-dark p-3 rounded-lg mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  Danh sách phân đoạn ({chunks.length} đoạn)
                </span>
                {chunks.length > 1 && (
                  <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                    {mode === 'stable' && streamingAvailable
                      ? 'Streaming cùng một voice session'
                      : 'Ghép PCM lossless'}
                  </span>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="text-[10px] bg-bg-panel p-2 rounded border border-border-dark flex flex-col gap-1">
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-mono w-5 shrink-0">#{chunk.id}</span>
                      <div className="flex-1 text-gray-300 line-clamp-2" title={chunk.text}>
                        {chunk.text}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="font-mono text-gray-500">
                          {chunk.byteCount}b
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {mode === 'expressive' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-gray-400 block">Model Gemini</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-primary"
              >
                {MODELS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-gray-400 block">Style instructions</span>
              <input
                type="text"
                placeholder="Read aloud in a warm, welcoming tone."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none"
              />
            </label>
          </div>
        )}

        {/* Dropdowns row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500">Ngôn ngữ</span>
            <select
              value={langCode}
              onChange={(e) => setLangCode(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-500">Giọng đọc</span>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {maleVoices.length > 0 && (
                <optgroup label="👨 Giọng Nam / Male Voices" className="text-gray-400 bg-bg-panel font-bold">
                  {maleVoices.map(v => (
                    <option key={v.id} value={v.id} className="text-white bg-bg-dark font-normal">👨 {v.label}</option>
                  ))}
                </optgroup>
              )}
              {femaleVoices.length > 0 && (
                <optgroup label="👩 Giọng Nữ / Female Voices" className="text-gray-400 bg-bg-panel font-bold">
                  {femaleVoices.map(v => (
                    <option key={v.id} value={v.id} className="text-white bg-bg-dark font-normal">👩 {v.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 flex justify-between items-center">
              <span>Tốc độ</span>
              <span className="text-primary font-bold text-xs">{speakingRate}x</span>
            </span>
            <div className="flex items-center h-8">
              <input
                type="range"
                min="0.25"
                max="2.0"
                step="0.05"
                value={speakingRate}
                onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                className="w-full custom-slider cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-500">Định dạng</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as 'wav' | 'mp3')}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="mp3">MP3 · 256 kbps</option>
              <option value="wav">WAV · Lossless PCM</option>
            </select>
          </div>
        </div>

        {loading && jobProgress && (
          <div className="bg-bg-dark border border-border-dark rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-300 capitalize">{jobProgress.phase} · {jobProgress.engine}</span>
              <span className="text-primary font-mono">{jobProgress.progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${jobProgress.progress}%` }}
              />
            </div>
            {jobProgress.message && (
              <p className="text-[10px] text-yellow-400">{jobProgress.message}</p>
            )}
          </div>
        )}

        {/* Job-level actions */}
        <div className="border-t border-border-dark pt-4 flex justify-end items-center">
          <div className="flex gap-2">
            {loading && (
              <button
                onClick={handleCancel}
                className="px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
              >
                <XCircle className="w-4 h-4" />
                Hủy
              </button>
            )}
            <button
              disabled={!text.trim() || loading || !googleAuthAvailable}
              onClick={handleGenerate}
              className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${!text.trim() || loading || !googleAuthAvailable ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo audio...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  {result ? 'Tạo lại từ đầu' : 'Tạo giọng đọc (TTS)'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Key warnings */}
        {!googleAuthAvailable && (
          <div className="bg-red-950/20 border border-red-500/15 text-red-400 text-xs p-4 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
            <span>
              <strong>Cảnh báo:</strong> Chưa cấu hình Google Cloud OAuth hoặc service-account credentials. Vui lòng mở Cài đặt trước khi tổng hợp giọng nói.
            </span>
          </div>
        )}

      </div>

      {/* Right: Results & Guide Card (2/5 cols) */}
      <div className="lg:col-span-2 space-y-6">

        {/* Default Guide Card when no output yet */}
        {!result && !error && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 signature-top-indicator">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border-dark pb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Hướng Dẫn & Xem Trước Output
            </h3>
            <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
              <div className="bg-bg-dark border border-border-dark p-3.5 rounded-xl space-y-2">
                <span className="font-semibold text-white block">1. Chọn Chế độ & Giọng đọc</span>
                <p className="text-[11px]">Chế độ <strong>Stable (Chirp 3 HD)</strong> phù hợp cho đọc truyện, văn bản dài với âm thanh tự nhiên nhất.</p>
              </div>
              <div className="bg-bg-dark border border-border-dark p-3.5 rounded-xl space-y-2">
                <span className="font-semibold text-white block">2. Tùy chỉnh Tốc độ & Định dạng</span>
                <p className="text-[11px]">Xuất ra tệp <strong>MP3 (256 kbps)</strong> cho dung lượng gọn nhẹ hoặc <strong>WAV (Lossless PCM)</strong> cho chất lượng tốt nhất.</p>
              </div>
              <div className="bg-bg-dark border border-border-dark p-3.5 rounded-xl space-y-2">
                <span className="font-semibold text-white block">3. Chuyển tiếp sang Tạo phụ đề</span>
                <p className="text-[11px]">Sau khi tạo audio xong, bấm nút <em>"Tạo phụ đề từ Audio này"</em> để tự động tạo file phụ đề SRT khớp 100%.</p>
              </div>
            </div>
          </div>
        )}

        {/* Results output */}
        {(result || error) && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-250 signature-top-indicator">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border-dark pb-2">
              Kết quả xuất (Output)
            </h3>

            {error && (
              <div className="bg-red-950/20 border border-red-500/10 text-red-400 text-xs p-4 rounded-xl flex items-start gap-2">
                <XCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/15 text-green-400 text-xs p-4 rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-green-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Đã tạo tệp thuyết minh thành công!</span>
                    <span className="text-[10px] text-gray-400 block mt-1">Sẵn sàng lưu hoặc chuyển tiếp phụ đề</span>
                  </div>
                </div>

                {/* File list links */}
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Tệp âm thanh (Voiceover {resultOutputFormat.toUpperCase()})</span>
                    <span className="text-white select-all break-all block bg-bg-dark border border-border-dark/60 p-2 rounded-lg mt-1">{result.outputPath}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2 space-y-1 font-sans">
                    <div>Engine: <span className="text-white font-mono">{result.engine}</span></div>
                    <div>Model: <span className="text-white font-mono">{result.modelName}</span></div>
                    <div>Voice: <span className="text-white font-mono">{result.voiceName}</span></div>
                    {result.fallbackReason && (
                      <div className="text-yellow-400">Fallback: {result.fallbackReason}</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => result.outputPath && handlePlayAudio(result.outputPath)}
                      className="py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Nghe thử
                    </button>
                    <button
                      onClick={handleSaveAudio}
                      className="py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Lưu {resultOutputFormat.toUpperCase()}
                    </button>
                  </div>

                  <button
                    onClick={() => result.outputPath && onNavigateToAligner(result.outputPath, text)}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-accent/25 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Tạo phụ đề từ Audio này
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
