import { App as CapApp } from '@capacitor/app';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { isNative } from './platform/device';
import { useGame } from './state/store';
import { Home } from './screens/Home';
import { HowToPlay } from './screens/HowToPlay';
import { Join } from './screens/Join';
import { Settings } from './screens/Settings';
import { Permissions } from './screens/Permissions';
import { Game } from './screens/Game';
import { startMusic, stopMusic } from './audio/music';

export function App() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const reducedMotion = useGame((s) => s.prefs.reducedMotion);
  const music = useGame((s) => s.prefs.music);
  const phase = useGame((s) => s.snap?.view?.phase);
  const alive = useGame((s) => s.snap?.view?.me?.alive);

  useEffect(() => {
    void useGame.getState().init();
  }, []);

  // Tension music only while a round is being played.
  useEffect(() => {
    if (music && (phase === 'playing' || phase === 'arrest')) startMusic(alive === false ? 0.18 : 0.32);
    else stopMusic();
    return () => stopMusic();
  }, [music, phase, alive]);

  // Warn before leaving mid-round (web), and reconnect fast on return (native).
  useEffect(() => {
    const inRound = phase && phase !== 'lobby' && phase !== 'ended';
    if (!inRound) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    let handle: { remove: () => Promise<void> } | null = null;
    if (isNative) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        // Coming back: the client reconnects by itself; nudge audio back on.
        void useGame.getState().go('game');
      }).then((h) => (handle = h));
    }
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      void handle?.remove();
    };
  }, [phase]);

  if (!ready) return <div className="min-h-[100dvh] bg-ink-900" />;

  return (
    <MotionConfig reducedMotion={reducedMotion === 'on' ? 'always' : reducedMotion === 'off' ? 'never' : 'user'}>
      <div className="grain min-h-[100dvh]">
        <AnimatePresence mode="wait">
          {screen === 'home' && <Home key="home" />}
          {screen === 'how' && <HowToPlay key="how" />}
          {screen === 'join' && <Join key="join" />}
          {screen === 'settings' && <Settings key="settings" />}
          {screen === 'permissions' && <Permissions key="permissions" />}
          {screen === 'game' && <Game key="game" />}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
