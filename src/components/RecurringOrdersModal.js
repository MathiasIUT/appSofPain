import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../config/supabase';
import { borderRadius, colors, fontSizes, spacing } from '../config/theme';

const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR');
const clientName = (client) => client?.nom_societe || [client?.prenom, client?.nom].filter(Boolean).join(' ') || client?.email || 'Client';
const isValidDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

function DateField({ label, value, onChange, minimum }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          min={minimum}
          value={value}
          onChange={(event) => {
            const date = event.target.value;
            if (!date || date >= minimum) onChange(date);
          }}
          style={{
            padding: '9px 10px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            backgroundColor: colors.background,
            fontSize: 14,
          }}
        />
      ) : (
        <TextInput
          style={styles.dateInput}
          value={value}
          onChangeText={(date) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= minimum) onChange(date);
          }}
          placeholder="AAAA-MM-JJ"
          keyboardType="numeric"
        />
      )}
    </View>
  );
}

export default function RecurringOrdersModal({ visible, onClose }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [saving, setSaving] = useState(false);
  const today = todayLocal();

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_schedules')
        .select('*, client:profiles!order_schedules_client_id_fkey(nom, prenom, nom_societe, email), order_schedule_items(product_nom, quantite)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Erreur chargement des programmations :', error);
      if (Platform.OS === 'web') window.alert('Erreur\n\nImpossible de charger les programmations.');
      else Alert.alert('Erreur', 'Impossible de charger les programmations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadSchedules();
  }, [visible, loadSchedules]);

  const beginEdit = (schedule) => {
    setEditingId(schedule.id);
    setStartsOn(schedule.starts_on);
    setEndsOn(schedule.ends_on);
  };

  const saveDates = async (schedule) => {
    if (!isValidDateInput(startsOn) || !isValidDateInput(endsOn) || startsOn < today || endsOn < startsOn) {
      const message = 'La date de début doit être aujourd’hui ou ultérieure, et la date de fin doit être égale ou ultérieure à la date de début.';
      if (Platform.OS === 'web') window.alert(`Dates invalides\n\n${message}`);
      else Alert.alert('Dates invalides', message);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('order_schedules')
        .update({ starts_on: startsOn, ends_on: endsOn })
        .eq('id', schedule.id);
      if (error) throw error;
      setEditingId(null);
      await loadSchedules();
    } catch (error) {
      console.error('Erreur modification programmation :', error);
      if (Platform.OS === 'web') window.alert('Erreur\n\nImpossible de modifier la programmation.');
      else Alert.alert('Erreur', 'Impossible de modifier la programmation.');
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = async (schedule) => {
    const performCancel = async () => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('order_schedules')
          .update({ statut: 'annulee' })
          .eq('id', schedule.id);
        if (error) throw error;
        await loadSchedules();
      } catch (error) {
        console.error('Erreur annulation programmation :', error);
        if (Platform.OS === 'web') window.alert('Erreur\n\nImpossible d’annuler la programmation.');
        else Alert.alert('Erreur', 'Impossible d’annuler la programmation.');
      } finally {
        setSaving(false);
      }
    };
    const message = 'Les commandes déjà créées restent inchangées. Les prochaines commandes ne seront plus générées.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Annuler la programmation ?\n\n${message}`)) await performCancel();
    } else {
      Alert.alert('Annuler la programmation ?', message, [
        { text: 'Garder', style: 'cancel' },
        { text: 'Annuler', style: 'destructive', onPress: performCancel },
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Commandes programmées</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {schedules.length === 0 ? <Text style={styles.empty}>Aucune programmation.</Text> : null}
              {schedules.map((schedule) => (
                <View key={schedule.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.client}>{clientName(schedule.client)}</Text>
                      <Text style={styles.summary}>
                        {formatDate(schedule.starts_on)} → {formatDate(schedule.ends_on)} · {schedule.type_commande === 'surgele' ? 'Surgelé' : 'Frais'}
                      </Text>
                      <Text style={[styles.status, schedule.statut === 'active' ? styles.active : styles.cancelled]}>
                        {schedule.statut === 'active' ? 'En cours' : 'Annulée'}
                      </Text>
                    </View>
                    {schedule.statut === 'active' ? (
                      <View style={styles.actions}>
                        <TouchableOpacity onPress={() => beginEdit(schedule)} style={styles.actionButton}>
                          <Text style={styles.actionText}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => cancelSchedule(schedule)} style={styles.actionButton}>
                          <Text style={[styles.actionText, { color: colors.error }]}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  {(schedule.order_schedule_items || []).map((item, index) => (
                    <Text key={`${schedule.id}-${index}`} style={styles.item}>
                      {item.quantite} × {item.product_nom}
                    </Text>
                  ))}
                  {editingId === schedule.id ? (
                    <View style={styles.editor}>
                      <DateField
                        label="Début"
                        value={startsOn}
                        minimum={today}
                        onChange={(date) => {
                          setStartsOn(date);
                          if (isValidDateInput(date) && date > endsOn) setEndsOn(date);
                        }}
                      />
                      <DateField label="Fin" value={endsOn} minimum={startsOn < today ? today : startsOn} onChange={setEndsOn} />
                      <TouchableOpacity disabled={saving} onPress={() => saveDates(schedule)} style={styles.saveButton}>
                        <Text style={styles.saveText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingId(null)} style={styles.actionButton}>
                        <Text style={styles.actionText}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modal: { width: '100%', maxWidth: 720, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  closeButton: { padding: spacing.xs },
  closeText: { color: colors.textSecondary, fontSize: fontSizes.lg },
  loading: { padding: spacing.xl },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: { textAlign: 'center', padding: spacing.xl, color: colors.textSecondary },
  card: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md },
  cardTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  client: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: '700' },
  summary: { color: colors.textSecondary, marginTop: 4 },
  status: { marginTop: 5, fontSize: fontSizes.xs, fontWeight: '700' },
  active: { color: '#2E7D32' },
  cancelled: { color: colors.error },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { padding: spacing.xs },
  actionText: { color: colors.primary, fontWeight: '600' },
  item: { color: colors.textSecondary, marginTop: 5 },
  editor: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  dateField: { flex: 1, minWidth: 150, gap: 5 },
  dateLabel: { color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: '600' },
  dateInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: 9, color: colors.textPrimary },
  saveButton: { padding: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.sm },
  saveText: { color: '#fff', fontWeight: '700' },
});
