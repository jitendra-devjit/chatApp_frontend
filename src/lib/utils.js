export const APP_NAME = "Adda";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_BIO_LENGTH = 160;

// emoji offered when reacting to a message
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
// the server lets a message be edited for this long
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

// accent colour themes, the first one is the default. Colours are the gradient stops in index.css
export const ACCENTS = [
    { id: "aurora", name: "Aurora", colors: ["#7c5cff", "#b85cff", "#ff5ca8"] },
    { id: "ocean", name: "Ocean", colors: ["#2f7bff", "#1fb0ff", "#1fe0c8"] },
    { id: "sunset", name: "Sunset", colors: ["#ff7a3d", "#ff4d6d", "#d946ef"] },
    { id: "mint", name: "Mint", colors: ["#0fb981", "#12c8b4", "#38bdf8"] },
    { id: "rose", name: "Rose", colors: ["#ff4d7d", "#ff6f91", "#ffb057"] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// whole days between a date and today (0 = today, 1 = yesterday)
const daysAgo = (date) => Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);

export function formatMessageTime(date){
    return new Date(date).toLocaleTimeString([],{
        hour: "numeric",
        minute: "2-digit",
    })
}

// label of the separator between two days of a conversation
export function formatDayLabel(date){
    const d = new Date(date);
    const diff = daysAgo(d);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

// short time shown next to a conversation in the sidebar
export function formatListTime(date){
    const d = new Date(date);
    const diff = daysAgo(d);
    if (diff === 0) return formatMessageTime(d);
    if (diff === 1) return "Yesterday";
    if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// "last seen today at 9:40 pm" for somebody who is offline
export function formatLastSeen(date){
    if (!date) return "Offline";
    const d = new Date(date);
    const diff = daysAgo(d);
    const time = formatMessageTime(d);
    if (diff === 0) return `last seen today at ${time}`;
    if (diff === 1) return `last seen yesterday at ${time}`;
    if (diff < 7) return `last seen ${d.toLocaleDateString([], { weekday: "long" })} at ${time}`;
    return `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export const isSameDay = (a, b) => startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();

// message the server sent, or a readable fallback when it could not be reached
export function getErrorMessage(error){
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection.";
    return error?.message || "Something went wrong";
}

export function getInitials(name = ""){
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// the same name always gets the same two-tone gradient
export function getAvatarGradient(name = ""){
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 78% 62%), hsl(${(hue + 48) % 360} 74% 48%))`;
}

// colour of a person's name above their messages in a group, readable in both modes
export function getNameColor(name = ""){
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return `hsl(${hash % 360} 72% 58%)`;
}

export function formatJoined(date){
    if (!date) return "";
    return new Date(date).toLocaleDateString([], { month: "long", year: "numeric" });
}

// How files are named where there is no room to show them (chat list, quotes).
// Takes the kind and name of the first file and how many there are
export function describeAttachment({ type, name, count = 1 }){
    if (type === "image") return { type, label: count > 1 ? `${count} photos` : "Photo" };
    if (count > 1) return { type, label: `${count} files` };
    if (type === "video") return { type, label: "Video" };
    if (type === "audio") return { type, label: name || "Voice message" };
    return { type, label: name || "Document" };
}

// The same for a whole message, plus a small picture when it has one. null for a message without files
export function describeAttachments(message){
    const files = message?.attachments || [];
    if (files.length === 0) {
        return message?.image ? { type: "image", label: "Photo", thumbnail: message.image } : null;
    }
    const [first] = files;
    return {
        ...describeAttachment({ type: first.type, name: first.name, count: files.length }),
        thumbnail: first.type === "image" ? first.url : null,
    };
}

// "45 sec", "5 min", "1 hr 12 min": how long a finished call lasted
export function formatCallDuration(seconds = 0){
    if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sec`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

// "0:07", "12:40", "1:02:05": the running clock of a call
export function formatCallClock(seconds = 0){
    const pad = (value) => String(value).padStart(2, "0");
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = Math.floor(seconds % 60);
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

// The words for a call in the chat. `isOwn` is true for the person who made the call.
// title and detail are the two lines of the bubble, preview is the single line of the chat list.
// isMissed marks a call I did not pick up
export function describeCall(call, isOwn){
    const isVideo = call.kind === "video";
    const name = isVideo ? "Video call" : "Voice call";
    if (call.status === "completed") {
        const duration = formatCallDuration(call.duration);
        return { title: name, detail: duration, preview: `${name} · ${duration}`, isMissed: false };
    }
    if (call.status === "declined") {
        return { title: name, detail: isOwn ? "Declined" : "You declined", preview: `${name} · Declined`, isMissed: false };
    }
    if (isOwn) return { title: name, detail: "No answer", preview: `${name} · No answer`, isMissed: false };
    const missed = `Missed ${isVideo ? "video" : "voice"} call`;
    return { title: missed, detail: "Tap to call back", preview: missed, isMissed: true };
}

// returns an error text when the file cannot be sent, otherwise null
export function validateImageFile(file){
    if (!file || !IMAGE_TYPES.includes(file.type)) return "Choose a PNG, JPG, WEBP or GIF image";
    if (file.size > MAX_IMAGE_BYTES) return "Image must be smaller than 3 MB";
    return null;
}

// Cuts the middle square out of a picture and shrinks it, so a profile photo
// always fits and uploads fast. Resolves to a JPEG data URL
export function cropToSquare(file, size = 640){
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            const target = Math.min(size, side);
            const canvas = document.createElement("canvas");
            canvas.width = target;
            canvas.height = target;
            canvas.getContext("2d").drawImage(
                image,
                (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
                0, 0, target, target
            );
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.9));
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read the image"));
        };
        image.src = url;
    });
}

export function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the file"));
        reader.readAsDataURL(file);
    });
}

const EMOJI_ONLY_REGEX = /^(?:(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u{FE0F}|\u{200D})+\s*){1,3}$/u;

// true for a message made of one to three emoji, shown large without a bubble
export const isEmojiOnly = (text = "") => text.length <= 16 && EMOJI_ONLY_REGEX.test(text.trim());
