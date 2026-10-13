// Sounds and browser notifications for incoming messages and calls

const STORAGE_KEY = "notifications";

export const canNotify = () => typeof window !== "undefined" && "Notification" in window;

// on unless the user switched it off with the bell
export function isNotifyEnabled(){
    try {
        return localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
        return true;
    }
}

export function setNotifyEnabled(enabled){
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
        // storage can be blocked, the choice then lasts for this visit only
    }
}

// asks the browser once, resolves to true when notifications are allowed
export async function requestNotificationPermission(){
    if (!canNotify()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
}

let audioContext = null;

// a short two note "pop", made in the browser so no sound file is needed
export function playMessageSound(){
    try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") audioContext.resume();
        const now = audioContext.currentTime;
        [[660, 0], [880, 0.09]].forEach(([frequency, delay]) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.12, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22);
            oscillator.connect(gain).connect(audioContext.destination);
            oscillator.start(now + delay);
            oscillator.stop(now + delay + 0.25);
        });
    } catch {
        // browsers block sound until the page was clicked once
    }
}

// what is played while a call rings: [frequency, start in seconds, length in seconds] and how often it repeats
const RINGTONES = {
    incoming: { notes: [[784, 0, 0.16], [988, 0.18, 0.16], [1175, 0.36, 0.16], [988, 0.54, 0.3]], everyMs: 1900, volume: 0.14 },
    outgoing: { notes: [[440, 0, 0.9]], everyMs: 2800, volume: 0.06 },
};

// Rings until the returned function is called. kind is "incoming" or "outgoing"
export function startRingtone(kind){
    const { notes, everyMs, volume } = RINGTONES[kind];
    const ring = () => {
        try {
            audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === "suspended") audioContext.resume();
            const now = audioContext.currentTime;
            notes.forEach(([frequency, delay, length]) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0.0001, now + delay);
                gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + length);
                oscillator.connect(gain).connect(audioContext.destination);
                oscillator.start(now + delay);
                oscillator.stop(now + delay + length + 0.05);
            });
        } catch {
            // browsers block sound until the page was clicked once
        }
    };
    ring();
    const timer = setInterval(ring, everyMs);
    return () => clearInterval(timer);
}

// system notification, only while the tab is in the background
export function showNotification({ title, body, icon, tag, onClick }){
    if (!canNotify() || Notification.permission !== "granted" || !document.hidden) return;
    try {
        const notification = new Notification(title, { body, icon: icon || "/favicon.svg", tag });
        notification.onclick = () => {
            window.focus();
            onClick?.();
            notification.close();
        };
    } catch {
        // some mobile browsers only allow notifications from a service worker
    }
}
