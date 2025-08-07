import nodemailer from 'nodemailer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
    toEmail: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  desktop?: {
    enabled: boolean;
  };
}

export interface PropertyNotification {
  id: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  quarter?: string;
  area?: number;
  rooms?: number;
  url: string;
  pricePerSqm?: number;
  isTopOffer?: boolean;
  isVipOffer?: boolean;
}

export class NotificationService {
  private config: NotificationConfig;
  private emailTransporter?: nodemailer.Transporter;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.initializeServices();
  }

  private async initializeServices() {
    if (this.config.email?.enabled) {
      this.emailTransporter = nodemailer.createTransporter({
        host: this.config.email.smtpHost,
        port: this.config.email.smtpPort,
        secure: this.config.email.smtpPort === 465,
        auth: {
          user: this.config.email.smtpUser,
          pass: this.config.email.smtpPass,
        },
      });
    }
  }

  async sendNewListingAlert(properties: PropertyNotification[]): Promise<void> {
    if (properties.length === 0) return;

    const promises: Promise<void>[] = [];

    if (this.config.email?.enabled) {
      promises.push(this.sendEmailNotification(properties));
    }

    if (this.config.webhook?.enabled) {
      promises.push(this.sendWebhookNotification(properties));
    }

    if (this.config.desktop?.enabled) {
      promises.push(this.sendDesktopNotification(properties));
    }

    await Promise.allSettled(promises);
  }

  private async sendEmailNotification(properties: PropertyNotification[]): Promise<void> {
    if (!this.emailTransporter || !this.config.email) return;

    const subject = `🏠 ${properties.length} New Property${properties.length > 1 ? 's' : ''} Found`;
    const html = await this.generateEmailHTML(properties);

    try {
      await this.emailTransporter.sendMail({
        from: this.config.email.fromEmail,
        to: this.config.email.toEmail,
        subject,
        html,
      });
      console.log(`✅ Email notification sent for ${properties.length} properties`);
    } catch (error) {
      console.error('❌ Failed to send email notification:', error);
    }
  }

  private async sendWebhookNotification(properties: PropertyNotification[]): Promise<void> {
    if (!this.config.webhook) return;

    const payload = {
      timestamp: new Date().toISOString(),
      count: properties.length,
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        price: `${p.price} ${p.currency}`,
        location: `${p.quarter ? p.quarter + ', ' : ''}${p.city}`,
        area: p.area ? `${p.area}m²` : null,
        rooms: p.rooms,
        url: p.url,
        pricePerSqm: p.pricePerSqm ? `${p.pricePerSqm} ${p.currency}/m²` : null,
        isTopOffer: p.isTopOffer,
        isVipOffer: p.isVipOffer,
      })),
    };

    try {
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Webhook notification sent for ${properties.length} properties`);
    } catch (error) {
      console.error('❌ Failed to send webhook notification:', error);
    }
  }

  private async sendDesktopNotification(properties: PropertyNotification[]): Promise<void> {
    // For now, just log to console. In a real implementation, you could use:
    // - node-notifier for cross-platform desktop notifications
    // - OS-specific notification systems
    // - WebSocket to browser for real-time notifications
    
    console.log(`🔔 Desktop notification: ${properties.length} new property${properties.length > 1 ? 's' : ''} found`);
    
    properties.forEach(property => {
      console.log(`  📍 ${property.title} - ${property.price} ${property.currency} in ${property.city}`);
    });
  }

  private async generateEmailHTML(properties: PropertyNotification[]): Promise<string> {
    const propertiesHTML = properties.map(property => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 15px; vertical-align: top;">
          <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">
            ${property.title}
            ${property.isTopOffer ? '<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">TOP</span>' : ''}
            ${property.isVipOffer ? '<span style="background: #e91e63; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">VIP</span>' : ''}
          </h3>
          <div style="margin-bottom: 8px;">
            <strong style="color: #2563eb; font-size: 18px;">${property.price} ${property.currency}</strong>
            ${property.pricePerSqm ? `<span style="color: #666; margin-left: 8px;">(${property.pricePerSqm} ${property.currency}/m²)</span>` : ''}
          </div>
          <div style="color: #666; margin-bottom: 8px;">
            📍 ${property.quarter ? property.quarter + ', ' : ''}${property.city}
          </div>
          <div style="color: #666; margin-bottom: 12px;">
            ${property.area ? `🏠 ${property.area}m²` : ''}
            ${property.rooms ? ` • 🛏️ ${property.rooms} rooms` : ''}
          </div>
          <a href="${property.url}" 
             style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">
            View Property
          </a>
        </td>
      </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Properties Found</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🏠 New Properties Found</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">
            ${properties.length} new property${properties.length > 1 ? 's' : ''} matching your criteria
          </p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          ${propertiesHTML}
        </table>
        
        <div style="padding: 20px; text-align: center; background: #f8f9fa; color: #666; font-size: 12px;">
          <p style="margin: 0;">
            Real Estate Finder • ${new Date().toLocaleString()}
          </p>
          <p style="margin: 8px 0 0 0;">
            <a href="http://localhost:3000" style="color: #2563eb;">View All Properties</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  async sendPriceAlert(property: PropertyNotification, oldPrice: number): Promise<void> {
    const priceChange = property.price - oldPrice;
    const priceChangePercent = ((priceChange / oldPrice) * 100).toFixed(1);
    const direction = priceChange > 0 ? '📈 increased' : '📉 decreased';
    const color = priceChange > 0 ? '#ef4444' : '#10b981';

    if (this.config.email?.enabled && this.emailTransporter) {
      const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">💰 Price Change Alert</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #333;">${property.title}</h2>
            <div style="margin-bottom: 15px;">
              📍 ${property.quarter ? property.quarter + ', ' : ''}${property.city}
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <div style="font-size: 18px; margin-bottom: 8px;">
                Price has ${direction} by <strong style="color: ${color};">${Math.abs(priceChange)} ${property.currency}</strong> (${Math.abs(parseFloat(priceChangePercent))}%)
              </div>
              <div style="color: #666;">
                Old: ${oldPrice} ${property.currency} → New: <strong>${property.price} ${property.currency}</strong>
              </div>
            </div>
            
            <a href="${property.url}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View Property
            </a>
          </div>
        </div>
      </body>
      </html>
      `;

      try {
        await this.emailTransporter.sendMail({
          from: this.config.email.fromEmail,
          to: this.config.email.toEmail,
          subject: `💰 Price ${direction.split(' ')[1]} for ${property.title}`,
          html,
        });
        console.log(`✅ Price alert sent for property ${property.id}`);
      } catch (error) {
        console.error('❌ Failed to send price alert:', error);
      }
    }
  }

  async testConnection(): Promise<boolean> {
    if (this.config.email?.enabled && this.emailTransporter) {
      try {
        await this.emailTransporter.verify();
        console.log('✅ Email service connection verified');
        return true;
      } catch (error) {
        console.error('❌ Email service connection failed:', error);
        return false;
      }
    }
    return true;
  }
}