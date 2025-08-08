import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const LogoMark = (props: { width?: number | string; height?: number | string; style?: any }) => {
  const { width = '100%', height = '100%', style } = props;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 500 200"
      style={style}
    >
      {/* First card (back) - slightly rotated */}
      <Path
        d="M40,40 L180,40 Q200,40 200,60 L200,180 Q200,200 180,200 L40,200 Q20,200 20,180 L20,60 Q20,40 40,40 Z"
        fill="white"
        transform="rotate(-10, 110, 120)"
      />

      {/* Second card (front) */}
      <Path
        d="M60,20 L200,20 Q220,20 220,40 L220,160 Q220,180 200,180 L60,180 Q40,180 40,160 L40,40 Q40,20 60,20 Z"
        fill="white"
      />

      {/* Magnifying glass lens - orange filled circle */}
      <Circle
        cx="320"
        cy="100"
        r="60"
        fill="#FF6A00"
      />

      {/* Magnifying glass ring */}
      <Circle
        cx="320"
        cy="100"
        r="60"
        fill="none"
        stroke="white"
        strokeWidth="16"
      />

      {/* Magnifying glass handle */}
      <Rect
        x="365"
        y="145"
        width="20"
        height="80"
        rx="10"
        fill="white"
        transform="rotate(45, 375, 155)"
      />
    </Svg>
  );
};

export default LogoMark;
