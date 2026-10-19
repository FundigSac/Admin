import type { ClaimStatus, InquiryStatus, PrivacyStatus, QuoteStatus } from "@/data/types";
import type { Tone } from "./case-ui";

// Un estado = un tono: ámbar lo que espera acción, azul lo que está en curso, verde lo resuelto, gris lo cerrado.
export const QUOTE_TONE: Record<QuoteStatus, Tone> = { new: "todo", reviewing: "progress", sent: "progress", won: "done", lost: "muted" };
export const INQUIRY_TONE: Record<InquiryStatus, Tone> = { new: "todo", answered: "done", closed: "muted" };
export const CLAIM_TONE: Record<ClaimStatus, Tone> = { received: "todo", in_progress: "progress", answered: "done" };
export const PRIVACY_TONE: Record<PrivacyStatus, Tone> = { received: "todo", identity: "progress", processing: "progress", done: "done" };
