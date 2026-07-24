import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { PacePicker } from '@/components/pace-picker';
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
    buttonSolid: '#1C1C21',
    buttonLabel: '#FFFFFF',
    buttonDisabled: 'rgba(17,17,20,0.25)',
  },
  dark: {
    secondary: '#9E9EA6',
    inputBed: 'rgba(255,255,255,0.08)',
    buttonSolid: '#F2F2F5',
    buttonLabel: '#111114',
    buttonDisabled: 'rgba(255,255,255,0.18)',
  },
} as const;

/** Modal for adding a user passage: title, pasted text, target pace. The
 * screen title and close button live in the native stack toolbar. */
export default function PassageEditorScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palette[scheme];
  const theme = THEME[scheme];

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
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
        <PacePicker
          options={PACE_OPTIONS}
          selectedIndex={paceIndex}
          onSelect={(index) => {
            Haptics.selectionAsync();
            setPaceIndex(index);
          }}
        />

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

      {/* Custom title on the LEFT of the header bar (iOS centers regular
          titles), vertically centered via the fixed-size toolbar view. */}
      <Stack.Toolbar placement="left">
        {/* hidesSharedBackground drops the iOS 26 glass capsule behind the
            item — the title should sit directly on the screen background. */}
        <Stack.Toolbar.View hidesSharedBackground>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              New Passage
            </Text>
          </View>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={handleClose} />
      </Stack.Toolbar>
    </>
  );
}

const styles = StyleSheet.create({
  // Toolbar views need one child with explicit width/height; centering
  // vertically inside it keeps the text on the bar's middle line.
  headerTitleBox: {
    width: 200,
    height: 36,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 21,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
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
