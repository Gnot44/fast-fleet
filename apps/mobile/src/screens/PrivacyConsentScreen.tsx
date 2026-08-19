import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  MapPin,
  Database,
  Lock,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react-native';

export default function PrivacyConsentScreen({ navigation }: any) {
  const [agreed, setAgreed] = useState(true);

  const handleAccept = () => {
    if (agreed) {
      navigation.navigate('Dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Consent Modal Card */}
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <ShieldCheck size={36} color="#1D4ED8" />
          </View>

          {/* Title & Body */}
          <Text style={styles.title}>Privacy & GPS Consent</Text>
          <Text style={styles.description}>
            This application collects real-time vehicle GPS telemetry and route milestones during scheduled delivery shifts to ensure driver safety and verify customer drop-offs.
          </Text>

          {/* Points List */}
          <View style={styles.pointsContainer}>
            <View style={styles.pointRow}>
              <MapPin size={18} color="#1D4ED8" />
              <Text style={styles.pointText}>Real-time location active only while on duty</Text>
            </View>
            <View style={styles.pointRow}>
              <Database size={18} color="#1D4ED8" />
              <Text style={styles.pointText}>Encrypted telemetry retained securely for 90 days</Text>
            </View>
            <View style={styles.pointRow}>
              <Lock size={18} color="#1D4ED8" />
              <Text style={styles.pointText}>Accessible strictly by authorized fleet dispatchers</Text>
            </View>
          </View>

          {/* Agreement Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
          >
            {agreed ? (
              <CheckSquare size={20} color="#1D4ED8" />
            ) : (
              <Square size={20} color="#CBD5E1" />
            )}
            <Text style={styles.checkboxText}>
              I acknowledge and agree to operational GPS tracking.
            </Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.acceptButton, !agreed && { opacity: 0.5 }]}
              onPress={handleAccept}
              disabled={!agreed}
              activeOpacity={0.9}
            >
              <Text style={styles.acceptButtonText}>Accept & Enter Portal</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.declineButtonText}>Decline & Return to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0E3E6',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29, 78, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#03246B',
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  pointsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkboxText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  acceptButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  declineButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
