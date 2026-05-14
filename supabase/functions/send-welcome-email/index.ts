// Supabase Edge Function: send-welcome-email
// Envoie un email de bienvenue personnalisé via Resend API
// lors de la création d'un nouveau client par l'admin.
//
// Variables d'environnement requises dans Supabase (Settings > Edge Functions > Secrets) :
//   RESEND_API_KEY  = re_xxxxxxxxxxxxxxxx
//   RESEND_FROM     = "Sof Pain <commandes@sofpain.com>"  (une fois le domaine vérifié dans Resend)
//
// ⚠️  Pendant que le domaine sofpain.com est en attente de vérification DNS,
//      laisser RESEND_FROM vide → l'email sera envoyé depuis onboarding@resend.dev (mode test Resend)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const CREATE_PASSWORD_URL = 'https://commande.sofpain.com/create-password';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, nom, prenom, nom_societe } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Génération du lien de création de mot de passe via Admin API Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: CREATE_PASSWORD_URL,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Erreur génération lien:', linkError);
      return new Response(JSON.stringify({ error: linkError?.message || 'Impossible de générer le lien' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actionLink = linkData.properties.action_link;
    const prenom_affiche = prenom || '';
    const nom_affiche = nom || '';
    const civilite = prenom_affiche || nom_affiche
      ? `${prenom_affiche} ${nom_affiche}`.trim()
      : 'cher client';

    // Template HTML email de bienvenue
    const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bienvenue chez Sof Pain</title>
</head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#C9411A 0%,#E85D04 100%);padding:40px 32px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🥐</div>
              <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Sof Pain</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;letter-spacing:1px;text-transform:uppercase;">Espace Commandes Professionnels</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 16px;color:#1A1A2E;font-size:22px;font-weight:700;">Bienvenue, ${civilite} ! 👋</h2>
              
              ${nom_societe ? `<p style="margin:0 0 8px;color:#6B7280;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${nom_societe}</p>` : ''}
              
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Votre compte professionnel <strong>Sof Pain</strong> a été créé par notre équipe. 
                Vous pouvez maintenant accéder à votre espace de commandes en ligne.
              </p>

              <div style="background:#FFF8F5;border:1px solid #FDDCCC;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#C9411A;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 Ce que vous pouvez faire</p>
                <ul style="margin:0;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">
                  <li>Passer vos commandes 24h/24</li>
                  <li>Consulter vos commandes passées</li>
                  <li>Gérer votre profil</li>
                </ul>
              </div>

              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                Pour commencer, cliquez sur le bouton ci-dessous pour créer votre mot de passe :
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${actionLink}" 
                       style="display:inline-block;background:linear-gradient(135deg,#C9411A,#E85D04);color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;letter-spacing:0.3px;">
                      🔐 Créer mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#9CA3AF;font-size:13px;text-align:center;line-height:1.6;">
                Ce lien est valable <strong>24 heures</strong>.<br/>
                Si vous n'êtes pas à l'origine de ce compte, ignorez cet email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:24px 32px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6;">
                © ${new Date().getFullYear()} Sof Pain · Tous droits réservés<br/>
                <a href="https://commande.sofpain.com" style="color:#E85D04;text-decoration:none;">commande.sofpain.com</a>
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
        subject: '🥐 Bienvenue chez Sof Pain — Créez votre mot de passe',
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Erreur Resend:', resendData);
      return new Response(JSON.stringify({ error: 'Erreur envoi email', details: resendData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
