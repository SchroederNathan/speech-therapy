import { Host } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import type { PacePickerProps } from './pace-picker';

/** Native SwiftUI segmented picker. The universal @expo/ui Picker has no
 * segmented appearance yet, so iOS drops to the swift-ui layer; other
 * platforms use the fallback in pace-picker.tsx. */
export function PacePicker({ options, selectedIndex, onSelect }: PacePickerProps) {
  return (
    <Host matchContents style={{ width: '100%' }}>
      <Picker
        selection={selectedIndex}
        onSelectionChange={(index) => {
          if (index != null) onSelect(index);
        }}
        modifiers={[pickerStyle('segmented')]}>
        {options.map((option, index) => (
          <Text key={option.label} modifiers={[tag(index)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
