import type { Order, OrderItem } from '@prisma/client';
import { env } from '../config/env.js';

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Wraps content in the Lumière brand email layout
 */
const getBaseTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FDF6E3;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #3A2418;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #FDF6E3;
      padding-bottom: 60px;
    }
    .main {
      background-color: #ffffff;
      margin: 40px auto 0;
      width: 100%;
      max-width: 600px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(58, 36, 24, 0.05);
      overflow: hidden;
      border: 1px solid #E3D5C8;
    }
    .header {
      text-align: center;
      padding: 40px 20px 30px;
      background-color: #FCF8F3;
      border-bottom: 1px solid #E3D5C8;
    }
    .logo {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: #3A2418;
      margin: 0;
      text-transform: uppercase;
    }
    .tagline {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.15em;
      color: #944A27;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .content {
      padding: 40px;
    }
    h1 {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 28px;
      font-weight: 500;
      color: #3A2418;
      margin: 0 0 20px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 16px;
      font-size: 15px;
      color: #4B4540;
    }
    .button {
      display: inline-block;
      background-color: #944A27;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .footer {
      text-align: center;
      padding: 30px 20px;
      color: #756D65;
      font-size: 12px;
    }
    .footer a {
      color: #944A27;
      text-decoration: none;
    }
    /* Order specific styles */
    .order-box {
      border: 1px solid #E3D5C8;
      border-radius: 8px;
      padding: 24px;
      margin: 30px 0;
      background-color: #FCF8F3;
    }
    .order-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #E3D5C8;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .order-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }
    .item-title {
      font-weight: 600;
      color: #3A2418;
      font-size: 14px;
    }
    .item-meta {
      font-size: 13px;
      color: #756D65;
      margin-top: 2px;
    }
    .item-price {
      font-weight: 600;
      color: #3A2418;
      font-size: 14px;
    }
    .order-total {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #E3D5C8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-weight: 600;
      font-size: 16px;
      color: #3A2418;
    }
    .total-amount {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 24px;
      font-weight: 600;
      color: #944A27;
    }
  </style>
</head>
<body>
  <center class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="header">
          <p class="logo">LUMIÈRE</p>
          <p class="tagline">Scents that stay</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          ${content}
        </td>
      </tr>
    </table>
    <div class="footer">
      <p>Hand-poured with love in Addis Ababa.</p>
      <p>© ${new Date().getFullYear()} Lumière. All rights reserved.</p>
    </div>
  </center>
</body>
</html>
`;

export const getOrderConfirmationTemplate = (order: OrderWithItems) => {
  const itemsHtml = order.items
    .map(
      (item) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px; border-bottom: 1px solid #E3D5C8; padding-bottom: 15px;">
      <tr>
        <td style="font-size: 14px; font-weight: 600; color: #3A2418;">
          ${item.productNameSnapshot}
          <div style="font-size: 13px; color: #756D65; font-weight: 400; margin-top: 4px;">
            ${item.scentSnapshot} · ${item.sizeSnapshot} (Qty: ${item.quantity})
          </div>
        </td>
        <td align="right" style="font-size: 14px; font-weight: 600; color: #3A2418; vertical-align: top;">
          ${Number(item.unitPriceSnapshot).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
        </td>
      </tr>
    </table>
  `,
    )
    .join('');

  const content = `
    <h1>Thank you for your order.</h1>
    <p>Hi there,</p>
    <p>We've received your order <strong>#${order.id}</strong> and are getting it ready for you. We'll send you another email as soon as it ships.</p>
    
    <div style="background-color: #FCF8F3; border: 1px solid #E3D5C8; border-radius: 8px; padding: 24px; margin: 30px 0;">
      <h3 style="margin-top: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 500; border-bottom: 1px solid #E3D5C8; padding-bottom: 15px; margin-bottom: 15px;">Order Summary</h3>
      
      ${itemsHtml}
      
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
        <tr>
          <td style="font-size: 16px; font-weight: 600; color: #3A2418;">Total</td>
          <td align="right" style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 600; color: #944A27;">
            ${Number(order.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
          </td>
        </tr>
      </table>
    </div>
    
    <p>If you have any questions about your order, reply to this email or contact us at <a href="mailto:support@lumiere.et" style="color: #944A27;">support@lumiere.et</a>.</p>
  `;

  return getBaseTemplate('Order Confirmation - Lumière', content);
};

export const getShippingNotificationTemplate = (order: Order) => {
  const content = `
    <h1>Your order is on its way.</h1>
    <p>Great news!</p>
    <p>Your order <strong>#${order.id}</strong> has been shipped and is currently on its way to you.</p>
    <p>Our delivery partner will contact you shortly to coordinate the drop-off time. Please ensure someone is available at your shipping address to receive the package.</p>
    <br/>
    <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-style: italic; color: #944A27;">
      "Warmth you can carry from room to room."
    </p>
    <br/>
    <p>Thank you for shopping with Lumière!</p>
  `;

  return getBaseTemplate('Your Order Has Shipped - Lumière', content);
};

export const getPasswordResetTemplate = (resetUrl: string) => {
  const content = `
    <h1>Reset Your Password</h1>
    <p>We received a request to reset the password for your Lumière account.</p>
    <p>Click the button below to choose a new password:</p>
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </td>
      </tr>
    </table>
    
    <p style="margin-top: 20px;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
  `;

  return getBaseTemplate('Reset Your Password - Lumière', content);
};

export const getPaymentFailedTemplate = (txRef: string, reason: 'failed' | 'cancelled') => {
  const isCancelled = reason === 'cancelled';
  const heading = isCancelled ? 'Payment Cancelled' : 'Payment Failed';
  const message = isCancelled
    ? 'Your payment was cancelled before it could be completed.'
    : 'We were unable to process your payment.';

  const content = `
    <h1>${heading}</h1>
    <p>Hi there,</p>
    <p>${message}</p>
    
    <div style="background-color: #FDF6F6; border: 1px solid #F1D4D4; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <p style="margin: 0; color: #B34444; font-size: 14px;"><strong>Transaction Reference:</strong> ${txRef}</p>
    </div>
    
    <p>No order was placed and you have not been charged.</p>
    <p>If you still wish to purchase your items, you can return to our store and try checking out again.</p>
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${env.FRONTEND_ORDER_CONFIRMATION_URL.replace('/order-confirmation', '/cart')}" class="button">Return to Cart</a>
        </td>
      </tr>
    </table>
  `;

  return getBaseTemplate(`${heading} - Lumière`, content);
};
