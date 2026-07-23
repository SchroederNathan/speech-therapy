# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Typography: SF Pro Rounded

All text uses SF Pro Rounded, bundled in `assets/fonts/` and loaded at runtime in `app/_layout.tsx` (Expo Go can't embed fonts at build time; the expo-font config plugin in `app.json` covers dev builds).

Set weights via `fontFamily` with the constants from `constants/fonts.ts` (`fonts.regular` … `fonts.heavy`) — never via `fontWeight`, which makes iOS synthesize or fall back to the system font:

```tsx
import { fonts } from '@/constants/fonts';

<Text style={{ fontFamily: fonts.semibold }}>…</Text>
```

# Icons: Hugeicons Pro

This project uses Hugeicons Pro (docs: https://hugeicons.com/docs/integrations/react-native/pro). Two style packages are installed:

- `@hugeicons-pro/core-stroke-rounded` — default for most UI
- `@hugeicons-pro/core-solid-rounded` — filled variant (active/selected states)

## Usage

Render icons with the `HugeiconsIcon` component from `@hugeicons/react-native`. Never use emoji, text glyphs, or other icon libraries.

```tsx
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Mic01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Mic01Icon as Mic01IconSolid } from '@hugeicons-pro/core-solid-rounded';

<HugeiconsIcon icon={Mic01Icon} size={24} color="#000" strokeWidth={1.5} />
```

Props: `icon`, `size` (default 24), `color`, `strokeWidth` (stroke styles only, default 1.5), plus `altIcon`/`showAlt` for toggling between two icons (e.g. stroke ↔ solid). Icon names are the same across style packages — alias imports (`as XIconSolid`) when mixing both.

## Looking up icon names

Do NOT guess icon names — many have numeric suffixes (`Mic01Icon`, `Mic02Icon`, `MicIcon` all exist). Look them up locally; every icon is a file in the installed package:

```bash
ls node_modules/@hugeicons-pro/core-stroke-rounded/dist/types | grep -i <keyword>
```

Example: `ls node_modules/@hugeicons-pro/core-stroke-rounded/dist/types | grep -i micro` → `Microphone01Icon.d.ts`, `Microphone02Icon.d.ts`, etc. Strip the `.d.ts` to get the import name. For visual browsing, search at https://hugeicons.com/icons.
