import { useState, useRef, useEffect } from 'react';
import { audioApi } from '../services/api';

function MeetingRecorder({ meeting, onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioBlobRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(
          'Failed to access audio: Cannot read properties of undefined (reading \'getUserMedia\'). ' +
          'Please ensure the page is served over HTTPS. ' +
          'If you\'re on a VM, make sure to use HTTPS or access via secure connection. ' +
          'Your browser may also not support media recording.'
        );
        return;
      }

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        setError(
          'Audio recording requires a secure context (HTTPS). ' +
          'Please access this page via HTTPS or localhost.'
        );
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder with appropriate MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Chunk received:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          setError('Recording failed: No audio data captured');
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Blob created:', audioBlob.size, 'bytes');
        
        if (audioBlob.size === 0) {
          setError('Recording failed: Audio file is empty');
          return;
        }
        
        audioBlobRef.current = audioBlob;
        
        // Convert to MP3 (Note: Direct MP3 encoding requires a library like lamejs)
        // For now, we'll save as the recorded format and label it appropriately
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      
      // Provide more specific error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Failed to access audio: Permission denied. Please grant microphone permission and select audio when sharing screen/tab.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Failed to access audio: No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Failed to access audio: Microphone is already in use by another application.');
      } else {
        setError('Failed to access audio: ' + (err.message || 'Please grant microphone permission and try again.'));
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const endMeeting = () => {
    if (mediaRecorderRef.current && isRecording) {
      const recorder = mediaRecorderRef.current;
      
      // Request final data before stopping
      if (recorder.state === 'recording') {
        recorder.requestData();
      }
      
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 100);
      
      setIsRecording(false);
      clearInterval(timerRef.current);
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
      const fileName = `${meeting.title.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
      const audioFile = new File([audioBlobRef.current], fileName, { 
        type: audioBlobRef.current.type 
      });

      // Automated workflow: Transcribe → Translate → Analyze
      console.log('Starting complete audio processing workflow...');
      const result = await audioApi.processAudioComplete(audioFile, meeting.title, true);
      
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
    a.download = `${meeting.title.replace(/\s+/g, '_')}_${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Meetings
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {meeting.title}
          </h1>
          <p className="text-gray-600 mb-6">{meeting.description}</p>
          
          <div >
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
            <span>
              {meeting.date}
            </span>
            <span className="flex items-center gap-1">
              🕐 {meeting.time}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
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
              <div className="text-green-600 font-medium mb-4">
                ✓ Recording saved successfully!
              </div>
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
          <div className="flex gap-4 justify-center">
            {!isRecording && !audioURL && (
              <button
                onClick={startRecording}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🎙️ Record Audio
              </button>
            )}

            {isRecording && (
              <>
                <button
               >
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
                After recording, you can upload the audio to be transcribed by the server
                  onClick={() => {
                    setAudioURL(null);
                    setRecordingTime(0);
                    setUploadSuccess(false);
                    audioBlobRef.current = null;
                  }}
                  disabled={uploading}
                  className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                <button>
                  🔄 Record Again
                </button>
                  ⏹️ End Meeting
                </button>
              </>
            )}

            {audioURL && !isRecording && (
              <button
                onClick={() => {
                  setAudioURL(null);
                  setRecordingTime(0);
                }}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🎙️ Record Again
              </button>
            )}
          </div>

          {/* Recording Info */}
          {!isRecording && !audioURL && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> When you click "Record Audio", your browser will ask for microphone permission. 
                The audio will be automatically saved as an MP3 file when you end the meeting.
              </p>
              <p className="text-sm text-blue-800 mt-2">
                <strong>⚠️ HTTPS Required:</strong> Audio recording requires a secure context (HTTPS). 
                If you're accessing via HTTP on a VM, please configure HTTPS or use an SSH tunnel to localhost.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingRecorder;
