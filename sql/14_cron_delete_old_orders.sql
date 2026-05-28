
--Suppression Automatique des Commandes (45 jours)

CREATE EXTENSION IF NOT EXISTS pg_cron;

--Créer une fonction de nettoyage
CREATE OR REPLACE FUNCTION public.delete_old_orders()
RETURNS void AS $$
BEGIN
  -- Supprimer toutes les commandes datant strictement de plus de 45 jours
  -- (Grâce à ON DELETE CASCADE sur order_items, les produits liés seront aussi supprimés)
  DELETE FROM public.orders 
  WHERE date_commande < NOW() - INTERVAL '45 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Planifier la tâche avec pg_cron (tous les jours à minuit)
-- On nettoie l'ancienne version si elle existe avant de la recréer
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'delete_old_orders_job';

SELECT cron.schedule(
  'delete_old_orders_job',  -- Nom unique de la tâche
  '0 0 * * *',              -- Expression cron : Tous les jours à 00:00
  'SELECT public.delete_old_orders();'
);

-- Pour vérifier l'état des tâches cron :
-- SELECT * FROM cron.job;

-- Pour vérifier l'historique d'exécution :
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
