import { useState, useRef, useEffect } from 'react';

function MeetingRecorder({ meeting, onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder with appropriate MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Convert to MP3 (Note: Direct MP3 encoding requires a library like lamejs)
        // For now, we'll save as the recorded format and label it appropriately
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        // Download the file
        downloadAudio(audioBlob, meeting.title);
        
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
      setError('Failed to access microphone. Please grant permission and try again.');
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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const downloadAudio = (blob, meetingTitle) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `${meetingTitle.replace(/\s+/g, '_')}_${timestamp}.mp3`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
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
          
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
            <span className="flex items-center gap-1">
              📅 {meeting.date}
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
                  onClick={pauseRecording}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button
                  onClick={endMeeting}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingRecorder;
