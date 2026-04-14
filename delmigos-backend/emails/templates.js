// emails/templates.js
// HTML email templates for Del-Migos

export function bookingConfirmationEmail(booking) {
  return {
    subject: `Booking Confirmed — ${booking.ref} | Del-Migos Hotel`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid rgba(191,161,106,0.2);">
    <!-- Header -->
    <div style="background:#0A0A0A;padding:2.5rem;text-align:center;border-bottom:1px solid rgba(191,161,106,0.15);">
      <div style="font-family:Georgia,serif;font-size:2rem;letter-spacing:0.3em;color:#BFA16A;">DEL-MIGOS</div>
      <div style="font-size:0.6rem;letter-spacing:0.3em;text-transform:uppercase;color:#8A7860;margin-top:0.3rem;">Hotels & Residences · Lagos</div>
    </div>
    <!-- Gold line -->
    <div style="height:2px;background:linear-gradient(to right,transparent,#BFA16A,transparent);"></div>
    <!-- Body -->
    <div style="padding:2.5rem;">
      <div style="font-size:0.6rem;letter-spacing:0.3em;text-transform:uppercase;color:#BFA16A;margin-bottom:0.5rem;">Booking Confirmation</div>
      <h1 style="font-family:Georgia,serif;font-size:1.8rem;color:#F2EDE4;margin:0 0 0.5rem;font-weight:400;">Your Stay is Confirmed</h1>
      <p style="color:#A89880;font-size:0.9rem;line-height:1.7;margin-bottom:2rem;">Dear ${booking.guestName}, we are delighted to confirm your reservation at Del-Migos. We look forward to welcoming you.</p>

      <!-- Booking Details Card -->
      <div style="background:#0A0A0A;border:1px solid rgba(191,161,106,0.2);padding:1.5rem;margin-bottom:2rem;">
        <div style="font-size:0.55rem;letter-spacing:0.25em;text-transform:uppercase;color:#BFA16A;margin-bottom:1rem;">Reservation Details</div>
        ${detailRow('Reference', booking.ref)}
        ${detailRow('Room', booking.roomName)}
        ${detailRow('Check In', formatDate(booking.checkIn) + ' · from 3:00 PM')}
        ${detailRow('Check Out', formatDate(booking.checkOut) + ' · by 12:00 PM')}
        ${detailRow('Duration', booking.nights + ' night' + (booking.nights > 1 ? 's' : ''))}
        ${detailRow('Guests', booking.guests)}
        <div style="border-top:1px solid rgba(191,161,106,0.15);margin-top:0.8rem;padding-top:0.8rem;">
          ${detailRow('Total Paid', '₦' + Number(booking.totalAmount).toLocaleString(), true)}
          ${booking.transactionId ? detailRow('Transaction ID', booking.transactionId) : ''}
        </div>
      </div>

      <!-- What to Expect -->
      <div style="margin-bottom:2rem;">
        <div style="font-size:0.55rem;letter-spacing:0.25em;text-transform:uppercase;color:#BFA16A;margin-bottom:1rem;">Your Concierge Team</div>
        <p style="color:#A89880;font-size:0.85rem;line-height:1.7;">Your personal concierge will reach out within 2 hours to discuss any preferences, restaurant reservations, or special arrangements for your stay. For immediate assistance:</p>
        <div style="margin-top:1rem;">
          <div style="color:#A89880;font-size:0.85rem;">📞 +234 1 700 64467</div>
          <div style="color:#A89880;font-size:0.85rem;margin-top:0.3rem;">✉ concierge@delmigos.com</div>
        </div>
      </div>

      ${booking.specialRequests ? `
      <div style="background:rgba(191,161,106,0.06);border-left:2px solid #BFA16A;padding:1rem;margin-bottom:2rem;">
        <div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:#BFA16A;margin-bottom:0.4rem;">Your Special Requests</div>
        <div style="color:#A89880;font-size:0.85rem;">${booking.specialRequests}</div>
      </div>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin:2rem 0;">
        <a href="https://delmigos.com" style="display:inline-block;background:#BFA16A;color:#0A0A0A;padding:0.9rem 2.5rem;text-decoration:none;font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;">Visit Our Website</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0A0A0A;padding:1.5rem;text-align:center;border-top:1px solid rgba(191,161,106,0.1);">
      <div style="font-size:0.7rem;color:#5A5040;line-height:1.7;">1 Del-Migos Boulevard, Victoria Island, Lagos, Nigeria<br>
      <a href="https://delmigos.com" style="color:#8A7860;text-decoration:none;">delmigos.com</a> · 
      <a href="mailto:reservations@delmigos.com" style="color:#8A7860;text-decoration:none;">reservations@delmigos.com</a></div>
      <div style="font-size:0.6rem;color:#3A3028;margin-top:0.8rem;">© 2025 Del-Migos Hotels & Residences Ltd. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`
  };
}

export function cancellationEmail(booking) {
  return {
    subject: `Booking Cancelled — ${booking.ref} | Del-Migos Hotel`,
    html: `
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid rgba(191,161,106,0.2);padding:2.5rem;">
    <div style="font-family:Georgia,serif;font-size:1.8rem;letter-spacing:0.3em;color:#BFA16A;margin-bottom:2rem;">DEL-MIGOS</div>
    <h2 style="color:#F2EDE4;font-weight:400;">Booking Cancellation Confirmed</h2>
    <p style="color:#A89880;">Dear ${booking.guestName}, your booking <strong style="color:#BFA16A;">${booking.ref}</strong> for ${booking.roomName} (${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}) has been successfully cancelled.</p>
    <p style="color:#A89880;">If you did not request this cancellation or would like to make a new booking, please contact our team at +234 1 700 64467.</p>
  </div>
</body>`
  };
}

export function adminNewBookingAlert(booking) {
  return {
    subject: `🔔 New Booking — ${booking.ref} | ₦${Number(booking.totalAmount).toLocaleString()}`,
    html: `
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:1rem;">
  <div style="max-width:500px;margin:0 auto;background:#fff;padding:2rem;border-radius:4px;">
    <h2 style="color:#BFA16A;">New Booking Received</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Reference</td><td style="color:#333;font-weight:bold;">${booking.ref}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Guest</td><td style="color:#333;">${booking.guestName}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Email</td><td style="color:#333;">${booking.email}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Phone</td><td style="color:#333;">${booking.phone}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Room</td><td style="color:#333;">${booking.roomName}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Check In</td><td style="color:#333;">${booking.checkIn}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Check Out</td><td style="color:#333;">${booking.checkOut}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;border-bottom:1px solid #eee;">Nights</td><td style="color:#333;">${booking.nights}</td></tr>
      <tr><td style="padding:0.5rem 0;color:#666;">Total Paid</td><td style="color:#BFA16A;font-weight:bold;font-size:1.2rem;">₦${Number(booking.totalAmount).toLocaleString()}</td></tr>
    </table>
    <p style="color:#666;font-size:0.8rem;margin-top:1.5rem;">Payment via Flutterwave · TX: ${booking.transactionId || 'Pending'}</p>
  </div>
</body>`
  };
}

function detailRow(label, value, bold = false) {
  return `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
    <span style="color:#6A6050;font-size:0.78rem;">${label}</span>
    <span style="color:${bold ? '#BFA16A' : '#F2EDE4'};font-size:0.78rem;font-weight:${bold ? '600' : '400'};text-align:right;max-width:60%;">${value}</span>
  </div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}
