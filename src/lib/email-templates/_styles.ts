export const SITE_NAME = "Pilates with Jon";
export const APP_BASE_URL = "https://pilateswithjon.com";

// Brand palette
const NAVY = "#1a3a6b";
const BLUE = "#0066cc";
const RED = "#cc1a1a";
const BG = "#f4f6fb";
const CARD = "#ffffff";
const BORDER = "#d0d8ec";
const TEXT = "#0f1f3a";
const MUTED = "#4a5a78";

export const main = { backgroundColor: BG, fontFamily: "Inter, Helvetica, Arial, sans-serif" };
export const container = { padding: "32px 28px", maxWidth: "560px", backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", margin: "24px auto" };
export const header = { fontSize: "13px", color: NAVY, letterSpacing: "0.12em", textTransform: "uppercase" as const, fontWeight: 700, margin: "0 0 18px" };
export const h1 = { fontSize: "24px", fontWeight: 600, color: NAVY, margin: "0 0 18px", fontFamily: "Inter, Helvetica, Arial, sans-serif", letterSpacing: "-0.01em" };
export const text = { fontSize: "15px", color: TEXT, lineHeight: "1.6", margin: "0 0 18px" };
export const link = { color: BLUE, textDecoration: "underline" };
export const button = { backgroundColor: RED, color: "#ffffff", padding: "12px 22px", borderRadius: "6px", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-block" as const };
export const footer = { fontSize: "13px", color: MUTED, margin: "32px 0 0" };
export const card = { background: BG, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "16px 18px", margin: "0 0 18px" };
