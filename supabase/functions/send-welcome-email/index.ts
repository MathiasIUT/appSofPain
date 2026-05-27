
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const CREATE_PASSWORD_URL = 'https://app.sofpain.com/create-password';

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
    const { email, nom, prenom, nom_societe, mode = 'first_login' } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Génération du lien de création de mot de passe via Admin API Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const redirectUrl = mode === 'reset_password' ? 'https://app.sofpain.com/reset-password' : CREATE_PASSWORD_URL;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Erreur génération lien:', linkError);
      return new Response(JSON.stringify({ error: linkError?.message || 'Impossible de générer le lien' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const actionLink = linkData.properties.action_link;
    const prenom_affiche = prenom || '';
    const nom_affiche = nom || '';
    const civilite = prenom_affiche || nom_affiche
      ? `${prenom_affiche} ${nom_affiche}`.trim()
      : 'cher client';


    const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Sof Pain</title>
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:60px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.04);">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding:48px 40px 32px 40px;">
              <img src="https://zoemyisrqqfybgfnnlay.supabase.co/storage/v1/object/public/products/logo1.png" alt="Sof Pain" width="160" style="display:block;height:auto;margin:0 auto;" />
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:0 48px 48px 48px;">
              <h1 style="margin:0 0 24px 0;color:#111827;font-size:24px;font-weight:700;line-height:1.3;text-align:center;">Bienvenue, ${civilite}</h1>
              ${nom_societe ? `<p style="margin:0 0 32px 0;color:#6B7280;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-align:center;">${nom_societe}</p>` : ''}
              
              <p style="margin:0 0 24px 0;color:#374151;font-size:16px;line-height:1.6;text-align:left;">
                Votre compte professionnel <strong>Sof Pain</strong> a été créé avec succès. Vous pouvez dès à présent accéder à votre espace de commandes en ligne.
              </p>
              
              <p style="margin:0 0 40px 0;color:#374151;font-size:16px;line-height:1.6;text-align:left;">
                Afin de sécuriser votre compte, merci de définir votre mot de passe en cliquant sur le bouton ci-dessous :
              </p>
              
              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${actionLink}" style="display:inline-block;background-color:#C9411A;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:16px 36px;border-radius:8px;">Créer mon mot de passe</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:40px 0 0 0;color:#9CA3AF;font-size:14px;line-height:1.5;text-align:center;">
                Ce lien de sécurité est valide pendant 24 heures.<br>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F3F4F6;padding:24px 48px;text-align:center;">
              <p style="margin:0 0 8px 0;color:#6B7280;font-size:12px;line-height:1.5;font-weight:500;">
                Sof Pain &mdash; L'artisan des professionnels
              </p>
              <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Sof Pain. Tous droits réservés.<br/>
                <a href="https://app.sofpain.com" style="color:#C9411A;text-decoration:none;">app.sofpain.com</a>
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

    // Envoi via Resend API
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [email],
        subject: 'Bienvenue chez Sof Pain — Créez votre mot de passe',
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Erreur Resend:', resendData);
      return new Response(JSON.stringify({ error: 'Erreur envoi email', details: resendData }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
