import { useColor } from '../../hooks/useColor';
import { typography } from '../../src/constants/typography';
import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';

type TextVariant =
  | 'body'
  | 'title'
  | 'subtitle'
  | 'caption'
  | 'heading'
  | 'link';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  lightColor?: string;
  darkColor?: string;
  children: React.ReactNode;
}

export const Text = forwardRef<RNText, TextProps>(
  (
    { variant = 'body', lightColor, darkColor, style, children, ...props },
    ref
  ) => {
    const textColor = useColor('text', { light: lightColor, dark: darkColor });
    const mutedColor = useColor('textMuted');

    const getTextStyle = (): TextStyle => {
      const baseStyle: TextStyle = {
        color: textColor,
      };

      switch (variant) {
        case 'heading':
          return {
            ...baseStyle,
            ...typography.display,
          };
        case 'title':
          return {
            ...baseStyle,
            ...typography.title,
          };
        case 'subtitle':
          return {
            ...baseStyle,
            ...typography.subtitle,
          };
        case 'caption':
          return {
            ...baseStyle,
            ...typography.caption,
            color: mutedColor,
          };
        case 'link':
          return {
            ...baseStyle,
            ...typography.bodyEmphasis,
            textDecorationLine: 'underline',
          };
        default: // 'body'
          return {
            ...baseStyle,
            ...typography.body,
          };
      }
    };

    return (
      <RNText ref={ref} style={[getTextStyle(), style]} {...props}>
        {children}
      </RNText>
    );
  }
);
