export async function sendInviteEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "You're invited to AtmosOne CRM",
      text: `You've been invited to edit AtmosOne CRM.\n\nOpen this link to join as an owner:\n${link}\n\nThe link expires in 14 days.`,
    }),
  });

  return response.ok;
}
