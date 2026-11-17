import { logger } from "../lib/logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailTransport = (message: MailMessage) => Promise<void>;

// The production transport would call the mail provider's HTTP API; locally we just log.
let transport: MailTransport = async (message) => {
  logger.info("mail.sent", { to: message.to, subject: message.subject });
};

export function setMailTransport(next: MailTransport): void {
  transport = next;
}

export async function sendMail(message: MailMessage): Promise<void> {
  await transport(message);
}
