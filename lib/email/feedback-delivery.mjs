export function getFeedbackTransportOptions(config) {
  return {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: config.user,
      pass: config.appPassword,
    },
  };
}

export async function deliverFeedbackEmail({
  createTransport,
  config,
  message,
}) {
  const transporter = createTransport(getFeedbackTransportOptions(config));
  await transporter.sendMail({
    from: config.from,
    to: config.to,
    ...message,
  });
}
