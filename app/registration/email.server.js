import nodemailer from "nodemailer";
import db from "../db.server";
import { validEmail } from "./common.server.js";

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
export function renderEmail(template, application, message = "") {
  const variables = {
    company: application.companyName,
    applicant: application.applicantName,
    email: application.email,
    page: application.pageName,
    message,
  };
  return String(template || "").replace(
    /\{\{\s*(company|applicant|email|page|message)\s*\}\}/g,
    (_, key) => variables[key] || "",
  );
}
export async function queueNotification(tx, application, event, message = "") {
  const settings = application.settingsSnapshot;
  const template = settings?.emails?.[event];
  if (!template?.enabled) return;
  const recipients = new Set();
  if (
    ["applicant", "both"].includes(template.to) &&
    validEmail(application.email)
  )
    recipients.add(application.email);
  if (
    ["admin", "both"].includes(template.to) &&
    validEmail(settings.adminEmail)
  )
    recipients.add(settings.adminEmail);
  for (const recipient of recipients) {
    await tx.emailNotification.create({
      data: {
        shop: application.shop,
        applicationId: application.id,
        event,
        recipient,
        subject: renderEmail(template.subject, application, message)
          .replace(/[\r\n]/g, " ")
          .slice(0, 200),
        body: renderEmail(template.body, application, message),
      },
    });
  }
}
export async function deliverNotifications(shop, applicationId) {
  const notifications = await db.emailNotification.findMany({
    where: { shop, applicationId, status: { in: ["pending", "failed"] } },
    take: 20,
  });
  if (!notifications.length) return;
  if (!emailConfigured()) {
    await db.emailNotification.updateMany({
      where: { shop, applicationId, status: { in: ["pending", "failed"] } },
      data: {
        status: "failed",
        error:
          "Email delivery is not configured. Set SMTP_HOST and SMTP_FROM, then retry.",
      },
    });
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    for (const notification of notifications) {
      const claim = await db.emailNotification.updateMany({
        where: {
          shop,
          id: notification.id,
          status: { in: ["pending", "failed"] },
        },
        data: { status: "sending", error: null },
      });
      if (!claim.count) continue;
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM,
          to: notification.recipient,
          subject: notification.subject,
          text: notification.body,
          messageId: `<${notification.id}@${shop}>`,
        });
        await db.emailNotification.updateMany({
          where: { shop, id: notification.id },
          data: { status: "sent", sentAt: new Date() },
        });
      } catch {
        await db.emailNotification.updateMany({
          where: { shop, id: notification.id },
          data: {
            status: "failed",
            error:
              "Email provider could not deliver this message. Check SMTP configuration and retry.",
          },
        });
      }
    }
  } finally {
    transport.close();
  }
}
