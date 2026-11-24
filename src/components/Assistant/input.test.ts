import { describe, expect, it, vi } from 'vitest';

import type { AssistantToolFile } from './config';
import {
  acceptOf,
  base64Of,
  canDictate,
  enterSends,
  fileProblem,
  MAX_FILE_BYTES,
  MAX_QUESTION_BYTES,
  MAX_RECORDING_MS,
  mimeOf,
  recordVoice,
} from './input';

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 10) => ({ name, type, size });

describe('enterSends', () => {
  const key = (fields: Partial<KeyboardEvent>) => ({ key: 'Enter', shiftKey: false, isComposing: false, ...fields }) as KeyboardEvent;

  it('Enter sends; Shift+Enter, a composition or another key do not', () => {
    expect(enterSends(key({}), false)).toBe(true);
    expect(enterSends(key({ shiftKey: true }), false)).toBe(false);
    expect(enterSends(key({ isComposing: true }), false)).toBe(false);
    expect(enterSends(key({ key: 'a' }), false)).toBe(false);
  });

  it('on a touch screen Enter is a new line: the send button sends', () => {
    expect(enterSends(key({}), true)).toBe(false);
  });
});

describe('files', () => {
  it('the types erplora.com reads, by type or by extension when the browser gives none', () => {
    expect(mimeOf(file('a.png', 'image/png'))).toBe('image/png');
    expect(mimeOf(file('notes.md', ''))).toBe('text/markdown');
    expect(mimeOf(file('data.csv', ''))).toBe('text/csv');
    expect(mimeOf(file('x.json', ''))).toBe('application/json');
    expect(mimeOf(file('carta.docx', ''))).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeOf(file('libro.xlsx', ''))).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(acceptOf()).toContain('.docx');
    expect(acceptOf()).toContain('application/pdf');
  });

  it('takes what it reads and says why it refuses the rest', () => {
    expect(fileProblem(file('menu.pdf', 'application/pdf', 2 * MB), 0)).toBeNull();
    expect(fileProblem(file('foto.heic', 'image/heic'), 0)).toEqual({ key: 'assistant.files.unsupported', values: { name: 'foto.heic' } });
    expect(fileProblem(file('viejo.doc', 'application/msword'), 0)).toEqual({ key: 'assistant.files.unsupported', values: { name: 'viejo.doc' } });
    // The limit the sentence promises («8 MB at most per file»), pinned in bytes: not the constant against itself.
    expect(MAX_FILE_BYTES).toBe(8 * MB);
    expect(fileProblem(file('full.pdf', 'application/pdf', 8 * MB), 0)).toBeNull();
    expect(fileProblem(file('big.pdf', 'application/pdf', 8 * MB + 1), 0)).toEqual({
      key: 'assistant.files.tooLarge',
      values: { name: 'big.pdf' },
    });
    expect(fileProblem(file('c.pdf', 'application/pdf', 3 * MB), MAX_QUESTION_BYTES - 2 * MB)).toEqual({
      key: 'assistant.files.tooMuch',
      values: {},
    });
  });

  // The Hub's copy of a business: its tool takes the file as it is, with its own limit and its own words.
  const ZIP: AssistantToolFile = { extension: '.zip', mime: 'application/zip', maxBytes: 20 * MB, tooLargeKey: 'host.files.tooBig' };

  it('a file the host\'s tools take is offered and recognised only for that host', () => {
    expect(acceptOf().split(',')).not.toContain('.zip');
    expect(acceptOf([ZIP]).split(',')).toEqual([...acceptOf().split(','), '.zip', 'application/zip']);
    expect(mimeOf(file('copia.blueprint.zip', ''), [ZIP])).toBe('application/zip');
    // Windows names a zip its own way: its ending says what it is.
    expect(mimeOf(file('copia.blueprint.zip', 'application/x-zip-compressed'), [ZIP])).toBe('application/zip');
    expect(mimeOf(file('copia.blueprint.zip', 'application/zip'), [ZIP])).toBe('application/zip');
    expect(fileProblem(file('copia.blueprint.zip', 'application/zip'), 0)).toEqual({
      key: 'assistant.files.unsupported',
      values: { name: 'copia.blueprint.zip' },
    });
  });

  it('a file the host\'s tools take has the host\'s limit and says so in the host\'s words', () => {
    expect(fileProblem(file('copia.blueprint.zip', 'application/zip', 20 * MB), 0, [ZIP])).toBeNull();
    expect(fileProblem(file('copia.blueprint.zip', 'application/zip', 20 * MB + 1), 0, [ZIP])).toEqual({
      key: 'host.files.tooBig',
      values: { name: 'copia.blueprint.zip' },
    });
    expect(fileProblem(file('copia.blueprint.zip', 'application/zip', 3 * MB), MAX_QUESTION_BYTES - 2 * MB, [ZIP])).toEqual({
      key: 'assistant.files.tooMuch',
      values: {},
    });
    // What erplora.com reads keeps its own limit beside it.
    expect(fileProblem(file('big.pdf', 'application/pdf', 8 * MB + 1), 0, [ZIP])?.key).toBe('assistant.files.tooLarge');
  });

  it('reads a file as base64, without the data: prefix', async () => {
    expect(await base64Of(new Blob(['hola'], { type: 'text/plain' }))).toBe('aG9sYQ==');
  });
});

class FakeRecorder {
  static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
  static last: FakeRecorder;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    public stream: MediaStream,
    public options: { mimeType?: string },
  ) {
    FakeRecorder.last = this;
  }
  get mimeType() {
    return this.options.mimeType ?? '';
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voz'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function microphone() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { track, getUserMedia: vi.fn(async () => stream) };
}

describe('dictation', () => {
  it('only where the browser can record', () => {
    expect(canDictate({ getUserMedia: async () => ({}) as MediaStream, MediaRecorder: FakeRecorder as never })).toBe(true);
    expect(canDictate({ getUserMedia: undefined, MediaRecorder: FakeRecorder as never })).toBe(false);
    expect(canDictate({ getUserMedia: async () => ({}) as MediaStream, MediaRecorder: undefined })).toBe(false);
  });

  it('records in a type erplora.com transcribes and frees the microphone when it stops', async () => {
    const mic = microphone();
    const recording = await recordVoice({ getUserMedia: mic.getUserMedia, MediaRecorder: FakeRecorder as never });
    expect(mic.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeRecorder.last.state).toBe('recording');
    const clip = await recording.stop();
    expect(clip.mime).toBe('audio/webm');
    expect(clip.blob.size).toBe(3);
    expect(mic.track.stop).toHaveBeenCalled();
  });

  it('stops by itself after two minutes', async () => {
    vi.useFakeTimers();
    try {
      const mic = microphone();
      const ended = vi.fn();
      await recordVoice({ getUserMedia: mic.getUserMedia, MediaRecorder: FakeRecorder as never }, ended);
      vi.advanceTimersByTime(MAX_RECORDING_MS);
      expect(FakeRecorder.last.state).toBe('inactive');
      expect(ended).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelling throws the recording away and frees the microphone', async () => {
    const mic = microphone();
    const recording = await recordVoice({ getUserMedia: mic.getUserMedia, MediaRecorder: FakeRecorder as never });
    recording.cancel();
    expect(FakeRecorder.last.state).toBe('inactive');
    expect(mic.track.stop).toHaveBeenCalled();
  });
});
