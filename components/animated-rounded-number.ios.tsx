import { Host, Text } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';

import type { AnimatedRoundedNumberProps } from './animated-rounded-number';

/** Native rolling-number treatment, isolated so non-iOS bundles never load SwiftUI. */
export function AnimatedRoundedNumber({
  text,
  value,
  color,
  fontSize,
  weight,
  duration,
}: AnimatedRoundedNumberProps) {
  return (
    <Host matchContents>
      <Text
        modifiers={[
          contentTransition('numericText'),
          animation(Animation.spring({ duration }), value),
          font({ size: fontSize, weight, design: 'rounded' }),
          foregroundStyle(color),
        ]}>
        {text}
      </Text>
    </Host>
  );
}
