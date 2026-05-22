import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async (req: Request) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé - Jeton manquant' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé - Authentification invalide' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Interdit - Accès administrateur requis' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { email, clientName, monthLabel, pdfBase64 } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email du destinataire requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'commandes@sofpain.com';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée sur le serveur' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Votre bon mensuel Sof Pain</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:48px 40px 32px 40px;">
              <img src="https://zoemyisrqqfybgfnnlay.supabase.co/storage/v1/object/public/products/logo1.png" alt="Sof Pain" width="160" style="display:block;height:auto;margin:0 auto;" />
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:0 40px 40px 40px;">
              <h2 style="margin:0 0 24px 0;color:#111827;font-size:22px;font-weight:700;text-align:center;">Bon Mensuel</h2>

              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Bonjour ${clientName},
              </p>

              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Veuillez trouver en pièce jointe votre bon de commande mensuel pour la période de <strong>${monthLabel}</strong>.
              </p>

              <p style="margin:40px 0 0;color:#6B7280;font-size:15px;line-height:1.6;">
                Cordialement,<br/>
                <strong>L'équipe Sof Pain</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:24px 40px;text-align:center;border-top:1px solid #F3F4F6;">
              <p style="margin:0;color:#9CA3AF;font-size:13px;">
                © ${new Date().getFullYear()} Sof Pain · <a href="https://app.sofpain.com" style="color:#C9411A;text-decoration:none;">app.sofpain.com</a>
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
      subject: `Votre bon de commande mensuel Sof Pain — ${monthLabel}`,
      html: htmlBody,
    };

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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
