import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';

// ─── Constantes ──────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MEDALS = ['①', '②', '③', '④', '⑤'];



const fmtEur = (v) =>
  Number(v ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtEurCompact = (v) => {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M€';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' k€';
  return fmtEur(n);
};

const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminStatsScreen() {
  const [allOrders, setAllOrders] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // ── État période ────────────────────────────────────────────
  // mode : 'today' (aujourd'hui) | 'year' (année) | 'all' (tout) | 'custom' (personnalisé)
  // custom = plage de mois dans l'année sélectionnée
  const [periodMode, setPeriodMode] = useState('custom');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [rangeStart, setRangeStart] = useState(currentMonth);
  const [rangeEnd, setRangeEnd] = useState(currentMonth);
  // 'idle'      = plage complète sélectionnée
  // 'start-set' = début choisi, en attente de la fin de la plage plage
  const [rangeState, setRangeState] = useState('idle');

  // ── Chargement ─────────────────────────────────────────────
  // Calcule les bornes de date selon la période sélectionnée
  const getDateBounds = useCallback(() => {
    const n = new Date();
    if (periodMode === 'today') {
      const from = new Date(n.getFullYear(), n.getMonth(), n.getDate());
      const to = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (periodMode === 'year') {
      const from = new Date(selectedYear, 0, 1);
      const to = new Date(selectedYear + 1, 0, 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (periodMode === 'all') return null; // pas de filtre
    // custom
    const effectiveEnd = rangeState === 'start-set' ? rangeStart : rangeEnd;
    const from = new Date(selectedYear, rangeStart - 1, 1);
    const to = new Date(selectedYear, effectiveEnd, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [periodMode, selectedYear, rangeStart, rangeEnd, rangeState]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const bounds = getDateBounds();

      // 1. Charger les commandes filtrées par période (côté serveur)
      let ordersQuery = supabase
        .from('orders')
        .select('id, client_id, client_nom, statut, date_commande, total_ht, total_ttc, total_tva, client:profiles!client_id(nom, prenom, nom_societe)')
        .order('date_commande', { ascending: false });

      if (bounds) {
        ordersQuery = ordersQuery.gte('date_commande', bounds.from).lt('date_commande', bounds.to);
      }

      const ordersRes = await ordersQuery;
      if (ordersRes.error) throw ordersRes.error;
      const orders = ordersRes.data || [];
      setAllOrders(orders);

      // 2. Charger les order_items seulement pour les commandes filtrées
      if (orders.length > 0) {
        const orderIds = orders.map((o) => o.id);
        // Supabase .in() a une limite, on batch si nécessaire
        const BATCH_SIZE = 200;
        let allItemsData = [];
        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
          const batch = orderIds.slice(i, i + BATCH_SIZE);
          const { data: itemsData, error: itemsErr } = await supabase
            .from('order_items')
            .select('order_id, product_nom, quantite, sous_total_ht')
            .in('order_id', batch);
          if (itemsErr) throw itemsErr;
          allItemsData = allItemsData.concat(itemsData || []);
        }
        setAllItems(allItemsData);
      } else {
        setAllItems([]);
      }
    } catch (err) {
      console.error('Erreur chargement stats :', err);
    } finally {
      setLoading(false);
    }
  }, [getDateBounds]);

  // Recharger quand la période change
  useEffect(() => { loadData(); }, [periodMode, selectedYear, rangeStart, rangeEnd, rangeState]);

  // Les données sont déjà filtrées côté serveur, plus besoin de filtrage JavaScript local
  const orders = allOrders;
  const items = allItems;

  // ── Handlers ────────────────────────────────────────────────
  const selectQuick = (mode) => {
    setPeriodMode(mode);
    setRangeState('idle');
  };

  const handleMonthTap = (month) => {
    setPeriodMode('custom');
    if (rangeState === 'idle') {
      setRangeStart(month);
      setRangeEnd(month);
      setRangeState('start-set');
    } else {
      setRangeStart(Math.min(month, rangeStart));
      setRangeEnd(Math.max(month, rangeStart));
      setRangeState('idle');
    }
  };

  const handleYearChange = (delta) => {
    const y = selectedYear + delta;
    if (y < 2020 || y > currentYear + 1) return;
    setSelectedYear(y);
    if (periodMode !== 'today' && periodMode !== 'all') {
      setPeriodMode('custom');
      setRangeState('idle');
    }
  };

  // ── Description lisible ─────────────────────────────────────
  const periodDescription = useMemo(() => {
    if (periodMode === 'today') {
      return `Aujourd'hui — ${now.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })}`;
    }
    if (periodMode === 'year') return `Toute l'année ${selectedYear}`;
    if (periodMode === 'all') return 'Toutes les commandes, toutes périodes';
    // custom
    if (rangeState === 'start-set') {
      return `Début : ${MONTH_FULL[rangeStart - 1]} — sélectionnez la fin…`;
    }
    if (rangeStart === rangeEnd) return `${MONTH_FULL[rangeStart - 1]} ${selectedYear}`;
    return (
      `1 ${MONTH_FULL[rangeStart - 1]} — ` +
      `${lastDayOfMonth(selectedYear, rangeEnd)} ${MONTH_FULL[rangeEnd - 1]} ${selectedYear}`
    );
  }, [periodMode, selectedYear, rangeStart, rangeEnd, rangeState]);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const caTtc = orders.reduce((s, o) => s + Number(o.total_ttc ?? 0), 0);
    const nbCmds = orders.length;
    const panierMoy = nbCmds > 0 ? caTtc / nbCmds : 0;
    const clientsActifs = new Set(orders.map((o) => o.client_id)).size;
    return { caTtc, nbCmds, panierMoy, clientsActifs };
  }, [orders]);

  // ── CA par mois ────────────────────────────────────────────
  const caParMois = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const d = new Date(o.date_commande);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + Number(o.total_ttc ?? 0);
    });
    const keys = Object.keys(map).sort();
    const last12 = keys.slice(-12);
    return last12.map((k) => {
      const [year, month] = k.split('-');
      return {
        label: MONTH_SHORT[parseInt(month, 10) - 1] + (last12.length > 6 ? ` ${year.slice(2)}` : ''),
        value: map[k],
      };
    });
  }, [orders]);



  // ── Top produits ───────────────────────────────────────────
  const topProduits = useMemo(() => {
    const map = {};
    items.forEach(it => {
      if (!map[it.product_nom]) map[it.product_nom] = { quantite: 0, caHt: 0 };
      map[it.product_nom].quantite += Number(it.quantite ?? 0);
      map[it.product_nom].caHt += Number(it.sous_total_ht ?? 0);
    });
    return Object.entries(map)
      .map(([nom, val]) => ({ nom, ...val }))
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);
  }, [items]);

  // ── Top clients ────────────────────────────────────────────
  const topClients = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const id = o.client_id || `deleted-${o.client_nom || 'inconnu'}`;
      if (!map[id]) {
        const c = o.client || {};
        map[id] = {
          nom: c.nom_societe || [c.prenom, c.nom].filter(Boolean).join(' ') || o.client_nom || '— Client supprimé —',
          nbCmds: 0,
          caTtc: 0,
        };
      }
      map[id].nbCmds += 1;
      map[id].caTtc += Number(o.total_ttc ?? 0);
    });
    return Object.values(map)
      .sort((a, b) => b.caTtc - a.caTtc)
      .slice(0, 5);
  }, [orders]);

  // ── Rendu ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des statistiques…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSub}>
            {orders.length} commande{orders.length !== 1 ? 's' : ''} sur la période
          </Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.7}>
          <Text style={styles.refreshText}>↻ Actualiser</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sélecteur de période ────────────────────────────── */}
      <View style={styles.periodPicker}>

        {/* Raccourcis rapides */}
        <View style={styles.quickRow}>
          {[
            { key: 'today', label: "Aujourd'hui" },
            { key: 'year', label: 'Toute l\'année' },
            { key: 'all', label: 'Tout' },
          ].map((q) => {
            const active = periodMode === q.key;
            return (
              <TouchableOpacity
                key={q.key}
                style={[styles.quickChip, active && styles.quickChipActive]}
                onPress={() => selectQuick(q.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.quickLabel, active && styles.quickLabelActive]}>
                  {q.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Navigation d'année */}
        <View style={styles.yearNav}>
          <TouchableOpacity
            onPress={() => handleYearChange(-1)}
            disabled={selectedYear <= 2020}
            style={[styles.yearArrow, selectedYear <= 2020 && styles.yearArrowDisabled]}
            activeOpacity={0.7}
          >
            <Text style={styles.yearArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.yearLabel}>{selectedYear}</Text>
          <TouchableOpacity
            onPress={() => handleYearChange(1)}
            disabled={selectedYear >= currentYear + 1}
            style={[styles.yearArrow, selectedYear >= currentYear + 1 && styles.yearArrowDisabled]}
            activeOpacity={0.7}
          >
            <Text style={styles.yearArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Grille des mois — 4 par ligne */}
        <View style={styles.monthGrid}>
          {MONTH_SHORT.map((m, i) => {
            const monthNum = i + 1;
            const isCustom = periodMode === 'custom';
            const isStart = isCustom && monthNum === rangeStart;
            const isEnd = isCustom && rangeState === 'idle' && monthNum === rangeEnd;
            const inRange = isCustom && rangeState === 'idle'
              && monthNum >= rangeStart && monthNum <= rangeEnd;
            const isPicking = isCustom && rangeState === 'start-set' && monthNum === rangeStart;

            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.monthChip,
                  inRange && styles.monthInRange,
                  (isStart || isEnd || isPicking) && styles.monthEndpoint,
                ]}
                onPress={() => handleMonthTap(monthNum)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.monthLabel,
                  inRange && styles.monthLabelInRange,
                  (isStart || isEnd || isPicking) && styles.monthLabelEndpoint,
                ]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description de la période sélectionnée */}
        <View style={styles.periodDescRow}>
          <Text style={[styles.periodDesc, rangeState === 'start-set' && styles.periodDescPicking]}>
            {periodDescription}
          </Text>
          {rangeState === 'start-set' && (
            <Text style={styles.periodHint}>Touchez un mois pour définir la fin de la période</Text>
          )}
        </View>
      </View>

      {/* ── Contenu stats ───────────────────────────────────── */}
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>Aucune commande sur cette période.</Text>
        </View>
      ) : (
        <>
          {/* KPIs */}
          <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
            <KpiCard label="Chiffre d'affaires TTC" value={fmtEur(kpis.caTtc)} accent />
            <KpiCard label="Commandes" value={String(kpis.nbCmds)} />
            <KpiCard label="Panier moyen" value={fmtEur(kpis.panierMoy)} />
            <KpiCard label="Clients actifs" value={String(kpis.clientsActifs)} />
          </View>

          {/* CA mensuel */}
          {caParMois.length > 0 && (
            <Section title="Chiffre d'affaires mensuel (TTC)">
              <BarChart data={caParMois} />
            </Section>
          )}

          {/* Top 5 */}
          <View style={[styles.tablesRow, isDesktop && styles.tablesRowDesktop]}>
            {topProduits.length > 0 && (
              <Section title="Top 5 produits — unités commandées" flex>
                <RankTable
                  columns={['Produit', 'Unités', 'CA HT']}
                  rows={topProduits.map((p, i) => [
                    `${MEDALS[i]} ${p.nom}`,
                    String(p.quantite),
                    fmtEurCompact(p.caHt),
                  ])}
                  aligns={['left', 'right', 'right']}
                />
              </Section>
            )}
            {topClients.length > 0 && (
              <Section title="Top 5 clients — chiffre d'affaires" flex>
                <RankTable
                  columns={['Client', 'Cmds', 'CA TTC']}
                  rows={topClients.map((c, i) => [
                    `${MEDALS[i]} ${c.nom}`,
                    String(c.nbCmds),
                    fmtEurCompact(c.caTtc),
                  ])}
                  aligns={['left', 'right', 'right']}
                />
              </Section>
            )}
          </View>
        </>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Section({ title, children, flex }) {
  return (
    <View style={[styles.section, flex && styles.sectionFlex]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <View style={[styles.kpiCard, accent && styles.kpiCardAccent]}>
      <Text style={[styles.kpiValue, accent && styles.kpiValueAccent]}>{value}</Text>
      <Text style={[styles.kpiLabel, accent && styles.kpiLabelAccent]}>{label}</Text>
    </View>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const BAR_HEIGHT = 160;
  return (
    <View style={chart.container}>
      {data.map((d, i) => {
        const barH = Math.max(Math.round((d.value / max) * BAR_HEIGHT), 4);
        return (
          <View key={i} style={chart.col}>
            <Text style={chart.barValue}>{fmtEurCompact(d.value)}</Text>
            <View style={[chart.bar, { height: barH }]} />
            <Text style={chart.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}



function RankTable({ columns, rows, aligns }) {
  return (
    <View style={table.container}>
      <View style={table.head}>
        {columns.map((col, i) => (
          <Text key={i} style={[table.th, { flex: i === 0 ? 3 : 1.5, textAlign: aligns[i] }]}>
            {col}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[table.row, ri % 2 === 1 && table.rowAlt]}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[table.td, { flex: ci === 0 ? 3 : 1.5, textAlign: aligns[ci] }]}
              numberOfLines={1}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, width: '100%' },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSizes.sm },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  refreshBtn: { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

  // ── Period picker card ─────────────────────────────────────
  periodPicker: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },

  // Quick chips
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  quickChipActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
  quickLabel: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textSecondary },
  quickLabelActive: { color: colors.primary, fontWeight: '700' },

  // Year nav
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  yearArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.round,
    backgroundColor: colors.secondary,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  yearArrowDisabled: { opacity: 0.25 },
  yearArrowText: { fontSize: fontSizes.xl, color: colors.primary, fontWeight: '700' },
  yearLabel: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 56,
    textAlign: 'center',
  },

  // Grille des mois — 4 colonnes
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    flexBasis: '22%',
    flexGrow: 1,
    maxWidth: '25%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  monthInRange: { backgroundColor: colors.secondary, borderColor: colors.primaryLight },
  monthEndpoint: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthLabel: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textSecondary },
  monthLabelInRange: { color: colors.primary, fontWeight: '600' },
  monthLabelEndpoint: { color: '#fff', fontWeight: '700' },

  // Description de la période sélectionnée
  periodDescRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  periodDesc: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  periodDescPicking: { color: colors.textSecondary, fontStyle: 'italic', fontWeight: '400' },
  periodHint: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // État vide (aucun résultat)
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: fontSizes.md, color: colors.textSecondary },

  // Grille de KPI (indicateurs clés)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiGridDesktop: { flexWrap: 'nowrap' },
  kpiCard: {
    flex: 1, flexBasis: '47%', flexShrink: 1, minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    gap: 4,
    ...shadows.sm,
  },
  kpiCardAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  kpiValue: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  kpiValueAccent: { fontSize: fontSizes.xxl, fontWeight: '800', color: '#fff' },
  kpiLabel: {
    fontSize: fontSizes.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  kpiLabelAccent: { color: 'rgba(255,255,255,0.8)' },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionFlex: { flex: 1 },
  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: colors.primary, marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm,
  },

  tablesRow: { gap: spacing.lg },
  tablesRowDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
});

const chart = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-around', height: 220, gap: 4,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  bar: { width: '80%', backgroundColor: colors.primary, borderRadius: borderRadius.sm, minHeight: 4 },
  barLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },
});



const table = StyleSheet.create({
  container: { gap: 2 },
  head: {
    flexDirection: 'row', paddingVertical: spacing.xs, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 2,
  },
  th: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderRadius: borderRadius.sm },
  rowAlt: { backgroundColor: colors.secondary },
  td: { fontSize: fontSizes.sm, color: colors.textPrimary },
});