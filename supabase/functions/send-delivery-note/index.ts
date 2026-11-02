import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return jsonResponse({ error: 'Connexion requise.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'commandes@sofpain.com';
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      console.error('Configuration manquante pour l’envoi des bons de livraison.');
      return jsonResponse({ error: 'Le service d’envoi des bons de livraison est indisponible.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Session invalide.' }, 401);

    const { order_id: orderId } = await req.json();
    if (typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return jsonResponse({ error: 'Identifiant de commande invalide.' }, 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: profile, error: profileError }, { data: order, error: orderError }] = await Promise.all([
      serviceClient.from('profiles').select('role, actif').eq('id', user.id).single(),
      serviceClient.from('orders').select(`
        id, numero, client_id, livreur_id, statut, deleted_at,
        delivered_at, date_livraison_reelle, adresse_livraison,
        client:profiles!client_id(nom_societe, nom, prenom),
        order_items(product_nom, quantite, prix_unitaire_ht, sous_total_ht)
      `).eq('id', orderId).single(),
    ]);

    if (profileError || !profile || profile.actif === false
      || !['admin', 'livreur', 'client'].includes(profile.role)) {
      return jsonResponse({ error: 'Accès interdit.' }, 403);
    }
    if (orderError || !order || order.deleted_at || order.statut !== 'livree') {
      return jsonResponse({ error: 'Commande livrée introuvable.' }, 404);
    }

    if (profile.role === 'client' && order.client_id !== user.id) {
      return jsonResponse({ error: 'Cette commande ne vous appartient pas.' }, 403);
    }

    if (profile.role === 'livreur') {
      const { data: driver, error: driverError } = await serviceClient
        .from('livreurs')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (driverError || !driver || driver.id !== order.livreur_id) {
        return jsonResponse({ error: 'Cette commande ne fait pas partie de votre tournée.' }, 403);
      }
    }

    const { data: deliveryNote, error: noteError } = await serviceClient
      .from('delivery_notes')
      .select('storage_path, email_sent_at')
      .eq('order_id', orderId)
      .single();
    if (noteError || !deliveryNote) {
      return jsonResponse({ error: 'Le bon de livraison enregistré est introuvable.' }, 404);
    }
    if (deliveryNote.email_sent_at) {
      return jsonResponse({ success: true, alreadySent: true });
    }

    const { data: clientAuth, error: clientAuthError } = await serviceClient.auth.admin.getUserById(order.client_id);
    const clientEmail = clientAuth.user?.email;
    if (clientAuthError || !clientEmail || !clientAuth.user?.email_confirmed_at) {
      return jsonResponse({ error: 'Le compte client ne possède pas d’adresse e-mail vérifiée.' }, 422);
    }

    const { data: pdfFile, error: pdfError } = await serviceClient.storage
      .from('delivery-notes')
      .download(deliveryNote.storage_path);
    if (pdfError || !pdfFile) {
      console.error('PDF du bon introuvable :', pdfError);
      return jsonResponse({ error: 'Le PDF du bon de livraison est introuvable.' }, 500);
    }

    const clientName = order.client?.nom_societe
      || [order.client?.prenom, order.client?.nom].filter(Boolean).join(' ')
      || 'Client';
    const deliveredAt = order.delivered_at
      ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(order.delivered_at))
      : 'date non renseignée';
    const itemRows = (order.order_items || []).map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.product_nom)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;">${escapeHtml(item.quantite)}</td>
      </tr>
    `).join('');
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;color:#222;max-width:640px;margin:auto;">
        <h2>Bon de livraison — commande n° ${escapeHtml(order.numero)}</h2>
        <p>Bonjour ${escapeHtml(clientName)},</p>
        <p>Votre livraison a été validée le <strong>${escapeHtml(deliveredAt)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="text-align:left;padding:8px;">Produit</th><th style="text-align:right;padding:8px;">Quantité</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        ${order.adresse_livraison ? `<p>Adresse de livraison :<br>${escapeHtml(order.adresse_livraison).replace(/\n/g, '<br>')}</p>` : ''}
        <p>Le bon de livraison est joint à cet e-mail et reste disponible dans votre espace client.</p>
        <p>Cordialement,<br>L’équipe Sof Pain</p>
      </div>
    `;

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `delivery-note-${orderId}`,
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [clientEmail],
        subject: `Bon de livraison Sof Pain — commande n° ${order.numero}`,
        html: emailHtml,
        attachments: [{
          filename: `bon_livraison_${order.numero}.pdf`,
          content: toBase64(new Uint8Array(await pdfFile.arrayBuffer())),
        }],
      }),
    });

    const resendResult = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Erreur Resend pour le bon de livraison :', resendResult);
      const { error: recordError } = await serviceClient.from('delivery_notes')
        .update({ email_error: 'Échec de l’envoi par Resend.' })
        .eq('order_id', orderId);
      if (recordError) console.error('Erreur enregistrement échec e-mail :', recordError);
      return jsonResponse({ error: 'Le bon est enregistré, mais son e-mail n’a pas pu être envoyé.' }, 502);
    }

    const { error: updateError } = await serviceClient.from('delivery_notes')
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq('order_id', orderId);
    if (updateError) {
      console.error('E-mail envoyé mais statut d’envoi non enregistré :', updateError);
      return jsonResponse({ error: 'L’e-mail est parti, mais son statut n’a pas pu être enregistré.' }, 500);
    }

    return jsonResponse({ success: true, id: resendResult.id });
  } catch (error) {
    console.error('Erreur envoi bon de livraison :', error);
    return jsonResponse({ error: 'Impossible d’envoyer le bon de livraison.' }, 500);
  }
});
