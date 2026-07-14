import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export default function MockVideoPlayer() {
  const { files, totalDuration, voiceAudio, voiceVolume } = useProject();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const isPlayingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Stop playing and reload audio when timeline files change
  useEffect(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      try {
        audioRef.current.load(); // Force reload audio source to clear any error state
      } catch (e) {
        console.warn('Failed to load audio on reset', e);
      }
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [files]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      // Restart if at end
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
      
      if (audioRef.current) {
        let vol = 1.0;
        if (voiceVolume < 0) {
           vol = Math.pow(10, voiceVolume / 20); // standard dB to linear
        }
        audioRef.current.volume = Math.max(0, Math.min(1, vol));
        audioRef.current.play().catch(e => console.warn('Mock audio play failed', e));
      }
      
      lastUpdateRef.current = performance.now();
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  };

  // Animation Loop for smooth progress
  const updateProgress = (timestamp: number) => {
    if (!isPlayingRef.current) return;
    
    // If we have audio, sync with audio time for better precision
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.currentTime >= totalDuration || audioRef.current.ended) {
        handleEnd();
        return;
      }
    } else {
      // Manual time calculation if no audio
      const delta = (timestamp - lastUpdateRef.current) / 1000;
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= totalDuration) {
          handleEnd();
          return totalDuration;
        }
        return next;
      });
      lastUpdateRef.current = timestamp;
    }
    
    animationRef.current = requestAnimationFrame(updateProgress);
  };

  const handleEnd = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Determine which image to show based on currentTime
  // files are assumed to be sorted by startTime
  const currentFile = [...files].reverse().find(f => currentTime >= f.startTime) || files[0];

  // Helper to format mm:ss.ms
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-bg-panel border border-border-dark rounded-2xl overflow-hidden shadow-lg flex flex-col md:flex-row h-[300px] shrink-0">
      
      {/* Video Display Area */}
      <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden h-[200px] md:h-full group">
        {currentFile ? (
          <img 
            src={`media://${encodeURIComponent(currentFile.path)}`} 
            alt="Preview" 
            className="w-full h-full object-contain transition-opacity duration-200" 
          />
        ) : (
          <div className="text-gray-500 font-mono">No images</div>
        )}
        
        {/* Play overlay when paused */}
        {!isPlaying && (
          <div key="play-overlay" className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity cursor-pointer" onClick={togglePlay}>
             <div className="w-16 h-16 rounded-full bg-primary/80 text-white flex items-center justify-center backdrop-blur-sm shadow-xl hover:scale-110 transition-transform">
               <Play className="w-8 h-8 ml-1" />
             </div>
          </div>
        )}

        {/* Audio Element */}
        {voiceAudio && (
          <audio 
            key="voice-audio"
            ref={audioRef} 
            src={`media://${encodeURIComponent(voiceAudio.path)}`} 
            muted={isMuted}
            preload="auto"
          />
        )}
      </div>

      {/* Controls Sidebar */}
      <div className="w-full md:w-64 bg-bg-card p-4 flex flex-col justify-between border-l border-border-dark">
        <div>
          <h3 className="text-sm font-bold text-white mb-2 border-b border-border-dark pb-2">Video Preview</h3>
          <div className="text-[10px] text-gray-400 font-mono mb-4">
            Hiển thị ảnh tĩnh và phát âm thanh. Không bao gồm các hiệu ứng chuyển cảnh (transitions) hay Ken Burns.
          </div>
          
          <div className="flex items-center justify-center text-xl font-mono text-primary-light font-bold py-2 bg-bg-dark rounded-xl border border-border-dark shadow-inner mb-4">
            {formatTime(currentTime)} <span className="text-gray-600 mx-2">/</span> {formatTime(totalDuration)}
          </div>
          
          <div className="space-y-1">
             <input 
               type="range" 
               min="0" 
               max={totalDuration} 
               step="0.1"
               value={currentTime}
               onChange={handleSeek}
               className="w-full accent-primary h-1.5 bg-bg-dark rounded-lg appearance-none cursor-pointer"
             />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button 
            onClick={togglePlay}
            className="flex-1 py-2 bg-primary hover:bg-primary-light text-bg-dark font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Tạm dừng' : 'Phát thử'}
          </button>
          
          {voiceAudio && (
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 border border-border-dark bg-bg-dark hover:bg-border-dark/50 text-gray-300 rounded-xl transition-colors"
              title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
