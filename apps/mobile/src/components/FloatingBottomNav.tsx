import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutGrid, Calendar, User } from 'lucide-react-native';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../lib/ThemeContext';

export type NavTab = 'dashboard' | 'calendar' | 'profile';

interface FloatingBottomNavProps {
  activeTab: NavTab;
  navigation: any;
}

export default function FloatingBottomNav({
  activeTab,
  navigation,
}: FloatingBottomNavProps) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const navItems = [
    {
      key: 'dashboard' as NavTab,
      label: t('nav_dashboard'),
      route: 'Dashboard',
      icon: LayoutGrid,
    },
    {
      key: 'calendar' as NavTab,
      label: t('nav_calendar'),
      route: 'TripSchedule',
      icon: Calendar,
    },
    {
      key: 'profile' as NavTab,
      label: t('nav_profile'),
      route: 'UserProfile',
      icon: User,
    },
  ];

  const handleTabPress = (item: typeof navItems[0]) => {
    if (activeTab === item.key) {
      return;
    }
    navigation.navigate(item.route);
  };

  // Dynamic bottom calculation accounting for gesture bar vs 3-button bar on Android / home indicator on iOS
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 10);

  return (
    <View
      style={[styles.floatingWrapper, { bottom: bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={[styles.barContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          const IconComponent = item.icon;

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.tabButton,
                isActive && [styles.tabButtonActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => handleTabPress(item)}
              activeOpacity={0.8}
            >
              <IconComponent
                size={isActive ? 18 : 20}
                color={isActive ? '#FFFFFF' : colors.textSecondary}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: colors.textSecondary },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.15}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 999,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 5,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // Premium soft elevation & shadow
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 24,
    gap: 5,
    minWidth: 0,
  },
  tabButtonActive: {
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    flexShrink: 1,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
