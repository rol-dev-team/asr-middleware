import axiosInstance from "./axiosInstance";

const AUDIO_PREFIX = "/api/v1/audios";

export const transcribeAudio = async (audioBlob, title = "Untitled") => {
  const formData = new FormData();

  const mimeType = audioBlob.type || "audio/webm";
  const extension = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("wav") ? "wav"
    : "webm";

  const file = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
    type: mimeType,
  });

  formData.append("file", file);

  const { data } = await axiosInstance.post(`${AUDIO_PREFIX}/transcribe`, formData, {
    params: { title },
    headers: {
      "Content-Type": undefined,
    },
    timeout: 300_000,
  });

  return data;
};

export const getAllAudios = async ({ skip = 0, limit = 100 } = {}) => {
  const { data } = await axiosInstance.get(AUDIO_PREFIX, {
    params: { skip, limit },
  });
  return data;
};

export const getAudioById = async (audioId) => {
  const { data } = await axiosInstance.get(`${AUDIO_PREFIX}/${audioId}`);
  return data;
};

export const getTranslationsByAudioId = async (audioId) => {
  const { data } = await axiosInstance.get(`${AUDIO_PREFIX}/${audioId}/translations`);
  return data;
};

/**
 * Parse raw transcription text into chat message objects.
 *
 * Expected input format (from Gemini):
 *   "[ 0m1s ] Speaker 1: Hello.\n[ 0m2s ] Speaker 2: Hmm."
 *
 * Returns array of: { speaker: string, time: string, text: string }
 */
export const parseTranscriptionToMessages = (rawText) => {
  if (!rawText) return [];

  // Normalize line endings and split
  // const lines = rawText.replace(/\\n/g, "\n").split("\n").filter((l) => l.trim());
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim());
  const messages = [];

  // Matches: "[ 0m0s962ms ] Speaker 1: hello"
  const lineRegex = /^\[\s*([^\]]+)\]\s*(.+?):\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (match) {
      messages.push({
        speaker: match[2].trim(),
        time: match[1].trim(),
        text: match[3].trim(),
      });
    }
  }

  if (messages.length === 0 && rawText.trim()) {
    messages.push({ speaker: "Transcript", time: "0m0s", text: rawText.trim() });
  }

  return messages;
};