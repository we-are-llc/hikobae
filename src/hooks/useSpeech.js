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
      // 毎回すべての result から確定文を組み立て直す（再発火に強い）。
      // ゆっくり話すとエンジンが早すぎる確定を出し、直後に前半を内包した
      // より長い確定を別スロットで出し直すことがある（例: "4.2" → "4.2g"）。
      // 隣接する確定セグメント間で内包関係を検出し、重複を排除する。
      const finalSegs = [];
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) {
          interim += e.results[i][0].transcript;
          continue;
        }
        // 英数字トークンで前後に空白が付くことがあるため trim して比較・格納する。
        const t = e.results[i][0].transcript.trim();
        if (!t) continue;
        const last = finalSegs.length ? finalSegs[finalSegs.length - 1] : null;
        if (last !== null && t.startsWith(last)) {
          // 直前セグメントを内包する再認識結果 → 置き換え
          finalSegs[finalSegs.length - 1] = t;
        } else if (last !== null && last.startsWith(t)) {
          // 直前セグメントの一部を再送しただけ → 無視
        } else {
          finalSegs.push(t);
        }
      }
      setTranscript(finalSegs.join(''));
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
