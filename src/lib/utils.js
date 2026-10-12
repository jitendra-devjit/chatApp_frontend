export const APP_NAME = "Adda";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_BIO_LENGTH = 160;

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

const AVATAR_COLORS = ["#e9d3ae", "#c7d9c2", "#d5c8ea", "#f1c3b2", "#bcd6ea", "#e4dfa2", "#eac1d3", "#b9dcd3"];

// the same name always gets the same colour
export function getAvatarColor(name = ""){
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// returns an error text when the file cannot be sent, otherwise null
export function validateImageFile(file){
    if (!file || !IMAGE_TYPES.includes(file.type)) return "Choose a PNG, JPG, WEBP or GIF image";
    if (file.size > MAX_IMAGE_BYTES) return "Image must be smaller than 3 MB";
    return null;
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
