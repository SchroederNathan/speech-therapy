import { Text } from 'react-native';

export type AnimatedRoundedNumberProps = {
  text: string;
  value: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  weight: 'semibold' | 'bold';
  duration: number;
};

/** Android/web fallback for the iOS SwiftUI numeric-text transition. */
export function AnimatedRoundedNumber({
  text,
  color,
  fontSize,
  fontFamily,
}: AnimatedRoundedNumberProps) {
  return <Text style={{ color, fontSize, fontFamily }}>{text}</Text>;
}
