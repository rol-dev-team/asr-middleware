import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { audioApi } from '../services/api';

function MeetingList() {
  const { user } = useAuth();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioBlobRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  const streamsRef = useRef([]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Update timer display
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

  const handleStartMeeting = () => {
    if (!meetingTitle.trim()) {
      setError('Please enter a meeting title');
      return;
    }
    setShowRecorder(true);
    setError(null);
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Step 1: Request system audio capture first (tab/window/screen audio)
      let systemStream = null;
      let systemAudioTrack = null;
      
      try {
        // Request display media with audio - user will select tab/window/screen
        systemStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: { ideal: 1 },
            height: { ideal: 1 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000
          }
        });
        
        // Get the audio track
        systemAudioTrack = systemStream.getAudioTracks()[0];
        
        if (systemAudioTrack) {
          console.log('System audio captured:', systemAudioTrack.label);
          systemAudioTrack.enabled = true;
        } else {
          console.log('No system audio track available');
          // Stop video track if audio is not available
          systemStream.getVideoTracks().forEach(track => track.stop());
          systemStream = null;
        }
      } catch (displayErr) {
        console.log('System audio capture cancelled or not available:', displayErr.message);
        systemStream = null;
      }
      
      // Step 2: Get microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });
      
      const micAudioTrack = micStream.getAudioTracks()[0];
      if (micAudioTrack) {
        console.log('Microphone captured:', micAudioTrack.label);
        micAudioTrack.enabled = true;
      }
      
      // Store all streams for cleanup
      streamsRef.current = [micStream];
      if (systemStream) {
        streamsRef.current.push(systemStream);
      }
      
      // Step 3: Create audio context and mix streams
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      audioContextRef.current = audioContext;
      
      const destination = audioContext.createMediaStreamDestination();
      
      // Create microphone source with gain control
      const micSource = audioContext.createMediaStreamSource(micStream);
      const micGain = audioContext.createGain();
      micGain.gain.value = 1.5; // Boost microphone slightly
      micSource.connect(micGain);
      micGain.connect(destination);
      
      // If we have system audio, mix it in
      if (systemStream && systemAudioTrack) {
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        const systemGain = audioContext.createGain();
        systemGain.gain.value = 1.2; // Boost system audio
        systemSource.connect(systemGain);
        systemGain.connect(destination);
        
        setHasSystemAudio(true);
        console.log('Mixed stream created with both microphone and system audio');
      } else {
        setHasSystemAudio(false);
        console.log('Recording with microphone only');
      }
      
      setHasMicrophone(true);
      const finalStream = destination.stream;
      
      // Log track information
      finalStream.getAudioTracks().forEach(track => {
        console.log('Final stream track:', track.label, 'enabled:', track.enabled, 'muted:', track.muted);
      });
      
      // Determine the best MIME type for recording
      let mimeType;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else {
        mimeType = 'audio/ogg';
      }
      
      console.log('Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(finalStream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        } else {
          console.warn('Empty audio chunk received');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, total chunks:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          console.error('No audio data was recorded!');
          setError('Recording failed: No audio data captured. Please try again.');
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Audio blob created:', audioBlob.size, 'bytes', 'type:', mimeType);
        
        if (audioBlob.size === 0) {
          console.error('Audio blob is empty!');
          setError('Recording failed: Audio file is empty. Please try again.');
          return;
        }
        
        audioBlobRef.current = audioBlob;
        
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        // Stop all tracks and cleanup
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => {
            console.log('Stopping track:', track.label);
            track.stop();
          });
        });
        streamsRef.current = [];
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Reset audio source states
        setHasMicrophone(false);
        setHasSystemAudio(false);
      };

      // Start recording without timeslice to collect all data when stopped
      mediaRecorder.start();
      console.log('MediaRecorder started with state:', mediaRecorder.state);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      setRecordingTime(0);
      
    } catch (err) {
      console.error('Error accessing audio:', err);
      setError(`Failed to access audio: ${err.message}. Please grant microphone permission and select audio when sharing screen/tab.`);
      
      // Cleanup on error
      streamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streamsRef.current = [];
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resume recording
        mediaRecorderRef.current.resume();
        startTimeRef.current = Date.now() - (recordingTime * 1000);
        setIsPaused(false);
      } else {
        // Pause recording
        mediaRecorderRef.current.pause();
        pausedTimeRef.current += Date.now() - startTimeRef.current - (recordingTime * 1000);
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      const recorder = mediaRecorderRef.current;
      
      // Request any remaining data before stopping
      if (recorder.state === 'recording') {
        console.log('Requesting final data before stop...');
        recorder.requestData();
      }
      
      // Small delay to ensure data is flushed, then stop
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          console.log('Stopping recorder...');
          recorder.stop();
        }
      }, 100);
      
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Cleanup will happen in onstop handler
    }
  };

  const uploadToServer = async () => {
    if (!audioBlobRef.current) {
      setError('No audio file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create a File object from the blob
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = audioBlobRef.current.type.includes('webm') ? 'webm' : 'ogg';
      const fileName = `${meetingTitle.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
      const audioFile = new File([audioBlobRef.current], fileName, { 
        type: audioBlobRef.current.type
      });

      // Automated workflow: Transcribe → Translate → Analyze
      console.log('Starting complete audio processing workflow...');
      const result = await audioApi.processAudioComplete(audioFile, meetingTitle, true);
      
      console.log('Complete workflow finished!');
      console.log('- Transcription ID:', result.transcription.id);
      console.log('- Translation ID:', result.translation.id);
      console.log('- Analysis ID:', result.analysis.id);
      
      setUploadSuccess(true);
      setError(null);
    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process audio. Please try again.');
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const downloadAudio = () => {
    if (!audioBlobRef.current) return;
    
    const url = URL.createObjectURL(audioBlobRef.current);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = audioBlobRef.current.type.includes('webm') ? 'webm' : 'ogg';
    a.download = `${meetingTitle.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const resetRecording = () => {
    // Cleanup any active streams
    streamsRef.current.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    streamsRef.current = [];
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioURL(null);
    setRecordingTime(0);
    setUploadSuccess(false);
    setShowRecorder(false);
    setMeetingTitle('');
    setHasMicrophone(false);
    setHasSystemAudio(false);
    audioBlobRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showRecorder) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <span className="text-6xl mb-4 inline-block">🎙️</span>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Start a New Meeting</h1>
              <p className="text-gray-600">Enter a title for your meeting and start recording</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="meetingTitle" className="block text-sm font-medium text-gray-700 mb-2">
                Meeting Title *
              </label>
              <input
                id="meetingTitle"
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g., Team Standup, Client Meeting..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleStartMeeting();
                  }
                }}
              />
            </div>

            {user && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Recording as:</span> {user.username}
                  {user.full_name && ` (${user.full_name})`}
                </p>
              </div>
            )}

            <button
              onClick={handleStartMeeting}
              className="w-full px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
            >
              Continue to Recording
            </button>

            <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> You'll be asked for microphone permission when you start recording. 
                The audio will be securely uploaded to the server for transcription and analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={resetRecording}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {meetingTitle}
          </h1>
          <p className="text-gray-600 mb-6">Recording audio for this meeting</p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
            <span className="flex items-center gap-1">
              📅 {new Date().toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              🕐 {new Date().toLocaleTimeString()}
            </span>
            {user && (
              <span className="flex items-center gap-1">
                👤 {user.username}
              </span>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Audio Sources Indicator */}
          {isRecording && (
            <div className="mb-6 flex gap-2 justify-center flex-wrap">
              {hasMicrophone && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                  🎤 Microphone Active
                </span>
              )}
              {hasSystemAudio && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  🔊 System Audio Active
                </span>
              )}
            </div>
          )}

          {/* Recording Status */}
          <div className="mb-8 text-center">
            {isRecording ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full">
                    <span className={`w-3 h-3 rounded-full bg-red-600 ${isPaused ? '' : 'animate-pulse'}`}></span>
                    <span className="text-red-700 font-medium">
                      {isPaused ? 'Paused' : 'Recording'}
                    </span>
                  </div>
                </div>
                <div className="text-4xl font-mono font-bold text-gray-900">
                  {formatTime(recordingTime)}
                </div>
              </>
            ) : audioURL ? (
              <>
                {uploading && (
                  <div className="text-blue-600 font-medium mb-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p>Processing audio: Transcribe → Translate → Analyze...</p>
                  </div>
                )}
                {uploadSuccess && !uploading && (
                  <div className="text-green-600 font-medium mb-4">
                    ✓ Complete! Audio transcribed, translated, and analyzed successfully!
                  </div>
                )}
                {!uploading && !uploadSuccess && (
                  <div className="text-gray-600 font-medium mb-4">
                    Recording saved. Ready to process.
                  </div>
                )}
                <div className="text-2xl font-mono font-bold text-gray-700 mb-2">
                  Duration: {formatTime(recordingTime)}
                </div>
              </>
            ) : (
              <div className="text-gray-500 mb-4">
                Ready to record
              </div>
            )}
          </div>

          {/* Audio Player */}
          {audioURL && !isRecording && (
            <div className="mb-6">
              <audio controls src={audioURL} className="w-full" />
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 justify-center flex-wrap">
            {!isRecording && !audioURL && (
              <button
                onClick={startRecording}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🎙️ Start Recording
              </button>
            )}

            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  ⏹️ Stop Recording
                </button>
              </>
            )}

            {audioURL && !isRecording && (
              <>
                {!uploadSuccess && (
                  <button
                    onClick={uploadToServer}
                    disabled={uploading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Processing...' : '📤 Process Audio'}
                  </button>
                )}
                <button
                  onClick={downloadAudio}
                  disabled={uploading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Download
                </button>
                <button
                  onClick={resetRecording}
                  disabled={uploading}
                  className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 New Meeting
                </button>
              </>
            )}
          </div>

          {/* Recording Info */}
          {!isRecording && !audioURL && (
            <div className="mt-8 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>📋 Recording Instructions:</strong>
                </p>
                <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                  <li><strong>First prompt:</strong> Select which tab/window/screen to capture audio from (choose "Share audio" option)</li>
                  <li><strong>Second prompt:</strong> Allow microphone access to capture your voice</li>
                  <li>Both audio sources will be mixed automatically for a complete recording</li>
                </ol>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Tip:</strong> To capture meeting audio, share the tab where your meeting is running and make sure "Share audio" is checked!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingList;
