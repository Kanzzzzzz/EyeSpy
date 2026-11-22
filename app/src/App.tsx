import { App as CapApp } from '@capacitor/app';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { isNative } from './platform/device';
import { useGame } from './state/store';
import { FxLayer } from './fx/FxLayer';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Home } from './screens/Home';
import { HowToPlay } from './screens/HowToPlay';
import { Join } from './screens/Join';
import { Settings } from './screens/Settings';
import { Permissions } from './screens/Permissions';
import { Game } from './screens/Game';
import { startMusic, stopMusic } from './audio/music';

function useSystemReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

export function App() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const reducedMotion = useGame((s) => s.prefs.reducedMotion);
  const music = useGame((s) => s.prefs.music);
  const phase = useGame((s) => s.snap?.view?.phase);
  const alive = useGame((s) => s.snap?.view?.me?.alive);
  const systemReduce = useSystemReducedMotion();
  const content = useRef<HTMLDivElement>(null);
  const effectsOn = reducedMotion === 'off' || (reducedMotion === 'system' && !systemReduce);

  useEffect(() => {
    void useGame.getState().init();
  }, []);

  // Android back button and gesture: step back instead of doing nothing.
  useEffect(() => {
    if (!isNative) return;
    let handle: { remove: () => Promise<void> } | null = null;
    void CapApp.addListener('backButton', () => {
      const s = useGame.getState();
      if (s.screen === 'home') {
        void CapApp.minimizeApp();
        return;
      }
      if (s.screen !== 'game') {
        s.go('home');
        return;
      }
      const phase = s.snap?.view?.phase;
      const midRound = s.snap?.status === 'online' && phase && phase !== 'lobby' && phase !== 'ended';
      if (!midRound || window.confirm(s.hosting ? 'End the game for everyone?' : 'Leave this game?')) void s.leaveGame();
    }).then((h) => (handle = h));
    return () => void handle?.remove();
  }, []);

  // Tension music only while a round is being played.
  useEffect(() => {
    if (music && (phase === 'playing' || phase === 'arrest' || phase === 'hearing')) startMusic(alive === false ? 0.18 : 0.32);
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
        void useGame.getState().go('game');
      }).then((h) => (handle = h));
    }
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      void handle?.remove();
    };
  }, [phase]);

  return (
    <MotionConfig reducedMotion={reducedMotion === 'on' ? 'always' : reducedMotion === 'off' ? 'never' : 'user'}>
      <div ref={content} className="grain min-h-[100dvh]">
        {ready && (
          <AnimatePresence mode="wait">
            {screen === 'home' && <Home key="home" />}
            {screen === 'how' && <HowToPlay key="how" />}
            {screen === 'join' && <Join key="join" />}
            {screen === 'settings' && <Settings key="settings" />}
            {screen === 'permissions' && <Permissions key="permissions" />}
            {screen === 'game' && (
            <ErrorBoundary key="game" onReset={() => useGame.setState({ alerts: [] })}>
              <Game />
            </ErrorBoundary>
          )}
          </AnimatePresence>
        )}
      </div>
      <FxLayer enabled={effectsOn} shakeTarget={content} />
    </MotionConfig>
  );
}
