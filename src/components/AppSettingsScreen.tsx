import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Info,
  Server
} from 'lucide-react';

export default function AppSettingsScreen() {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [streamingCredentials, setStreamingCredentials] = useState<GoogleCredentialsStatus>({
    status: 'not-configured',
    path: ''
  });
  const [checkingCredentials, setCheckingCredentials] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiInput, setOpenaiInput] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [savingOpenai, setSavingOpenai] = useState(false);

  // Load keys on mount
  useEffect(() => {
    void Promise.all([
      loadKeys(),
      loadGoogleAuthStatus(),
      loadStreamingCredentials()
    ]);
  }, []);

  const loadKeys = async () => {
    try {
      const oRes = await window.electronAPI.getApiKey('openai');
      if (oRes.success && oRes.key) {
        setOpenaiKey(oRes.key);
        setOpenaiInput(oRes.key);
      } else {
        setOpenaiKey('');
        setOpenaiInput('');
      }
    } catch (err) {
      console.error('Failed to load keys:', err);
    }
  };

  const loadGoogleAuthStatus = async () => {
    try {
      const status = await window.electronAPI.getGoogleAuthStatus();
      setGoogleConnected(status.connected);
    } catch (err) {
      console.error('Failed to load Google OAuth status:', err);
      setGoogleConnected(false);
    }
  };

  const loadStreamingCredentials = async () => {
    try {
      setStreamingCredentials(
        await window.electronAPI.getGoogleCredentialsStatus()
      );
    } catch (err) {
      console.error('Failed to load streaming credentials:', err);
      setStreamingCredentials({
        status: 'invalid',
        path: '',
        error: 'Không thể kiểm tra credentials.'
      });
    }
  };

  const handleLoginGoogle = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert("Vui lòng nhập Client ID và Client Secret trước.");
      return;
    }
    setSavingGoogle(true);
    try {
      // Frontend will call a new IPC method to start OAuth flow
      const res = await window.electronAPI.startGoogleOAuth(clientId.trim(), clientSecret.trim());
      if (res.success) {
        await loadGoogleAuthStatus();
        alert('Đã kết nối và lưu thông tin xác thực Google Cloud thành công.');
      } else {
        alert('Lỗi đăng nhập: ' + res.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleDeleteGoogle = async () => {
    if (!window.confirm('Anh có chắc muốn xóa kết nối Google Cloud không?')) return;
    try {
      const res = await window.electronAPI.deleteApiKey('google');
      if (res.success) {
        setGoogleConnected(false);
        setClientId('');
        setClientSecret('');
        alert('Đã xóa kết nối Google Cloud.');
      }
    } catch (err: any) {
      alert('Lỗi khi xóa: ' + err.message);
    }
  };

  const handleSelectStreamingCredentials = async () => {
    setCheckingCredentials(true);
    try {
      setStreamingCredentials(
        await window.electronAPI.selectGoogleCredentialsFile()
      );
    } catch (err: any) {
      setStreamingCredentials((current) => ({
        ...current,
        status: 'invalid',
        error: err.message || 'Không thể chọn credentials JSON.'
      }));
    } finally {
      setCheckingCredentials(false);
    }
  };

  const handleClearStreamingCredentials = async () => {
    await window.electronAPI.clearGoogleCredentials();
    setStreamingCredentials({ status: 'not-configured', path: '' });
  };

  const handleValidateStreamingCredentials = async () => {
    setCheckingCredentials(true);
    try {
      setStreamingCredentials(
        await window.electronAPI.validateGoogleCredentials()
      );
    } finally {
      setCheckingCredentials(false);
    }
  };

  const handleSaveOpenai = async () => {
    if (!openaiInput.trim()) return;
    setSavingOpenai(true);
    try {
      const res = await window.electronAPI.saveApiKey('openai', openaiInput.trim());
      if (res.success) {
        setOpenaiKey(openaiInput.trim());
        alert('Đã lưu API Key OpenAI thành công (Đã mã hóa).');
      } else {
        alert('Lỗi khi lưu API Key: ' + res.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingOpenai(false);
    }
  };

  const handleDeleteOpenai = async () => {
    if (!window.confirm('Anh có chắc muốn xóa khóa API OpenAI không?')) return;
    try {
      const res = await window.electronAPI.deleteApiKey('openai');
      if (res.success) {
        setOpenaiKey('');
        setOpenaiInput('');
        alert('Đã xóa khóa API OpenAI.');
      }
    } catch (err: any) {
      alert('Lỗi khi xóa: ' + err.message);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return '••••••••••••' + key.slice(-4);
  };

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-4">
      
      {/* Title Header */}
      <div className="bg-bg-panel border border-border-dark p-5 rounded-2xl shadow-lg signature-top-indicator">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          Cài đặt Khóa API (API Key Management)
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Quản lý các khóa dịch vụ tích hợp cho module Text-to-Speech (TTS) và tạo phụ đề tự động. Các khóa được mã hóa cục bộ an toàn ở tầng hệ điều hành.
        </p>
      </div>

      {/* 2-Column Grid Layout (Zero-Scroll) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Left Column: 1. Google Cloud OAuth 2.0 Desktop Flow */}
        <div className="bg-bg-panel border border-border-dark p-5 rounded-2xl shadow-lg space-y-4 signature-top-indicator">
          <div className="flex justify-between items-start gap-4 border-b border-border-dark pb-2">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Google Cloud OAuth 2.0</h3>
              <p className="text-[11px] text-gray-500">Bắt buộc cho Vertex AI. Cần Client ID và Client Secret.</p>
            </div>
            
            {googleConnected ? (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green-500/10 border border-green-500/15 text-green-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã kết nối
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/10 border border-red-500/15 text-red-400 flex items-center gap-1 shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
                Chưa kết nối
              </span>
            )}
          </div>

          {/* Input area */}
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400 font-semibold">Client ID</label>
              <input
                type="text"
                placeholder="Nhập OAuth 2.0 Client ID..."
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white px-3 py-2 rounded-xl text-xs outline-none font-mono"
              />
            </div>

            <div className="space-y-1 relative">
              <label className="text-[11px] text-gray-400 font-semibold">Client Secret</label>
              <input
                type={showClientSecret ? 'text' : 'password'}
                placeholder="Nhập Client Secret..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white pl-3 pr-10 py-2 rounded-xl text-xs outline-none font-mono"
              />
              {clientSecret && (
                <button
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-3 top-[26px] text-gray-500 hover:text-white"
                >
                  {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-dark/60">
              {googleConnected && (
                <button
                  onClick={handleDeleteGoogle}
                  className="px-3 py-2 bg-bg-card hover:bg-red-950/20 border border-border-dark hover:border-red-900 text-gray-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Xóa Kết Nối"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ngắt kết nối
                </button>
              )}
              
              <button
                disabled={!clientId || !clientSecret || savingGoogle}
                onClick={handleLoginGoogle}
                className={`px-5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${!clientId || !clientSecret || savingGoogle ? 'bg-gray-800 text-gray-600 border border-transparent' : 'bg-primary hover:bg-primary-hover text-white'}`}
              >
                <Save className="w-3.5 h-3.5" />
                {savingGoogle ? 'Đang mở trình duyệt...' : 'Đăng nhập Google'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 2. Chirp Credentials & 3. OpenAI Key */}
        <div className="space-y-4">

          {/* 2. Chirp Streaming Credentials */}
          <div className="bg-bg-panel border border-border-dark p-5 rounded-2xl shadow-lg space-y-3 signature-top-indicator">
            <div className="flex justify-between items-start gap-4 border-b border-border-dark pb-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Chirp Streaming Credentials
                </h3>
                <p className="text-[11px] text-gray-500">
                  Tùy chọn service-account JSON cho Chirp 3 HD.
                </p>
              </div>

              {streamingCredentials.status === 'valid' ? (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green-500/10 border border-green-500/15 text-green-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Hợp lệ
                </span>
              ) : streamingCredentials.status === 'invalid' ? (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/10 border border-red-500/15 text-red-400 flex items-center gap-1 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Không hợp lệ
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-bg-dark border border-border-dark text-gray-500 flex items-center gap-1 shrink-0">
                  <Info className="w-3.5 h-3.5" />
                  Chưa cấu hình
                </span>
              )}
            </div>

            <div className="bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-[10px] font-mono break-all text-gray-300">
              {streamingCredentials.path || 'Chưa chọn service-account JSON'}
            </div>

            {streamingCredentials.error && (
              <p className="text-[10px] text-red-400 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {streamingCredentials.error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              {streamingCredentials.path && (
                <button
                  onClick={handleClearStreamingCredentials}
                  className="px-3 py-1.5 bg-bg-card hover:bg-red-950/20 border border-border-dark hover:border-red-900 text-gray-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa
                </button>
              )}
              <button
                disabled={checkingCredentials}
                onClick={handleSelectStreamingCredentials}
                className="px-4 py-1.5 rounded-xl font-semibold text-xs bg-primary hover:bg-primary-hover text-white cursor-pointer transition-colors disabled:bg-gray-800 disabled:text-gray-600"
              >
                {checkingCredentials ? 'Đang kiểm tra...' : 'Chọn JSON Credentials'}
              </button>
            </div>
          </div>

          {/* 3. OpenAI API Key */}
          <div className="bg-bg-panel border border-border-dark p-5 rounded-2xl shadow-lg space-y-3 signature-top-indicator">
            <div className="flex justify-between items-start gap-4 border-b border-border-dark pb-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">OpenAI API Key (Tùy chọn)</h3>
                <p className="text-[11px] text-gray-500">Sử dụng OpenAI Whisper Cloud API thay thế.</p>
              </div>
              
              {openaiKey ? (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green-500/10 border border-green-500/15 text-green-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã cấu hình
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-bg-dark border border-border-dark text-gray-500 flex items-center gap-1 shrink-0">
                  <Info className="w-3.5 h-3.5" />
                  Whisper Local
                </span>
              )}
            </div>

            {/* Input area */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  type={showOpenai ? 'text' : 'password'}
                  placeholder={openaiKey ? maskKey(openaiKey) : 'Nhập OpenAI API Key...'}
                  value={openaiInput}
                  onChange={(e) => setOpenaiInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-dark focus:border-primary text-white pl-9 pr-9 py-2 rounded-xl text-xs outline-none font-mono"
                />
                {openaiInput && (
                  <button
                    onClick={() => setShowOpenai(!showOpenai)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                  >
                    {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <button
                disabled={!openaiInput || savingOpenai}
                onClick={handleSaveOpenai}
                className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${!openaiInput || savingOpenai ? 'bg-gray-800 text-gray-600 border border-transparent' : 'bg-primary hover:bg-primary-hover text-white'}`}
              >
                <Save className="w-3.5 h-3.5" />
                {savingOpenai ? 'Đang lưu...' : 'Lưu'}
              </button>

              {openaiKey && (
                <button
                  onClick={handleDeleteOpenai}
                  className="p-2 bg-bg-card hover:bg-red-950/20 border border-border-dark hover:border-red-900 text-gray-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                  title="Xóa API Key"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
