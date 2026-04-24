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
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERIODS = [
  { key: '7j',    label: '7 j',     days: 7 },
  { key: '30j',   label: '30 j',    days: 30 },
  { key: '90j',   label: '90 j',    days: 90 },
  { key: '12m',   label: '12 mois', days: 365 },
  { key: 'tout',  label: 'Tout',    days: null },
];

const STATUS_LABELS = {
  nouvelle:       'Nouvelle',
  en_preparation: 'En préparation',
  en_livraison:   'En livraison',
  livree:         'Livrée',
  annulee:        'Annulée',
};

const STATUS_COLORS = {
  nouvelle:       '#2196F3',
  en_preparation: '#FF9800',
  en_livraison:   '#00BCD4',
  livree:         '#4CAF50',
  annulee:        '#E53935',
};

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MEDALS = ['①', '②', '③', '④', '⑤'];

const fmtEur = (v) =>
  Number(v ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtEurCompact = (v) => {
  const n = Number(v ?? 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M€';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace('.', ',') + ' k€';
  return fmtEur(n);
};

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminStatsScreen() {
  const [allOrders, setAllOrders]   = useState([]);
  const [allItems, setAllItems]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('30j');

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // ── Chargement ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, client:profiles!client_id(nom, prenom, nom_societe)')
          .order('date_commande', { ascending: false }),
        supabase
          .from('order_items')
          .select('order_id, product_nom, quantite_palettes, sous_total_ht'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      setAllOrders(ordersRes.data || []);
      setAllItems(itemsRes.data || []);
    } catch (err) {
      console.error('Erreur chargement stats :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtrage par période ────────────────────────────────────
  const orders = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period);
    if (!p?.days) return allOrders;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - p.days);
    return allOrders.filter((o) => new Date(o.date_commande) >= cutoff);
  }, [allOrders, period]);

  const orderIds = useMemo(() => new Set(orders.map((o) => o.id)), [orders]);

  const items = useMemo(
    () => allItems.filter((it) => orderIds.has(it.order_id)),
    [allItems, orderIds]
  );

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const caTtc    = orders.reduce((s, o) => s + Number(o.total_ttc ?? 0), 0);
    const nbCmds   = orders.length;
    const panierMoy= nbCmds > 0 ? caTtc / nbCmds : 0;
    const clientsActifs = new Set(orders.map((o) => o.client_id)).size;
    return { caTtc, nbCmds, panierMoy, clientsActifs };
  }, [orders]);

  // ── CA par mois ────────────────────────────────────────────
  const caParMois = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const d   = new Date(o.date_commande);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + Number(o.total_ttc ?? 0);
    });
    const keys = Object.keys(map).sort();
    const last12 = keys.slice(-12);
    return last12.map((k) => {
      const [year, month] = k.split('-');
      return {
        label: MONTH_LABELS[parseInt(month, 10) - 1] + (last12.length > 6 ? ` ${year.slice(2)}` : ''),
        value: map[k],
      };
    });
  }, [orders]);

  // ── Statuts ────────────────────────────────────────────────
  const statutStats = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { counts[o.statut] = (counts[o.statut] || 0) + 1; });
    return Object.keys(STATUS_LABELS).map((s) => ({ statut: s, count: counts[s] || 0 }));
  }, [orders]);

  // ── Top produits ───────────────────────────────────────────
  const topProduits = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (!map[it.product_nom]) map[it.product_nom] = { palettes: 0, caHt: 0 };
      map[it.product_nom].palettes += Number(it.quantite_palettes ?? 0);
      map[it.product_nom].caHt    += Number(it.sous_total_ht ?? 0);
    });
    return Object.entries(map)
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a, b) => b.palettes - a.palettes)
      .slice(0, 5);
  }, [items]);

  // ── Top clients ────────────────────────────────────────────
  const topClients = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const id = o.client_id;
      if (!map[id]) {
        const c = o.client || {};
        map[id] = {
          nom: c.nom_societe || [c.prenom, c.nom].filter(Boolean).join(' ') || '—',
          nbCmds: 0,
          caTtc: 0,
        };
      }
      map[id].nbCmds += 1;
      map[id].caTtc  += Number(o.total_ttc ?? 0);
    });
    return Object.values(map)
      .sort((a, b) => b.caTtc - a.caTtc)
      .slice(0, 5);
  }, [orders]);

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
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

      {/* ── Filtre période ──────────────────────────────────── */}
      <View style={styles.periodsRow}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.periodLabel, active && styles.periodLabelActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>Aucune commande sur cette période.</Text>
        </View>
      ) : (
        <>
          {/* ── KPIs ──────────────────────────────────────────── */}
          <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
            <KpiCard label="Chiffre d'affaires TTC" value={fmtEur(kpis.caTtc)}      accent />
            <KpiCard label="Commandes"               value={String(kpis.nbCmds)} />
            <KpiCard label="Panier moyen"            value={fmtEur(kpis.panierMoy)} />
            <KpiCard label="Clients actifs"          value={String(kpis.clientsActifs)} />
          </View>

          {/* ── CA mensuel ────────────────────────────────────── */}
          {caParMois.length > 0 && (
            <Section title="Chiffre d'affaires mensuel (TTC)">
              <BarChart data={caParMois} />
            </Section>
          )}

          {/* ── Statuts ───────────────────────────────────────── */}
          <Section title="Répartition par statut">
            <StatusBars data={statutStats} total={orders.length} />
          </Section>

          {/* ── 2 tableaux côte à côte sur desktop ───────────── */}
          <View style={[styles.tablesRow, isDesktop && styles.tablesRowDesktop]}>
            {topProduits.length > 0 && (
              <Section title="Top 5 produits — palettes commandées" flex>
                <RankTable
                  columns={['Produit', 'Palettes', 'CA HT']}
                  rows={topProduits.map((p, i) => [
                    `${MEDALS[i]} ${p.nom}`,
                    String(p.palettes),
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

function StatusBars({ data, total }) {
  return (
    <View style={status.container}>
      {data.map((d) => {
        const pct = total > 0 ? (d.count / total) * 100 : 0;
        const c   = STATUS_COLORS[d.statut];
        if (d.count === 0) return null;
        return (
          <View key={d.statut} style={status.row}>
            <Text style={status.label}>{STATUS_LABELS[d.statut]}</Text>
            <View style={status.barWrap}>
              <View style={[status.bar, { width: `${Math.max(pct, 2)}%`, backgroundColor: c }]} />
            </View>
            <Text style={[status.count, { color: c }]}>{d.count}</Text>
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
          <Text
            key={i}
            style={[table.th, { flex: i === 0 ? 3 : 1.5, textAlign: aligns[i] }]}
          >
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
  content:   { padding: spacing.lg, paddingBottom: spacing.xxl },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%' },

  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSizes.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.textPrimary },
  headerSub:   { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  refreshBtn:  { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '500' },

  periodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  periodChipActive:  { borderColor: colors.primary, backgroundColor: colors.secondary },
  periodLabel:       { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textSecondary },
  periodLabelActive: { color: colors.primary, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: fontSizes.md, color: colors.textSecondary },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiGridDesktop: { flexWrap: 'nowrap' },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  kpiCardAccent:  { backgroundColor: colors.primary, borderColor: colors.primary },
  kpiValue:       { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  kpiValueAccent: { color: colors.white, fontSize: fontSizes.xxl },
  kpiLabel:       { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiLabelAccent: { color: 'rgba(255,255,255,0.8)' },

  // Sections
  section:     { marginBottom: spacing.lg },
  sectionFlex: { flex: 1 },
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Tables row
  tablesRow:       { gap: spacing.lg },
  tablesRowDesktop:{ flexDirection: 'row', alignItems: 'flex-start' },
});

const chart = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 220,
    gap: 4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  bar: {
    width: '80%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});

const status = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label:   { width: 120, fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: '500' },
  barWrap: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: borderRadius.round, overflow: 'hidden' },
  bar:     { height: '100%', borderRadius: borderRadius.round },
  count:   { width: 32, fontSize: fontSizes.sm, fontWeight: '700', textAlign: 'right' },
});

const table = StyleSheet.create({
  container: { gap: 2 },
  head: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  th: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
  },
  rowAlt: { backgroundColor: colors.secondary },
  td:     { fontSize: fontSizes.sm, color: colors.textPrimary },
});
