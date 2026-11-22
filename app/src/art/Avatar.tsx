import { memo } from 'react';
import type { Crop, Expression, Gaze } from './AnimeFace';
import { Face } from './Face';
import { PUBLIC_LOOKS, publicLook } from './characters';

export type { Expression } from './AnimeFace';

/** The 12 public characters players pick from in the lobby. */
export const AVATARS = PUBLIC_LOOKS;

/** A player's public face (their lobby character), drawn with the anime kit. */
export const Avatar = memo(function Avatar({
  id,
  size = 64,
  expression = 'neutral',
  gaze = 'you',
  crop = 'face',
  ghost = false,
  blink = false,
  className,
  title,
}: {
  id: number;
  size?: number;
  expression?: Expression;
  gaze?: Gaze;
  crop?: Crop;
  ghost?: boolean;
  blink?: boolean;
  className?: string;
  title?: string;
}) {
  const look = publicLook(id);
  return (
    <Face
      avatar={id}
      size={size}
      crop={crop}
      gaze={gaze}
      expression={expression}
      ghost={ghost}
      blink={blink}
      className={className}
      title={title ?? look.name}
    />
  );
});
