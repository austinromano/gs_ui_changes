// AudioWorklet brickwall limiter for the master bus.
//
// Sits at the very end of the audio path:
//   mixerBus → masterGain → masterLimiter → destination
//
// Why a limiter at all: when many tracks sum into the master, peaks
// can exceed 0 dBFS and the OS / browser hard-clips. A brickwall
// limiter pulls those peaks back to a ceiling without colouring the
// signal (transparent below threshold, only engages on peaks).
//
// Algorithm (lookahead peak limiter, classic mastering-bus shape):
//   1. Push every incoming sample into a 5 ms ring buffer (lookahead).
//   2. Scan the buffer for the loudest absolute peak across both
//      channels — this is the "future" peak we need to duck for.
//   3. Compute target gain reduction:
//        targetGain = peak > ceiling ? ceiling / peak : 1
//   4. Smooth: instant attack (any new peak immediately pulls gain
//      down; the lookahead means the gain has 5 ms to ramp before
//      the peak actually arrives at output), exponential release
//      (~50 ms default, smooth recovery).
//   5. Output = the sample exiting the lookahead buffer × gain envelope.
//
// Trade-offs vs DynamicsCompressorNode:
//   - DynamicsCompressorNode has audible character + can't true-brickwall
//     (ratio caps around 20:1, knee can't be 0). This is a hard ceiling.
//   - We pay 5 ms of latency. On `latencyHint: 'playback'` that's fine.
//
// AudioParams (k-rate so we can sample once per block):
//   threshold — dBFS, default −0.3 (just under 0). Ceiling for the
//               output. Anything above gets pulled back.
//   release   — seconds, default 0.05. Time constant for the gain
//               envelope to recover after a peak.

/* global registerProcessor, AudioWorkletProcessor, sampleRate */

class MasterLimiterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -0.3, minValue: -30, maxValue: 0, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.05, minValue: 0.001, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    // 5 ms lookahead — enough for transients to be detected ahead of
    // time without adding more than a fraction of a buffer worth of
    // latency to the master path.
    this.lookahead = Math.max(8, Math.ceil(0.005 * sampleRate));
    this.bufL = new Float32Array(this.lookahead);
    this.bufR = new Float32Array(this.lookahead);
    this.idx = 0;
    // Current gain-reduction envelope. 1 = no reduction, 0 = full
    // mute. Starts at unity so the first sample passes through clean.
    this.gainEnv = 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const blockSize = output[0].length;
    const outChannels = output.length;

    // No input — silence out (no peak to limit, no work to do).
    if (!input || input.length === 0) {
      for (let ch = 0; ch < outChannels; ch++) output[ch].fill(0);
      return true;
    }

    const inChannels = Math.min(input.length, outChannels);
    const thresholdDB = parameters.threshold.length > 0 ? parameters.threshold[0] : -0.3;
    const releaseSec = parameters.release.length > 0 ? parameters.release[0] : 0.05;

    // Convert dBFS threshold → linear ceiling (e.g. −0.3 dB ≈ 0.966).
    const ceiling = Math.pow(10, thresholdDB / 20);
    // Exponential decay coefficient: per-sample multiplier that gets the
    // envelope back toward 1 with a time constant of `releaseSec`.
    const releaseCoeff = Math.exp(-1 / (Math.max(0.0005, releaseSec) * sampleRate));

    for (let i = 0; i < blockSize; i++) {
      // Push input into the ring buffer; remember the sample about to
      // be evicted — that's the one we'll output (delayed by the
      // lookahead window, which gives us 5 ms of foresight on peaks).
      const inL = input[0][i] || 0;
      const inR = inChannels > 1 ? (input[1][i] || 0) : inL;
      const oldL = this.bufL[this.idx];
      const oldR = this.bufR[this.idx];
      this.bufL[this.idx] = inL;
      this.bufR[this.idx] = inR;
      this.idx = (this.idx + 1) % this.lookahead;

      // Find the loudest peak across both channels in the lookahead
      // window. O(lookahead) per sample — comfortably within the
      // per-block budget on modern CPUs.
      let peak = 0;
      for (let j = 0; j < this.lookahead; j++) {
        const aL = this.bufL[j] < 0 ? -this.bufL[j] : this.bufL[j];
        const aR = this.bufR[j] < 0 ? -this.bufR[j] : this.bufR[j];
        if (aL > peak) peak = aL;
        if (aR > peak) peak = aR;
      }

      // Target gain reduction: drop peaks back to the ceiling, leave
      // anything below alone (= 1, transparent).
      const targetGain = peak > ceiling ? ceiling / peak : 1;

      // Instant attack (preempted by lookahead), exponential release.
      // If the new target is LOWER than current, snap straight to it
      // so the limiter never overshoots a peak. Otherwise glide back
      // toward unity at the release time constant.
      if (targetGain < this.gainEnv) {
        this.gainEnv = targetGain;
      } else {
        this.gainEnv = targetGain + (this.gainEnv - targetGain) * releaseCoeff;
      }

      // Output the lookahead-delayed sample × envelope.
      output[0][i] = oldL * this.gainEnv;
      if (outChannels > 1) output[1][i] = oldR * this.gainEnv;
    }

    return true;
  }
}

registerProcessor('master-limiter', MasterLimiterProcessor);
