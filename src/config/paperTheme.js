import { MD2LightTheme } from 'react-native-paper';
import { colors } from './theme';

export const paperTheme = {
  ...MD2LightTheme,
  colors: {
    ...MD2LightTheme.colors,
    primary:      colors.primary,       // #C4924A
    accent:       colors.primaryDark,   // #A67A38
    background:   colors.background,    // #FAF8F4
    surface:      colors.surface,       // #FFFFFF
    text:         colors.textPrimary,   // #1A0A04
    placeholder:  colors.textLight,     // #9A7350
    error:        colors.error,         // #B71C1C
    notification: colors.primary,
    onSurface:    colors.textPrimary,
    disabled:     colors.textLight,
  },
};
