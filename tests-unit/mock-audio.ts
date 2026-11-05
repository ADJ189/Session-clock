// Minimal Web Audio mock for the Node unit suite.
//
// The procedural engine only uses six factory methods and a handful of
// AudioParam calls, so a small hand-written mock is more honest than pulling
// in a browser shim: every assertion in the suite runs against exactly these
// call records, with no hidden DOM.

export interface ParamEvent {
  type:
    | "set"
    | "linear"
    | "exponential"
    | "target"
    | "curve"
    | "cancel";
  value: number;
  time: number;
}

export class MockAudioParam {
  value: number;
  readonly events: ParamEvent[] = [];

  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number): MockAudioParam {
    this.value = value;
    this.events.push({ type: "set", value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): MockAudioParam {
    this.value = value;
    this.events.push({ type: "linear", value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): MockAudioParam {
    this.value = value;
    this.events.push({ type: "exponential", value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number, _constant: number): MockAudioParam {
    this.value = value;
    this.events.push({ type: "target", value, time });
    return this;
  }

  setValueCurveAtTime(
    curve: Float32Array,
    time: number,
    _duration: number,
  ): MockAudioParam {
    const value = curve.length ? curve[curve.length - 1]! : this.value;
    this.value = value;
    this.events.push({ type: "curve", value, time });
    return this;
  }

  cancelScheduledValues(time: number): MockAudioParam {
    this.events.push({ type: "cancel", value: this.value, time });
    return this;
  }
}

export type MockConnectTarget = MockAudioNode | MockAudioParam;

export class MockAudioNode {
  readonly id: number;
  readonly connections: MockConnectTarget[] = [];
  disconnectCount = 0;
  channelCount = 2;

  constructor(id: number) {
    this.id = id;
  }

  connect<T extends MockConnectTarget>(
    target: T,
    _output?: number,
    _input?: number,
  ): T {
    this.connections.push(target);
    return target;
  }

  disconnect(destination?: MockConnectTarget): void {
    this.disconnectCount++;
    if (!destination) {
      this.connections.length = 0;
      return;
    }
    const index = this.connections.indexOf(destination);
    if (index >= 0) this.connections.splice(index, 1);
  }

  targets(): MockAudioNode[] {
    return this.connections.filter(
      (c): c is MockAudioNode => c instanceof MockAudioNode,
    );
  }
}

export class MockGainNode extends MockAudioNode {
  readonly gain = new MockAudioParam(1);
}

export class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new MockAudioParam(440);
  readonly detune = new MockAudioParam(0);
  readonly starts: { when: number; duration?: number }[] = [];
  readonly stops: number[] = [];
  onended: (() => void) | null = null;

  start(when = 0): void {
    this.starts.push({ when });
  }

  stop(when = 0): void {
    this.stops.push(when);
  }
}

export class MockBufferSourceNode extends MockAudioNode {
  buffer: MockAudioBuffer | null = null;
  loop = false;
  readonly playbackRate = new MockAudioParam(1);
  readonly starts: { when: number; offset?: number; duration?: number }[] = [];
  readonly stops: number[] = [];
  onended: (() => void) | null = null;

  start(when = 0, offset?: number, duration?: number): void {
    this.starts.push({ when, offset, duration });
  }

  stop(when = 0): void {
    this.stops.push(when);
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new MockAudioParam(350);
  readonly Q = new MockAudioParam(1);
  readonly gain = new MockAudioParam(0);
}

export class MockStereoPannerNode extends MockAudioNode {
  readonly pan = new MockAudioParam(0);
}

export class MockPannerNode extends MockAudioNode {
  private _panningModel: PanningModelType = "equalpower";
  panningModelShouldThrow = false;
  distanceModel: DistanceModelType = "inverse";
  refDistance = 1;
  maxDistance = 10_000;
  rolloffFactor = 1;
  coneInnerAngle = 360;
  coneOuterAngle = 360;
  coneOuterGain = 0;
  readonly positionX = new MockAudioParam(0);
  readonly positionY = new MockAudioParam(0);
  readonly positionZ = new MockAudioParam(0);
  readonly orientationX = new MockAudioParam(1);
  readonly orientationY = new MockAudioParam(0);
  readonly orientationZ = new MockAudioParam(0);
  readonly legacyPositions: [number, number, number][] = [];

  get panningModel(): PanningModelType {
    return this._panningModel;
  }

  set panningModel(value: PanningModelType) {
    if (this.panningModelShouldThrow) {
      throw new Error("panningModel rejected by engine");
    }
    this._panningModel = value;
  }

  setPosition(x: number, y: number, z: number): void {
    this.legacyPositions.push([x, y, z]);
  }
}

export class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;

  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }

  getByteFrequencyData(target: Uint8Array): void {
    target.fill(0);
  }
}

export class MockDynamicsCompressorNode extends MockAudioNode {
  readonly threshold = new MockAudioParam(-24);
  readonly knee = new MockAudioParam(30);
  readonly ratio = new MockAudioParam(12);
  readonly attack = new MockAudioParam(0.003);
  readonly release = new MockAudioParam(0.25);
}

export class MockChannelMergerNode extends MockAudioNode {}

export class MockMediaElementAudioSourceNode extends MockAudioNode {}

export class MockAudioListener {
  readonly forwardX = new MockAudioParam(0);
  readonly forwardY = new MockAudioParam(0);
  readonly forwardZ = new MockAudioParam(-1);
  readonly upX = new MockAudioParam(0);
  readonly upY = new MockAudioParam(1);
  readonly upZ = new MockAudioParam(0);
  readonly positionX = new MockAudioParam(0);
  readonly positionY = new MockAudioParam(0);
  readonly positionZ = new MockAudioParam(0);
}

export class MockAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly duration: number;
  private readonly channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel];
    if (!data) throw new RangeError(`No channel ${channel}`);
    return data;
  }
}

export class MockAudioContext {
  static readonly instances: MockAudioContext[] = [];

  sampleRate = 48_000;
  currentTime = 0;
  state: AudioContextState = "running";
  readonly destination = new MockAudioNode(0);
  readonly listener = new MockAudioListener();
  readonly gains: MockGainNode[] = [];
  readonly oscillators: MockOscillatorNode[] = [];
  readonly bufferSources: MockBufferSourceNode[] = [];
  readonly filters: MockBiquadFilterNode[] = [];
  readonly panners: MockStereoPannerNode[] = [];
  readonly hrtfPanners: MockPannerNode[] = [];
  readonly analysers: MockAnalyserNode[] = [];
  readonly compressors: MockDynamicsCompressorNode[] = [];
  readonly mergers: MockChannelMergerNode[] = [];
  readonly mediaSources: MockMediaElementAudioSourceNode[] = [];
  readonly buffers: MockAudioBuffer[] = [];
  failCreatePanner = false;
  failPanningModel = false;
  private nextId = 1;

  constructor() {
    MockAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = "closed";
    return Promise.resolve();
  }

  private id(): number {
    return this.nextId++;
  }

  createGain(): MockGainNode {
    const node = new MockGainNode(this.id());
    this.gains.push(node);
    return node;
  }

  createOscillator(): MockOscillatorNode {
    const node = new MockOscillatorNode(this.id());
    this.oscillators.push(node);
    return node;
  }

  createBufferSource(): MockBufferSourceNode {
    const node = new MockBufferSourceNode(this.id());
    this.bufferSources.push(node);
    return node;
  }

  createBiquadFilter(): MockBiquadFilterNode {
    const node = new MockBiquadFilterNode(this.id());
    this.filters.push(node);
    return node;
  }

  createStereoPanner(): MockStereoPannerNode {
    const node = new MockStereoPannerNode(this.id());
    this.panners.push(node);
    return node;
  }

  createPanner(): MockPannerNode {
    if (this.failCreatePanner) {
      throw new Error("createPanner unavailable in this mock");
    }
    const node = new MockPannerNode(this.id());
    node.panningModelShouldThrow = this.failPanningModel;
    this.hrtfPanners.push(node);
    return node;
  }

  createAnalyser(): MockAnalyserNode {
    const node = new MockAnalyserNode(this.id());
    this.analysers.push(node);
    return node;
  }

  createDynamicsCompressor(): MockDynamicsCompressorNode {
    const node = new MockDynamicsCompressorNode(this.id());
    this.compressors.push(node);
    return node;
  }

  createChannelMerger(_channels = 6): MockChannelMergerNode {
    const node = new MockChannelMergerNode(this.id());
    this.mergers.push(node);
    return node;
  }

  createMediaElementSource(
    _element: HTMLMediaElement,
  ): MockMediaElementAudioSourceNode {
    const node = new MockMediaElementAudioSourceNode(this.id());
    this.mediaSources.push(node);
    return node;
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): MockAudioBuffer {
    const buffer = new MockAudioBuffer(numberOfChannels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  /** Total sources that were actually started. */
  startedSources(): number {
    return (
      this.oscillators.reduce((n, o) => n + o.starts.length, 0) +
      this.bufferSources.reduce((n, s) => n + s.starts.length, 0)
    );
  }

  /** Total nodes still connected to something (a crude leak probe). */
  connectedNodes(): number {
    return [
      ...this.gains,
      ...this.filters,
      ...this.panners,
      ...this.hrtfPanners,
      ...this.analysers,
      ...this.compressors,
      ...this.mergers,
    ].filter((n) => n.connections.length > 0).length;
  }

  asBase(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
}

/** A clock-only context for the scheduler, which never builds nodes. */
export function createSchedulerClock(): {
  ctx: BaseAudioContext;
  advance(seconds: number): void;
} {
  const clock = { currentTime: 0 } as { currentTime: number };
  return {
    ctx: clock as unknown as BaseAudioContext,
    advance(seconds) {
      clock.currentTime += seconds;
    },
  };
}
