import React from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuditLogOut } from '@/types/api';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { formatDateTime } from '@/utils/formatters';

interface AuditModalProps {
  visible: boolean;
  logs: AuditLogOut[];
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ visible, logs, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Session Audit Trail</Text>
              <Text style={styles.subtitle}>Immutable backend record of all actions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                {index < logs.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.actionText}>{item.action.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.timeText}>{formatDateTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.actorText}>Actor: {item.actor}</Text>
                  {item.detail && (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailText}>
                        {JSON.stringify(item.detail, null, 2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No audit entries recorded for this session yet.</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 4,
    marginRight: Spacing.md,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 18,
    bottom: -Spacing.lg,
    width: 2,
    backgroundColor: Colors.border,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  actorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  detailBox: {
    backgroundColor: Colors.borderLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: 6,
  },
  detailText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Spacing.xl,
  },
});
