export interface FeedbackDeliveryConfig {
  user: string;
  appPassword: string;
  from: string;
  to: string;
}

export interface FeedbackDeliveryMessage {
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

export interface FeedbackTransport {
  sendMail(message: FeedbackDeliveryMessage & { from: string; to: string }): Promise<unknown>;
}

export type CreateFeedbackTransport = (
  options: ReturnType<typeof getFeedbackTransportOptions>,
) => FeedbackTransport;

export function getFeedbackTransportOptions(config: FeedbackDeliveryConfig): {
  host: 'smtp.gmail.com';
  port: 587;
  secure: false;
  requireTLS: true;
  auth: {
    user: string;
    pass: string;
  };
};

export function deliverFeedbackEmail(params: {
  createTransport: CreateFeedbackTransport;
  config: FeedbackDeliveryConfig;
  message: FeedbackDeliveryMessage;
}): Promise<void>;
