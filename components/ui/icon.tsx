import { useColor } from '../../hooks/useColor';
import React from 'react';

export type IconComponentProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
  strokeLinecap?: 'round' | 'square' | 'butt';
};

export type Props = IconComponentProps & {
  lightColor?: string;
  darkColor?: string;
  name: React.ComponentType<IconComponentProps>;
};

export function Icon({
  lightColor,
  darkColor,
  name: IconComponent,
  color,
  size = 24,
  strokeWidth = 1.8,
  ...rest
}: Props) {
  const themedColor = useColor('icon', { light: lightColor, dark: darkColor });

  // Use provided color prop if available, otherwise use themed color
  const iconColor = color || themedColor;

  return (
    <IconComponent
      color={iconColor}
      size={size}
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      {...rest}
    />
  );
}
