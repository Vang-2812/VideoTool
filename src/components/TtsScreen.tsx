import React, { useState, useEffect } from 'react';
import {
  Mic,
  Upload,
  Settings,
  Volume2,
  FileText,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Info,
  ExternalLink,
  Play,
  XCircle
} from 'lucide-react';
import { chunkTextForTTS } from '../utils/ttsChunker';

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
      { id: 'Charon', label: 'Charon (Giọng Nam trầm, Điềm đạm)' },
      { id: 'Fenrir', label: 'Fenrir (Giọng Nam khỏe, Mạnh mẽ)' },
      { id: 'Puck', label: 'Puck (Giọng Nam ấm, Tự nhiên)' },
      { id: 'Algenib', label: 'Algenib (Giọng Nam trung)' },
      { id: 'Alnilam', label: 'Alnilam (Giọng Nam trầm ấm)' },
      { id: 'Orus', label: 'Orus (Giọng Nam dày)' },
      { id: 'Achernar', label: 'Achernar (Giọng Nam dõng dạc)' },
      { id: 'Iapetus', label: 'Iapetus (Giọng Nam nhẹ nhàng)' },
      { id: 'Enceladus', label: 'Enceladus (Giọng Nam trẻ trung)' },
      { id: 'Rasalgethi', label: 'Rasalgethi (Giọng Nam cuốn hút)' },
      { id: 'Schedar', label: 'Schedar (Giọng Nam chững chạc)' },
      { id: 'Umbriel', label: 'Umbriel (Giọng Nam ấm áp)' },

      // Giọng Nữ
      { id: 'Aoede', label: 'Aoede (Giọng Nữ thanh, Truyền cảm)' },
      { id: 'Kore', label: 'Kore (Giọng Nữ sáng, Trong trẻo)' },
      { id: 'Callirrhoe', label: 'Callirrhoe (Giọng Nữ năng động)' },
      { id: 'Leda', label: 'Leda (Giọng Nữ dịu dàng)' },
      { id: 'Zephyr', label: 'Zephyr (Giọng Nữ êm dịu, Nhẹ nhàng)' },
      { id: 'Autonoe', label: 'Autonoe (Giọng Nữ đầm ấm)' },
      { id: 'Laomedeia', label: 'Laomedeia (Giọng Nữ tự tin)' },
      { id: 'Despina', label: 'Despina (Giọng Nữ trẻ trung)' },
      { id: 'Erinome', label: 'Erinome (Giọng Nữ thanh lịch)' },
      { id: 'Achird', label: 'Achird (Giọng Nữ dễ thương)' },
      { id: 'Algieba', label: 'Algieba (Giọng Nữ ấm áp)' },
      { id: 'Pulcherrima', label: 'Pulcherrima (Giọng Nữ sang trọng)' },
      { id: 'Sadachbia', label: 'Sadachbia (Giọng Nữ tinh tế)' },
      { id: 'Sadaltager', label: 'Sadaltager (Giọng Nữ êm ái)' },
      { id: 'Sulafat', label: 'Sulafat (Giọng Nữ thanh thoát)' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (Giọng Nữ trưởng thành)' }
    ]
  },
  {
    code: 'en-US',
    label: 'Tiếng Anh (English - US)',
    voices: [
      // Male Voices
      { id: 'Charon', label: 'Charon (Male - Deep & Calm)' },
      { id: 'Fenrir', label: 'Fenrir (Male - Strong & Powerful)' },
      { id: 'Puck', label: 'Puck (Male - Warm & Natural)' },
      { id: 'Algenib', label: 'Algenib (Male - Balanced)' },
      { id: 'Alnilam', label: 'Alnilam (Male - Deep & Warm)' },
      { id: 'Orus', label: 'Orus (Male - Thick)' },
      { id: 'Achernar', label: 'Achernar (Male - Authoritative)' },
      { id: 'Iapetus', label: 'Iapetus (Male - Gentle)' },
      { id: 'Enceladus', label: 'Enceladus (Male - Youthful)' },
      { id: 'Rasalgethi', label: 'Rasalgethi (Male - Engaging)' },
      { id: 'Schedar', label: 'Schedar (Male - Mature)' },
      { id: 'Umbriel', label: 'Umbriel (Male - Friendly)' },

      // Female Voices
      { id: 'Aoede', label: 'Aoede (Female - Clear & Expressive)' },
      { id: 'Kore', label: 'Kore (Female - Bright & Crisp)' },
      { id: 'Callirrhoe', label: 'Callirrhoe (Female - Energetic)' },
      { id: 'Leda', label: 'Leda (Female - Gentle)' },
      { id: 'Zephyr', label: 'Zephyr (Female - Soothing)' },
      { id: 'Autonoe', label: 'Autonoe (Female - Warm)' },
      { id: 'Laomedeia', label: 'Laomedeia (Female - Confident)' },
      { id: 'Despina', label: 'Despina (Female - Young)' },
      { id: 'Erinome', label: 'Erinome (Female - Elegant)' },
      { id: 'Achird', label: 'Achird (Female - Sweet)' },
      { id: 'Algieba', label: 'Algieba (Female - Warm)' },
      { id: 'Pulcherrima', label: 'Pulcherrima (Female - Sophisticated)' },
      { id: 'Sadachbia', label: 'Sadachbia (Female - Refined)' },
      { id: 'Sadaltager', label: 'Sadaltager (Female - Smooth)' },
      { id: 'Sulafat', label: 'Sulafat (Female - Graceful)' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (Female - Mature)' }
    ]
  },
  {
    code: 'en-GB',
    label: 'Tiếng Anh (English - UK)',
    voices: [
      // Male Voices
      { id: 'Charon', label: 'Charon (British Male - Deep & Calm)' },
      { id: 'Fenrir', label: 'Fenrir (British Male - Strong & Powerful)' },
      { id: 'Puck', label: 'Puck (British Male - Warm & Natural)' },
      { id: 'Algenib', label: 'Algenib (British Male - Balanced)' },
      { id: 'Alnilam', label: 'Alnilam (British Male - Deep & Warm)' },
      { id: 'Orus', label: 'Orus (British Male - Thick)' },
      { id: 'Achernar', label: 'Achernar (British Male - Authoritative)' },
      { id: 'Iapetus', label: 'Iapetus (British Male - Gentle)' },
      { id: 'Enceladus', label: 'Enceladus (British Male - Youthful)' },
      { id: 'Rasalgethi', label: 'Rasalgethi (British Male - Engaging)' },
      { id: 'Schedar', label: 'Schedar (British Male - Mature)' },
      { id: 'Umbriel', label: 'Umbriel (British Male - Friendly)' },

      // Female Voices
      { id: 'Aoede', label: 'Aoede (British Female - Clear & Expressive)' },
      { id: 'Kore', label: 'Kore (British Female - Bright & Crisp)' },
      { id: 'Callirrhoe', label: 'Callirrhoe (British Female - Energetic)' },
      { id: 'Leda', label: 'Leda (British Female - Gentle)' },
      { id: 'Zephyr', label: 'Zephyr (British Female - Soothing)' },
      { id: 'Autonoe', label: 'Autonoe (British Female - Warm)' },
      { id: 'Laomedeia', label: 'Laomedeia (British Female - Confident)' },
      { id: 'Despina', label: 'Despina (British Female - Young)' },
      { id: 'Erinome', label: 'Erinome (British Female - Elegant)' },
      { id: 'Achird', label: 'Achird (British Female - Sweet)' },
      { id: 'Algieba', label: 'Algieba (British Female - Warm)' },
      { id: 'Pulcherrima', label: 'Pulcherrima (British Female - Sophisticated)' },
      { id: 'Sadachbia', label: 'Sadachbia (British Female - Refined)' },
      { id: 'Sadaltager', label: 'Sadaltager (British Female - Smooth)' },
      { id: 'Sulafat', label: 'Sulafat (British Female - Graceful)' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix (British Female - Mature)' }
    ]
  }
];

interface TtsProfile {
  id: string;
  name: string;
  prompt: string;
  model: string;
  langCode: string;
  voiceName: string;
  speakingRate: number;
}

interface TtsScreenProps {
  onNavigateToAligner: (audioPath: string, scriptText: string) => void;
}

export default function TtsScreen({ onNavigateToAligner }: TtsScreenProps) {
  const [text, setText] = useState(() => localStorage.getItem('tts_text') || '');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('tts_prompt') || 'Read aloud in a warm, welcoming tone.');
  const [model, setModel] = useState(() => localStorage.getItem('tts_model') || 'gemini-3.1-flash-tts-preview');
  const [langCode, setLangCode] = useState(() => localStorage.getItem('tts_langCode') || 'vi-VN');
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem('tts_voiceName') || 'Charon');
  const [speakingRate, setSpeakingRate] = useState(() => {
    const saved = localStorage.getItem('tts_speakingRate');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [profiles, setProfiles] = useState<TtsProfile[]>(() => {
    const saved = localStorage.getItem('tts_profiles');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'default',
        name: 'Mặc định (Default)',
        prompt: 'Read aloud in a warm, welcoming tone.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'vi-VN',
        voiceName: 'Charon',
        speakingRate: 1.0
      },
      {
        id: 'deep-english-male',
        name: 'Giọng Nam trầm ấm (English)',
        prompt: 'Read aloud in a deep, calm, and deliberate tone with clear articulation and natural pauses.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'en-US',
        voiceName: 'Alnilam',
        speakingRate: 1.1
      },
      {
        id: 'warm-vietnamese-female',
        name: 'Giọng Nữ truyền cảm (Vietnamese)',
        prompt: 'Đọc diễn cảm, ấm áp, truyền cảm hứng và tự nhiên.',
        model: 'gemini-3.1-flash-tts-preview',
        langCode: 'vi-VN',
        voiceName: 'Aoede',
        speakingRate: 1.0
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
      setPrompt(prof.prompt);
      setModel(prof.model);
      setLangCode(prof.langCode);
      setVoiceName(prof.voiceName);
      setSpeakingRate(prof.speakingRate);
    }
  };

  const handleCreateProfile = () => {
    const name = window.prompt('Nhập tên cho Profile mới:');
    if (!name || !name.trim()) return;

    const newProfile: TtsProfile = {
      id: 'profile_' + Date.now(),
      name: name.trim(),
      prompt,
      model,
      langCode,
      voiceName,
      speakingRate
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
          prompt,
          model,
          langCode,
          voiceName,
          speakingRate
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
      setPrompt(prof.prompt);
      setModel(prof.model);
      setLangCode(prof.langCode);
      setVoiceName(prof.voiceName);
      setSpeakingRate(prof.speakingRate);
    }
  };

  // States
  const [googleKeyExists, setGoogleKeyExists] = useState(false);

  // Execution States
  const [loading, setLoading] = useState(false);
  // Chunking
  const chunks = React.useMemo(() => {
    return chunkTextForTTS(text, prompt);
  }, [text, prompt]);

  // Phase B: Execution States
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeChunks, setActiveChunks] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [savePathState, setSavePathState] = useState('');

  // Persist settings to localStorage on change
  useEffect(() => {
    localStorage.setItem('tts_text', text);
  }, [text]);

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
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const gRes = await window.electronAPI.getApiKey('google');
      setGoogleKeyExists(!!(gRes.success && gRes.key));
    } catch (err) {
      console.error('Failed to check keys status:', err);
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



  const processChunks = async (chunksToProcess: any[], finalSavePath: string) => {
    setIsGenerating(true);
    let allSuccess = true;
    const newActiveChunks = [...chunksToProcess];

    for (let i = 0; i < newActiveChunks.length; i++) {
      if (newActiveChunks[i].status === 'success') continue;

      setCurrentChunkIndex(i);
      newActiveChunks[i].status = 'pending';
      setActiveChunks([...newActiveChunks]);

      const tempPath = newActiveChunks.length === 1
        ? finalSavePath
        : finalSavePath.replace(/\.mp3$/i, `_chunk_${newActiveChunks[i].id}.mp3`);

      let success = false;
      let errorMsg = '';

      // Auto-retry up to 2 times (total 3 tries)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const params = {
            text: newActiveChunks[i].text,
            prompt: prompt.trim(),
            model,
            languageCode: langCode,
            voiceName,
            speakingRate,
            outputPath: tempPath
          };
          const res = await window.electronAPI.synthesizeSpeech(params);
          if (res.success) {
            success = true;
            newActiveChunks[i].audioPath = tempPath;
            break;
          } else {
            errorMsg = res.error || 'Lỗi không xác định';
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000)); // delay before retry
          }
        } catch (err: any) {
          errorMsg = err.message;
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (success) {
        newActiveChunks[i].status = 'success';
      } else {
        newActiveChunks[i].status = 'error';
        newActiveChunks[i].errorMsg = errorMsg;
        allSuccess = false;
        setActiveChunks([...newActiveChunks]);
        break; // Dừng lại ở chunk lỗi
      }
      setActiveChunks([...newActiveChunks]);
    }

    if (allSuccess) {
      // PHASE C: Ghép audio
      setIsGenerating(false);
      setLoading(true);

      try {
        const tempPaths = newActiveChunks.map(c => c.audioPath).filter(Boolean);
        const concatRes = await window.electronAPI.concatAudioOnly({
          tempPaths,
          finalOutputPath: finalSavePath
        });

        if (concatRes.success) {
          setResult({ mp3Path: concatRes.audioPath });
        } else {
          setError(concatRes.error || 'Lỗi ghép file audio.');
        }
      } catch (e: any) {
        setError(e.message || 'Lỗi hệ thống khi ghép audio.');
      }
    }

    setIsGenerating(false);
    setCurrentChunkIndex(-1);
  };

  const handleGenerate = async () => {
    if (!googleKeyExists) {
      alert('Chưa cấu hình API Key Google Cloud TTS. Vui lòng cấu hình trong phần Cài đặt.');
      return;
    }

    const savePath = await window.electronAPI.getTempPath();

    setLoading(true);
    setError(null);
    setResult(null);
    setSavePathState(savePath);

    const initialChunks = chunks.map(c => ({ ...c }));
    setActiveChunks(initialChunks);

    await processChunks(initialChunks, savePath);
    setLoading(false);
  };

  const handleRetry = async () => {
    if (!savePathState) return;
    setLoading(true);
    await processChunks(activeChunks, savePathState);
    setLoading(false);
  };

  const handleSaveMp3 = async () => {
    if (!result?.mp3Path) return;
    await window.electronAPI.saveFileFromTemp({
      sourcePath: result.mp3Path,
      filterName: 'Audio MP3',
      extension: 'mp3'
    });
  };



  const handleOpenFolder = (filePath: string) => {
    window.electronAPI.openDirectory(filePath);
  };

  const handlePlayAudio = (filePath: string) => {
    window.electronAPI.playVideo(filePath);
  };

  const activeLanguage = LANGUAGES.find(l => l.code === langCode);
  const maleVoices = activeLanguage?.voices.filter(v => v.label.startsWith('👨')) || [];
  const femaleVoices = activeLanguage?.voices.filter(v => v.label.startsWith('👩')) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 h-full items-start">

      {/* Left: Input Text and Configurations (3/5 cols) */}
      <div className="lg:col-span-3 bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-5">
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

          {/* Chunking Preview or Execution Progress (v1.5.1) */}
          {(activeChunks.length > 0 ? activeChunks : chunks).length > 0 && (
            <div className="bg-bg-dark border border-border-dark p-3 rounded-lg mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  Danh sách phân đoạn ({(activeChunks.length > 0 ? activeChunks : chunks).length} đoạn)
                </span>
                {(activeChunks.length > 0 ? activeChunks : chunks).length > 1 && (
                  <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                    Sẽ được ghép tự động (Crossfade)
                  </span>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {(activeChunks.length > 0 ? activeChunks : chunks).map((chunk, idx) => (
                  <div key={chunk.id} className="text-[10px] bg-bg-panel p-2 rounded border border-border-dark flex flex-col gap-1">
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-mono w-5 shrink-0">#{chunk.id}</span>
                      <div className="flex-1 text-gray-300 line-clamp-2" title={chunk.text}>
                        {chunk.text}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className={`font-mono ${chunk.byteCount > 7000 ? 'text-yellow-500' : 'text-gray-500'}`}>
                          {chunk.byteCount}b
                        </span>
                        {chunk.status === 'success' && <span className="text-green-400 font-bold bg-green-900/30 px-1 py-0.5 rounded border border-green-500/20">Thành công</span>}
                        {chunk.status === 'error' && <span className="text-red-400 font-bold bg-red-900/30 px-1 py-0.5 rounded border border-red-500/20">Lỗi API</span>}
                        {chunk.status === 'pending' && currentChunkIndex === idx && <span className="text-accent animate-pulse">Đang tạo...</span>}
                        {chunk.status === 'pending' && currentChunkIndex !== idx && activeChunks.length > 0 && <span className="text-gray-500">Chờ xử lý</span>}

                        {chunk.isHardCut && (
                          <span className="bg-red-900/50 text-red-400 px-1 py-0.5 rounded-[4px] text-[8px] border border-red-500/30" title="Đoạn này bị cắt cứng do một câu quá dài vượt giới hạn.">
                            Hard Cut
                          </span>
                        )}
                      </div>
                    </div>
                    {chunk.errorMsg && (
                      <div className="text-red-400 text-[9px] mt-1 bg-red-950 p-1.5 rounded border border-red-500/20">
                        {chunk.errorMsg}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Style instructions prompt */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400">Style instructions (Prompt giọng đọc)</label>
          <input
            type="text"
            placeholder="Ví dụ: Read aloud in a warm, welcoming tone."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none"
          />
          <span className="text-[10px] text-gray-500">Mẹo: Điều khiển tốc độ, tông giọng đọc (Gemini-TTS).</span>
        </div>

        {/* Dropdowns row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

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
                <optgroup label="Giọng Nam / Male Voices" className="text-gray-400 bg-bg-panel font-bold">
                  {maleVoices.map(v => (
                    <option key={v.id} value={v.id} className="text-white bg-bg-dark font-normal">{v.label}</option>
                  ))}
                </optgroup>
              )}
              {femaleVoices.length > 0 && (
                <optgroup label="Giọng Nữ / Female Voices" className="text-gray-400 bg-bg-panel font-bold">
                  {femaleVoices.map(v => (
                    <option key={v.id} value={v.id} className="text-white bg-bg-dark font-normal">{v.label}</option>
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
                min="0.55"
                max="2.0"
                step="0.05"
                value={speakingRate}
                onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                className="w-full accent-primary bg-bg-dark h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="border-t border-border-dark pt-4 flex justify-end items-center">
          <div className="flex gap-2">
            {activeChunks.some(c => c.status === 'error') && !loading && (
              <button
                onClick={handleRetry}
                className="px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
              >
                Thử lại đoạn lỗi
              </button>
            )}
            <button
              disabled={!text.trim() || loading || !googleKeyExists}
              onClick={handleGenerate}
              className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${!text.trim() || loading || !googleKeyExists ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isGenerating ? `Đang tạo đoạn ${currentChunkIndex + 1}/${activeChunks.length}...` : 'Đang ghép file...'}
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  {activeChunks.length > 0 && activeChunks.every(c => c.status === 'success') ? 'Tạo lại từ đầu' : 'Tạo giọng đọc (TTS)'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Key warnings */}
        {!googleKeyExists && (
          <div className="bg-red-950/20 border border-red-500/15 text-red-400 text-xs p-4 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
            <span>
              <strong>Cảnh báo:</strong> Google Cloud API Key chưa được cài đặt. Vui lòng vào màn hình **Cài đặt** để nhập khóa API trước khi thực hiện tổng hợp giọng nói.
            </span>
          </div>
        )}

      </div>

      {/* Right: Results (2/5 cols) */}
      <div className="lg:col-span-2 space-y-6">

        {/* Results output */}
        {(result || error) && (
          <div className="bg-bg-panel border border-border-dark p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-250">
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
                    <span className="text-gray-500 block text-[10px]">Tệp âm thanh (Voiceover MP3)</span>
                    <span className="text-white select-all break-all block bg-bg-dark border border-border-dark/60 p-2 rounded-lg mt-1">{result.mp3Path}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePlayAudio(result.mp3Path)}
                      className="py-2.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/45 text-primary-light text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Nghe thử
                    </button>
                    <button
                      onClick={handleSaveMp3}
                      className="py-2.5 bg-bg-card hover:bg-bg-dark border border-border-dark text-gray-300 hover:text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Lưu MP3
                    </button>
                  </div>

                  <button
                    onClick={() => onNavigateToAligner(result.mp3Path, text)}
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
