import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { email, clientName, monthLabel, pdfBase64 } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email du destinataire requis' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'commandes@sofpain.com';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée sur le serveur' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Votre bon de commande mensuel Sof Pain</title>
</head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background:#C9411A;padding:30px;text-align:center;">
              <h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:800;">Sof Pain</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Bonjour Mr ${clientName},
              </p>
              
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Veuillez trouver ci-joint votre bon de commande mensuel pour <strong>${monthLabel}</strong>.
              </p>

              <p style="margin:40px 0 0;color:#6B7280;font-size:14px;line-height:1.6;">
                Cordialement,<br/>
                L'équipe <strong>Sof Pain</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;color:#9CA3AF;font-size:12px;">
                © ${new Date().getFullYear()} Sof Pain · <a href="https://commande.sofpain.com" style="color:#C9411A;text-decoration:none;">commande.sofpain.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const resendPayload: any = {
      from: resendFrom,
      to: [email],
      subject: `🥐 Votre bon de commande mensuel Sof Pain — ${monthLabel}`,
      html: htmlBody,
    };

    // Ajout de la pièce jointe si fournie
    if (pdfBase64) {
      const cleanBase64 = pdfBase64.includes('base64,') 
        ? pdfBase64.split('base64,')[1] 
        : pdfBase64;

      resendPayload.attachments = [
        {
          filename: `bon_mensuel_${monthLabel.replace(/\s+/g, '_')}.pdf`,
          content: cleanBase64,
        }
      ];
    }

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Erreur Resend:', resendData);
      return new Response(JSON.stringify({ error: 'Erreur Resend', details: resendData }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
