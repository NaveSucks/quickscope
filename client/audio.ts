import type { Vec } from "../shared/types.ts";
// Original synthesized audio. No downloaded samples.
export class Sound {
  ctx?: AudioContext;
  volume = 0.5;
  start() {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
  }
  play(
    kind: "shot" | "bolt" | "step" | "hit",
    p?: Vec,
    listener?: Vec,
    yaw = 0,
    weapon = 0,
  ) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const duration = kind === "shot" ? 0.22 : kind === "step" ? 0.07 : 0.1,
      buffer = c.createBuffer(
        1,
        Math.ceil(c.sampleRate * duration),
        c.sampleRate,
      ),
      a = buffer.getChannelData(0);
    for (let i = 0; i < a.length; i++) {
      const t = i / a.length;
      a[i] = (Math.random() * 2 - 1) * Math.exp(-t * (kind === "shot" ? 9 : 6));
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value =
      kind === "shot" ? (weapon ? 3200 : 1800) : kind === "step" ? 280 : 5000;
    const gain = c.createGain();
    let distance = 1,
      pan = 0;
    if (p && listener) {
      const dx = p.x - listener.x,
        dz = p.z - listener.z;
      distance = 1 + Math.hypot(dx, dz) / 12;
      pan = Math.max(
        -1,
        Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance / 12),
      );
    }
    gain.gain.value =
      (this.volume * (kind === "shot" ? 0.7 : kind === "step" ? 0.15 : 0.25)) /
      distance;
    const stereo = c.createStereoPanner();
    stereo.pan.value = pan;
    source.connect(filter).connect(gain).connect(stereo).connect(c.destination);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
  }
}
