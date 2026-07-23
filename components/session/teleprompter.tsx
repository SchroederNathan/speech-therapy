import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';

import { fonts } from '@/constants/fonts';
import { sentenceAt, type TokenizedPassage } from '@/lib/passage-text';

/**
 * The current word's 0..1 spoken fraction ticks at ~10Hz. It flows through a
 * dedicated context so ONLY the tiny PartialWord leaf re-renders on each tick
 * — the memoized Teleprompter (and its paragraph blocks) never see it.
 */
export const WordFractionContext = createContext(0);

/** Aa button presets for the reading text. */
export const TELEPROMPTER_TEXT_SIZES = [28, 34, 40] as const;

const LINE_HEIGHT_FACTOR = 1.32;
/** The active line is auto-scrolled to sit at this fraction of the viewport. */
const SCROLL_ANCHOR = 0.42;

export type TeleprompterColors = {
  foreground: string;
  dimmed: string;
  accent: string;
  accentFaded: string;
};

/** Current word rendered as two spans split by the spoken fraction:
 * leading chars in full accent, the rest in the faded accent. */
function PartialWord({
  word,
  accent,
  accentFaded,
}: {
  word: string;
  accent: string;
  accentFaded: string;
}) {
  const fraction = useContext(WordFractionContext);
  const split = Math.max(0, Math.min(word.length, Math.round(fraction * word.length)));
  return (
    <Text>
      <Text style={{ color: accent }}>{word.slice(0, split)}</Text>
      <Text style={{ color: accentFaded }}>{word.slice(split)}</Text>
    </Text>
  );
}

type StaticParagraphProps = {
  index: number;
  text: string;
  color: string;
  fontSize: number;
  lineHeight: number;
  spacing: number;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
};

/** Past/future paragraph: one single-color <Text>, zero word spans, memoized
 * so live ticks never touch it. */
const StaticParagraph = memo(function StaticParagraph({
  index,
  text,
  color,
  fontSize,
  lineHeight,
  spacing,
  onLayout,
}: StaticParagraphProps) {
  return (
    <Text
      onLayout={(e) => onLayout(index, e)}
      style={[styles.paragraph, { color, fontSize, lineHeight, marginBottom: spacing }]}>
      {text}
    </Text>
  );
});

type ActiveParagraphProps = {
  tokenized: TokenizedPassage;
  paragraphIndex: number;
  /** Frontier index, clamped to this paragraph's range by the parent. */
  currentWordIndex: number;
  sentenceStart: number;
  sentenceEnd: number;
  colors: TeleprompterColors;
  fontSize: number;
  lineHeight: number;
  spacing: number;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
  onTextLayout: (index: number, e: NativeSyntheticEvent<TextLayoutEventData>) => void;
};

/** The paragraph being read: three chunks (dimmed completed sentences /
 * current-sentence spans / upcoming in foreground) plus the PartialWord leaf.
 * Re-renders only when the frontier crosses a word boundary. */
const ActiveParagraph = memo(function ActiveParagraph({
  tokenized,
  paragraphIndex,
  currentWordIndex,
  sentenceStart,
  sentenceEnd,
  colors,
  fontSize,
  lineHeight,
  spacing,
  onLayout,
  onTextLayout,
}: ActiveParagraphProps) {
  const p = tokenized.paragraphs[paragraphIndex];
  const words = tokenized.words;

  const spokenEnd = Math.min(currentWordIndex, p.end);
  const hasCurrent = currentWordIndex >= sentenceStart && currentWordIndex < Math.min(sentenceEnd, p.end);

  const completedText = sentenceStart > p.start ? words.slice(p.start, sentenceStart).join(' ') : '';
  const spokenText =
    spokenEnd > sentenceStart ? words.slice(sentenceStart, Math.min(spokenEnd, sentenceEnd)).join(' ') : '';
  const currentWord = hasCurrent ? words[currentWordIndex] : null;
  const restStart = hasCurrent ? currentWordIndex + 1 : Math.max(spokenEnd, sentenceStart);
  const restText = restStart < p.end ? words.slice(restStart, p.end).join(' ') : '';

  return (
    <Text
      onLayout={(e) => onLayout(paragraphIndex, e)}
      onTextLayout={(e) => onTextLayout(paragraphIndex, e)}
      style={[
        styles.paragraph,
        { color: colors.foreground, fontSize, lineHeight, marginBottom: spacing },
      ]}>
      {completedText !== '' ? <Text style={{ color: colors.dimmed }}>{completedText + ' '}</Text> : null}
      {spokenText !== '' ? <Text style={{ color: colors.accent }}>{spokenText + ' '}</Text> : null}
      {currentWord != null ? (
        <PartialWord word={currentWord} accent={colors.accent} accentFaded={colors.accentFaded} />
      ) : null}
      {restText !== '' ? (currentWord != null ? ' ' + restText : restText) : null}
    </Text>
  );
});

export type TeleprompterProps = {
  tokenized: TokenizedPassage;
  currentWordIndex: number;
  fontSize: number;
  colors: TeleprompterColors;
  /** Content padding above the first paragraph (below the header/fade). */
  topInset: number;
  /** Content padding below the last paragraph (so it can reach the anchor). */
  bottomInset: number;
};

export const Teleprompter = memo(function Teleprompter({
  tokenized,
  currentWordIndex,
  fontSize,
  colors,
  topInset,
  bottomInset,
}: TeleprompterProps) {
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef(0);
  const paragraphYsRef = useRef<number[]>([]);
  const activeLinesRef = useRef<{
    paragraphIndex: number;
    lines: { length: number; y: number }[];
  } | null>(null);
  const lastTargetRef = useRef(-1);

  const lineHeight = Math.round(fontSize * LINE_HEIGHT_FACTOR);
  const spacing = Math.round(fontSize * 1.1);

  const paragraphTexts = useMemo(
    () => tokenized.paragraphs.map((p) => tokenized.words.slice(p.start, p.end).join(' ')),
    [tokenized],
  );

  const activeParagraphIndex = useMemo(() => {
    const idx = tokenized.paragraphs.findIndex(
      (p) => currentWordIndex >= p.start && currentWordIndex < p.end,
    );
    return idx === -1 ? tokenized.paragraphs.length - 1 : idx;
  }, [tokenized, currentWordIndex]);

  const sentence = sentenceAt(tokenized, Math.min(currentWordIndex, tokenized.words.length - 1));

  // ---- Auto-scroll: paragraph-level target, refined to the current line via
  // the active paragraph's onTextLayout lines. -------------------------------
  const scrollToCurrent = useCallback(() => {
    const paraY = paragraphYsRef.current[activeParagraphIndex];
    if (paraY == null || viewportRef.current === 0) return;

    let lineY = 0;
    const rec = activeLinesRef.current;
    if (rec && rec.paragraphIndex === activeParagraphIndex) {
      const p = tokenized.paragraphs[activeParagraphIndex];
      const target = Math.min(currentWordIndex, p.end - 1);
      let charOffset = 0;
      for (let i = p.start; i < target; i++) charOffset += tokenized.words[i].length + 1;
      let acc = 0;
      for (const line of rec.lines) {
        lineY = line.y;
        if (charOffset < acc + line.length) break;
        acc += line.length;
      }
    }

    const targetY = Math.max(0, paraY + lineY - viewportRef.current * SCROLL_ANCHOR);
    // Only move once the target has drifted at least half a line — kills
    // per-word jitter while still following every line break.
    if (Math.abs(targetY - lastTargetRef.current) < lineHeight * 0.5) return;
    lastTargetRef.current = targetY;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [activeParagraphIndex, currentWordIndex, tokenized, lineHeight]);

  const scrollFnRef = useRef(scrollToCurrent);
  scrollFnRef.current = scrollToCurrent;

  useEffect(() => {
    scrollToCurrent();
  }, [scrollToCurrent]);

  // Font-size changes re-flow everything; drop the jitter guard so the next
  // layout pass re-anchors.
  useEffect(() => {
    lastTargetRef.current = -1;
  }, [fontSize]);

  const handleParagraphLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    paragraphYsRef.current[index] = e.nativeEvent.layout.y;
    scrollFnRef.current();
  }, []);

  const handleActiveTextLayout = useCallback(
    (index: number, e: NativeSyntheticEvent<TextLayoutEventData>) => {
      activeLinesRef.current = {
        paragraphIndex: index,
        lines: e.nativeEvent.lines.map((l) => ({ length: l.text.length, y: l.y })),
      };
      scrollFnRef.current();
    },
    [],
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      onLayout={(e) => {
        viewportRef.current = e.nativeEvent.layout.height;
      }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
        paddingHorizontal: 24,
      }}>
      {tokenized.paragraphs.map((p, i) =>
        i === activeParagraphIndex ? (
          <ActiveParagraph
            key={i}
            tokenized={tokenized}
            paragraphIndex={i}
            currentWordIndex={currentWordIndex}
            sentenceStart={sentence.start}
            sentenceEnd={sentence.end}
            colors={colors}
            fontSize={fontSize}
            lineHeight={lineHeight}
            spacing={spacing}
            onLayout={handleParagraphLayout}
            onTextLayout={handleActiveTextLayout}
          />
        ) : (
          <StaticParagraph
            key={i}
            index={i}
            text={paragraphTexts[i]}
            color={i < activeParagraphIndex ? colors.dimmed : colors.foreground}
            fontSize={fontSize}
            lineHeight={lineHeight}
            spacing={spacing}
            onLayout={handleParagraphLayout}
          />
        ),
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  paragraph: {
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
  },
});
