import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { tokenizePassage } from '@/lib/passage-text';
import { addPassage } from '@/services/user-passages';

const MIN_WORDS = 20;

const PACE_OPTIONS = [
  { label: 'Slow', wpm: 120 },
  { label: 'Natural', wpm: 150 },
  { label: 'Brisk', wpm: 175 },
] as const;

const THEME = {
  light: {
    secondary: '#77777E',
    inputBed: 'rgba(17,17,20,0.06)',
    segmentBed: 'rgba(17,17,20,0.06)',
    segmentActive: '#1C1C21',
    segmentActiveLabel: '#FFFFFF',
    buttonSolid: '#1C1C21',
    buttonLabel: '#FFFFFF',
    buttonDisabled: 'rgba(17,17,20,0.25)',
    closeBed: 'rgba(17,17,20,0.08)',
  },
  dark: {
    secondary: '#9E9EA6',
    inputBed: 'rgba(255,255,255,0.08)',
    segmentBed: 'rgba(255,255,255,0.08)',
    segmentActive: '#F2F2F5',
    segmentActiveLabel: '#111114',
    buttonSolid: '#F2F2F5',
    buttonLabel: '#111114',
    buttonDisabled: 'rgba(255,255,255,0.18)',
    closeBed: 'rgba(255,255,255,0.10)',
  },
} as const;

/** Form sheet for adding a user passage: title, pasted text, target pace. */
export default function PassageEditorScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palette[scheme];
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [paceIndex, setPaceIndex] = useState(1);

  const wordCount = useMemo(() => tokenizePassage(text).words.length, [text]);
  const targetWpm = PACE_OPTIONS[paceIndex].wpm;
  const minutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / targetWpm)) : 0;
  const canSave = title.trim().length > 0 && wordCount >= MIN_WORDS;

  const handleClose = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleSave = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addPassage({ title, text, targetWpm });
    router.back();
  };

  const preview =
    wordCount === 0
      ? 'Paste at least 20 words to save'
      : wordCount < MIN_WORDS
        ? `${wordCount} words (need at least ${MIN_WORDS})`
        : `${wordCount} words · ~${minutes} min${minutes > 1 ? 's' : ''} at ${targetWpm} wpm`;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>New Passage</Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            {hasGlass ? (
              <GlassView glassEffectStyle="regular" isInteractive style={styles.close}>
                <HugeiconsIcon icon={Cancel01Icon} size={18} color={colors.foreground} strokeWidth={1.5} />
              </GlassView>
            ) : (
              <View style={[styles.close, { backgroundColor: theme.closeBed }]}>
                <HugeiconsIcon icon={Cancel01Icon} size={18} color={colors.foreground} strokeWidth={1.5} />
              </View>
            )}
          </Pressable>
        </View>

        <Text style={[styles.label, { color: theme.secondary }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="My speech"
          placeholderTextColor={theme.secondary}
          maxLength={48}
          style={[
            styles.input,
            { backgroundColor: theme.inputBed, color: colors.foreground },
          ]}
        />

        <Text style={[styles.label, { color: theme.secondary }]}>Text</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste any text, speech, or transcript…"
          placeholderTextColor={theme.secondary}
          multiline
          textAlignVertical="top"
          style={[
            styles.input,
            styles.textArea,
            { backgroundColor: theme.inputBed, color: colors.foreground },
          ]}
        />

        <Text style={[styles.label, { color: theme.secondary }]}>Reading pace</Text>
        <View style={[styles.segments, { backgroundColor: theme.segmentBed }]}>
          {PACE_OPTIONS.map((option, index) => {
            const active = index === paceIndex;
            return (
              <Pressable
                key={option.label}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPaceIndex(index);
                }}
                style={[
                  styles.segment,
                  active && { backgroundColor: theme.segmentActive },
                ]}>
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? theme.segmentActiveLabel : colors.foreground },
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.preview, { color: theme.secondary }]}>{preview}</Text>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <View
            style={[
              styles.save,
              { backgroundColor: canSave ? theme.buttonSolid : theme.buttonDisabled },
            ]}>
            <Text style={[styles.saveLabel, { color: theme.buttonLabel }]}>
              Save to Library
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: fonts.regular,
  },
  textArea: {
    minHeight: 160,
    maxHeight: 260,
    lineHeight: 23,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  preview: {
    fontSize: 14,
    fontFamily: fonts.medium,
    marginTop: 14,
  },
  save: {
    height: 56,
    borderRadius: 28,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveLabel: {
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
});
