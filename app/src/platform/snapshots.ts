import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { RoomSnapshot } from '@eyespy/room';
import { isNative } from './device';

const FILE = 'eyespy-host-snapshot.json';
const KEY = 'eyespy.hostSnapshot';

/**
 * Saves the host's game after every action so a crashed app resumes the
 * round. Writes are serialised and only the newest snapshot is written, so a
 * burst of actions never queues up stale writes.
 */
export function createSnapshotWriter() {
  let latest: RoomSnapshot | null = null;
  let writing = false;

  async function flush() {
    if (writing) return;
    writing = true;
    try {
      while (latest) {
        const snap = latest;
        latest = null;
        const data = JSON.stringify(snap);
        if (isNative) {
          await Filesystem.writeFile({ path: FILE, data, directory: Directory.Data, encoding: Encoding.UTF8 });
        } else {
          localStorage.setItem(KEY, data);
        }
      }
    } catch (err) {
      console.warn('snapshot write failed', err);
    } finally {
      writing = false;
    }
  }

  return (snap: RoomSnapshot) => {
    latest = snap;
    void flush();
  };
}

export async function readSnapshot(): Promise<RoomSnapshot | null> {
  try {
    let text: string | null;
    if (isNative) {
      const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      text = typeof r.data === 'string' ? r.data : null;
    } else {
      text = localStorage.getItem(KEY);
    }
    if (!text) return null;
    const snap = JSON.parse(text) as RoomSnapshot;
    // Only a round in progress is worth resuming.
    if (snap.version !== 1 || ['lobby', 'ended'].includes(snap.state.phase)) return null;
    // Very old games are not worth resuming.
    if (Date.now() - snap.savedAt > 30 * 60_000) return null;
    return snap;
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    if (isNative) await Filesystem.deleteFile({ path: FILE, directory: Directory.Data });
    else localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
