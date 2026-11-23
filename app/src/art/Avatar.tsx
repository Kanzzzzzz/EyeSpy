import { memo } from 'react';
import type { Crop, Expression, Gaze } from './faceTypes';
import { Face } from './Face';
import { PORTRAITS, portrait } from './portraits';

export type { Expression } from './faceTypes';

/** The 12 public characters players pick from in the lobby. */
export const AVATARS = PORTRAITS;

/** A player's public face (their lobby character): their painted portrait. */
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
  full = true,
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
  /** Show the full head-and-shoulders portrait (default for the home screen and picker). */
  full?: boolean;
}) {
  const look = portrait(id);
  return (
    <Face
      avatar={id}
      size={size}
      crop={crop}
      gaze={gaze}
      expression={expression}
      ghost={ghost}
      blink={blink}
      full={full}
      className={className}
      title={title ?? look.name}
    />
  );
});
