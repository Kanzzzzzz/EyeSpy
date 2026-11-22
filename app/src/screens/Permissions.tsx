import { platform } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Card, Screen, TopBar } from '../ui/kit';

/**
 * Explains the Local Network permission before the system asks. A denied
 * permission is the most common reason a phone can't find the game.
 */
export function Permissions() {
  const go = useGame((s) => s.go);
  const setPrefs = useGame((s) => s.setPrefs);
  const done = () => {
    setPrefs({ seenPermissions: true });
    go('home');
  };
  return (
    <Screen>
      <TopBar title="Before you play" onBack={() => go('home')} />
      <div className="flex flex-1 flex-col gap-4">
        <Card>
          <h3 className="font-display text-xl text-paper">Phones talk over Wi-Fi, not the internet</h3>
          <p className="mt-2 text-paper-dim">
            One phone hosts and everyone else joins it over the host's hotspot or a shared Wi-Fi. No accounts, nothing leaves the room.
          </p>
        </Card>
        {platform === 'ios' && (
          <Card>
            <h3 className="font-display text-lg text-paper">Allow "Local Network"</h3>
            <p className="mt-2 text-paper-dim">
              Your iPhone will ask to find devices on your local network. Tap <b className="text-paper">Allow</b>, or EyeSpy can't see the game. You can change it later in Settings → Privacy → Local Network.
            </p>
          </Card>
        )}
        <Card>
          <h3 className="font-display text-lg text-paper">Camera, only for QR codes</h3>
          <p className="mt-2 text-paper-dim">If the game doesn't show up by itself, you can scan the host's QR code. The camera is never used for anything else.</p>
        </Card>
        <Card>
          <h3 className="font-display text-lg text-paper">Keep EyeSpy open</h3>
          <p className="mt-2 text-paper-dim">Phones cut off apps in the background, so keep EyeSpy on screen during a round. It keeps your screen awake for you.</p>
        </Card>
      </div>
      <Button size="lg" className="mt-4" onClick={done}>
        Got it
      </Button>
    </Screen>
  );
}
