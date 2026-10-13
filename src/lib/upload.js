// Files of a message: which ones are allowed, and how they get to storage
import axios from "axios";

const MB = 1024 * 1024;

export const MAX_ATTACHMENTS = 10;

// the same list the server allows, see UPLOAD_KINDS in the backend's lib/storage.js
export const UPLOAD_KINDS = {
    image: { formats: ["png", "jpg", "jpeg", "webp", "gif"], maxBytes: 10 * MB },
    video: { formats: ["mp4", "webm", "mov"], maxBytes: 100 * MB },
    audio: { formats: ["webm", "ogg", "mp3", "m4a", "mp4", "wav", "aac"], maxBytes: 10 * MB },
    file: { formats: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip"], maxBytes: 10 * MB },
};

// what the file pickers offer
export const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp3,.m4a,.wav,.ogg";

export const extensionOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

// image, video, audio or file, or null when this file cannot be sent
export function kindOfFile(file){
    const extension = extensionOf(file.name);
    const type = file.type || "";
    // webm and mp4 can be either sound or video, the browser's type decides
    if (type.startsWith("audio/") && UPLOAD_KINDS.audio.formats.includes(extension)) return "audio";
    if (UPLOAD_KINDS.image.formats.includes(extension)) return "image";
    if (UPLOAD_KINDS.video.formats.includes(extension)) return "video";
    if (UPLOAD_KINDS.audio.formats.includes(extension)) return "audio";
    if (UPLOAD_KINDS.file.formats.includes(extension)) return "file";
    return null;
}

// returns { kind } for a file that can be sent, or { error } with the reason it cannot
export function checkFile(file){
    const kind = kindOfFile(file);
    if (!kind) return { error: `${file.name}: this type of file can't be sent` };
    const { maxBytes } = UPLOAD_KINDS[kind];
    if (file.size > maxBytes) return { error: `${file.name} is larger than ${maxBytes / MB} MB` };
    if (file.size === 0) return { error: `${file.name} is empty` };
    return { kind };
}

export function formatBytes(bytes){
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

// 75 -> "1:15"
export function formatDuration(seconds){
    const total = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Sends one file to storage and resolves to what the message route needs to attach it.
// The file goes straight from the browser to Cloudinary, the server only hands out the permission.
// `api` is the logged in axios instance, `onProgress` gets a number from 0 to 1
export async function uploadFile(api, file, kind, onProgress = () => {}){
    const { data } = await api.post("/api/uploads/ticket", { kind });
    const { driver, url, fields } = data.ticket;
    const onUploadProgress = (event) => onProgress(event.total ? event.loaded / event.total : 0);

    let receipt;
    if (driver === "local") {
        // demo mode keeps files on the backend itself
        const headers = { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) };
        receipt = (await api.put(url, file, { headers, onUploadProgress })).data;
    } else {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => form.append(key, value));
        form.append("file", file, file.name);
        try {
            receipt = (await axios.post(url, form, { onUploadProgress })).data;
        } catch (error) {
            // Cloudinary explains a refusal in its own error format
            throw new Error(error.response?.data?.error?.message || `Could not upload ${file.name}`);
        }
    }
    onProgress(1);
    return { kind, upload: receipt, name: file.name };
}

const isCloudinary = (url = "") => url.includes("res.cloudinary.com");

// A smaller, compressed version of a picture for showing in the chat. Other links are returned as they are
export function thumbnailUrl(url, width = 900){
    if (!isCloudinary(url) || !url.includes("/image/upload/")) return url;
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

// The first frame of a video as a picture, or null when storage cannot make one
export function posterUrl(url, width = 700){
    if (!isCloudinary(url) || !url.includes("/video/upload/")) return null;
    return url.replace("/video/upload/", `/video/upload/so_0,c_limit,w_${width}/`).replace(/\.[a-z0-9]+$/i, ".jpg");
}

const OFFICE_FORMATS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
const isPublicLink = (url = "") => /^https:\/\//.test(url) && !/\/\/(localhost|127\.0\.0\.1)/.test(url);

// A link that shows the document in a browser tab. A browser can show PDF and text files itself.
// Word, Excel and PowerPoint files are opened with Google's online viewer, which loads the file
// from its link (Microsoft's viewer shows an empty page on phones). Anything else (zip) can only be downloaded
export function viewUrl(url, extension){
    if (OFFICE_FORMATS.includes(extension) && isPublicLink(url)) {
        return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
    }
    return extension === "zip" ? downloadUrl(url) : url;
}

// Cloudinary refuses to hand out PDF and ZIP files over their normal link (the account would have
// to allow it). For those the server is asked for a link that works for a few minutes, see FileCard
export const needsTemporaryLink = (url, extension) =>
    isCloudinary(url) && url.includes("/raw/upload/") && (extension === "pdf" || extension === "zip");

// A link that downloads the file instead of opening it in the browser
export function downloadUrl(url){
    if (!isCloudinary(url)) return url;
    return url.replace(/\/(image|video|raw)\/upload\//, "/$1/upload/fl_attachment/");
}
