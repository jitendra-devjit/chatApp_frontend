import { useEffect, useRef, useState } from "react";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const SAMPLE_EVERY_MS = 80;
const WAVEFORM_POINTS = 48;
export const MAX_RECORDING_SECONDS = 5 * 60;

export const canRecordVoice = () =>
    typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder === "function";

// squeezes all loudness samples of a recording into a fixed number of bars, 0 to 100
const toWaveform = (levels) => {
    if (levels.length === 0) return [];
    const peak = Math.max(...levels, 0.01);
    return Array.from({ length: WAVEFORM_POINTS }, (_, index) => {
        const from = Math.floor((index * levels.length) / WAVEFORM_POINTS);
        const to = Math.max(from + 1, Math.floor(((index + 1) * levels.length) / WAVEFORM_POINTS));
        const slice = levels.slice(from, to);
        const average = slice.reduce((sum, level) => sum + level, 0) / slice.length;
        return Math.max(4, Math.round((average / peak) * 100));
    });
};

// Records a voice note from the microphone.
//   start()   asks for the microphone and begins, throws when it is refused
//   stop()    resolves to { file, duration, waveform }
//   cancel()  throws the recording away
// While recording, `seconds` counts up and `levels` holds the latest loudness values (0 to 1) for a live meter
export function useVoiceRecorder(){
    const [isRecording, setIsRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [levels, setLevels] = useState([]);
    const session = useRef(null); // everything that belongs to the recording in progress

    const release = () => {
        const current = session.current;
        if (!current) return;
        clearInterval(current.timer);
        current.stream.getTracks().forEach((track) => track.stop());
        current.audioContext.close().catch(() => {});
        session.current = null;
        setIsRecording(false);
        setSeconds(0);
        setLevels([]);
    };

    // the microphone is let go when the component using it goes away
    useEffect(() => release, []);

    const start = async () => {
        if (session.current) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks = [];
        recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);

        // an analyser listens along to measure how loud it is
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const allLevels = [];
        const startedAt = Date.now();

        const timer = setInterval(() => {
            analyser.getByteTimeDomainData(samples);
            // distance of the wave from silence (128), averaged
            const level = samples.reduce((sum, value) => sum + Math.abs(value - 128), 0) / samples.length / 128;
            allLevels.push(level);
            setLevels(allLevels.slice(-40));
            setSeconds((Date.now() - startedAt) / 1000);
        }, SAMPLE_EVERY_MS);

        session.current = { stream, recorder, chunks, audioContext, allLevels, startedAt, timer };
        recorder.start();
        setIsRecording(true);
    };

    const stop = () =>
        new Promise((resolve, reject) => {
            const current = session.current;
            if (!current) return reject(new Error("Nothing is being recorded"));
            const { recorder, chunks, allLevels, startedAt } = current;
            recorder.onstop = () => {
                const type = (recorder.mimeType || "audio/webm").split(";")[0];
                const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
                const file = new File(chunks, `voice-${Date.now()}.${extension}`, { type });
                const duration = (Date.now() - startedAt) / 1000;
                release();
                resolve({ file, duration, waveform: toWaveform(allLevels) });
            };
            recorder.stop();
        });

    const cancel = () => {
        const current = session.current;
        if (!current) return;
        current.recorder.onstop = null;
        if (current.recorder.state !== "inactive") current.recorder.stop();
        release();
    };

    return { isRecording, seconds, levels, start, stop, cancel };
}
