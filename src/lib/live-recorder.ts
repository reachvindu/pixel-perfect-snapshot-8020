/**
 * Records microphone (and optionally a shared meeting tab's audio) in the
 * browser and emits a complete WAV file every `segmentMs`.
 */
function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((s, c) => s + c.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (o: number, v: string) => { for (let i = 0; i < v.length; i++) view.setUint8(o + i, v.charCodeAt(i)); };
  tag(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, length * 2, true);
  let o = 44;
  for (const c of chunks) for (const v of c) {
    const s = Math.max(-1, Math.min(1, v));
    view.setInt16(o, s * (s < 0 ? 32768 : 32767), true); o += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export interface LiveRecorder { stop: () => void }

export async function startLiveRecorder(opts: {
  includeTabAudio: boolean;
  segmentMs?: number;
  onSegment: (file: File) => void;
  onEnded?: () => void;
}): Promise<LiveRecorder> {
  const streams: MediaStream[] = [];
  const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
  streams.push(mic);
  if (opts.includeTabAudio) {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (display.getAudioTracks().length === 0) {
        display.getTracks().forEach((t) => t.stop());
        throw new Error("No tab audio shared. Tick “Share tab audio” when choosing the meeting tab.");
      }
      display.getVideoTracks().forEach((t) => t.stop());
      streams.push(new MediaStream(display.getAudioTracks()));
    } catch (e) {
      mic.getTracks().forEach((t) => t.stop());
      throw e;
    }
  }

  const ctx = new AudioContext();
  await ctx.resume();
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const sources = streams.map((s) => ctx.createMediaStreamSource(s));
  sources.forEach((s) => s.connect(node));
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute); mute.connect(ctx.destination);

  let chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));

  const flush = () => {
    if (chunks.length === 0) return;
    const blob = encodeWav(chunks, ctx.sampleRate);
    chunks = [];
    if (blob.size < 8192) return;
    opts.onSegment(new File([blob], `segment-${Date.now()}.wav`, { type: "audio/wav" }));
  };
  const timer = setInterval(flush, opts.segmentMs ?? 20000);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    flush();
    node.onaudioprocess = null;
    sources.forEach((s) => s.disconnect());
    node.disconnect();
    streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    void ctx.close();
    opts.onEnded?.();
  };
  // If the user stops sharing the tab from the browser bar, end the session
  streams.forEach((s) => s.getTracks().forEach((t) => t.addEventListener("ended", stop)));
  return { stop };
}
