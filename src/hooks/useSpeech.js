import { useState, useRef, useCallback } from 'react';

const VOICE_COMMANDS = {
  まる: '。',
  てん: '、',
  かいぎょう: '\n',
  かっこ: '（',
  かっことじ: '）',
  はいふん: 'ー',
  はてな: '？',
  びっくり: '！',
};

export function applyVoiceCommands(text) {
  return text
    .split(/\s+/)
    .map((word) => VOICE_COMMANDS[word] ?? word)
    .join('');
}

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('このブラウザは音声入力に対応していません。\nChrome または Edge をお使いください。');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setError(null);
    setInterimTranscript('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') return;
      const msgs = {
        'not-allowed': 'マイクの使用が許可されていません。\nブラウザの設定でマイクを許可してください。',
        'audio-capture': 'マイクが見つかりません。\nマイクが接続されているか確認してください。',
        network: 'ネットワークエラーが発生しました。\nインターネット接続を確認してください。',
      };
      setError(msgs[e.error] ?? `エラーが発生しました: ${e.error}`);
      setIsListening(false);
    };

    recognition.onresult = (e) => {
      let interim = '';
      let finalAdded = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalAdded += t;
        } else {
          interim += t;
        }
      }
      if (finalAdded) {
        setTranscript((prev) => prev + finalAdded);
      }
      setInterimTranscript(interim);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, [stop]);

  return {
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
