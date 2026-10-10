import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';
import data from './data.json';

loadFont({ family: 'Outfit', url: staticFile('outfit.woff2'), weight: '400 700' });

const C = { blue: '#1971c2', orange: '#f08c00', red: '#e03131', ink: '#101828', soft: '#475467', line: '#e4e7ec', wash: '#f5f7fa' };
// Hero pair: the ClutterBench results post, from the model whose raw and simple graphics differ most.
// Luna is skipped: its simple graphic for that post has misaligned bars.
const pairs = Object.keys(data.models).filter((m) => m !== 'luna').map((m) => {
  const r = data.runs.find((x) => x.task === 'clutterbench-v1-results' && x.model === m && x.variant === 'raw');
  const sm = data.runs.find((x) => x.task === 'clutterbench-v1-results' && x.model === m && x.variant === 'simple');
  return r && sm ? { r, sm, gap: r.clutter - sm.clutter } : null;
}).filter(Boolean).sort((a, b) => b.gap - a.gap);
const raw = pairs[0].r;
const simple = pairs[0].sm;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const base = { fontFamily: 'Outfit', color: C.ink, backgroundColor: '#fff' };

// every grader mark on the raw graphic, in reading order
const boxes = raw.marks.flatMap((m) => m.boxes.map((b) => ({ b, label: m.label }))).sort((p, q) => p.b[1] - q.b[1] || p.b[0] - q.b[0]);

const Wordmark = ({ size }) => (
  <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1 }}><span style={{ color: C.blue }}>Clutter</span>Bench</div>
);

// Scenes 1 + 2: marks land on the raw graphic, then the handle wipes to the simple one
const Compare = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = 900, X = 150, Y = 90;
  const k = S / 1200;
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const shown = interpolate(frame, [28, 118], [0, boxes.length], clamp);
  const wipe = interpolate(frame, [160, 250], [100, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const marksFade = interpolate(frame, [150, 165], [1, 1], clamp);
  const up = interpolate(frame, [28, 118], [0, raw.clutter], clamp);
  const down = interpolate(frame, [160, 250], [raw.clutter, simple.clutter], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const value = frame < 160 ? up : down;
  const t = interpolate(frame, [160, 250], [0, 1], clamp);
  const numColor = t >= 0.9 ? C.blue : C.red;
  return (
    <AbsoluteFill style={base}>
      <div style={{ position: 'absolute', left: X, top: Y, width: S, height: S, borderRadius: 10, overflow: 'hidden', boxShadow: `0 0 0 2px ${C.line}`, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
        <Img src={staticFile(simple.img)} style={{ position: 'absolute', inset: 0, width: S, height: S }} />
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - wipe}% 0 0)` }}>
          <Img src={staticFile(raw.img)} style={{ position: 'absolute', inset: 0, width: S, height: S }} />
          {boxes.map(({ b, label }, i) => {
            const p = spring({ frame: frame - 28 - (i / boxes.length) * 90, fps, config: { damping: 14, stiffness: 180 } });
            if (i >= Math.ceil(shown) + 1) return null;
            return (
              <div key={i} style={{ position: 'absolute', left: b[0] * k, top: b[1] * k, width: b[2] * k, height: b[3] * k, borderRadius: 3, background: `${C[label]}44`, boxShadow: `inset 0 0 0 2.5px ${C[label]}`, opacity: Math.min(1, p) * marksFade, transform: `scale(${0.85 + 0.15 * p})` }} />
            );
          })}
        </div>
        {frame >= 150 && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${wipe}%`, width: 4, marginLeft: -2, background: C.blue, opacity: interpolate(frame, [150, 158, 250, 262], [0, 1, 1, 0], clamp) }}>
            <div style={{ position: 'absolute', top: '50%', left: -26, marginTop: -28, width: 56, height: 56, borderRadius: 28, background: C.blue, boxShadow: '0 4px 14px rgba(16,24,40,.3)' }} />
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: X + S + 110, top: 0, bottom: 0, right: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: interpolate(frame, [18, 34], [0, 1], clamp) }}>
        <div style={{ fontSize: 44, fontWeight: 600, color: C.soft }}>{t < 0.9 ? 'Raw prompt' : 'Simple prompt'}</div>
        <div style={{ fontSize: 300, fontWeight: 700, lineHeight: 1, color: numColor, fontVariantNumeric: 'tabular-nums', letterSpacing: -6 }}>{Math.round(value)}%</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 6 }}>clutter</div>
      </div>
    </AbsoluteFill>
  );
};

const Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 } });
  const b = spring({ frame: frame - 12, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ ...base, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}><Wordmark size={170} /></div>
      <div style={{ fontSize: 60, fontWeight: 500, color: C.soft, marginTop: 34, opacity: b, transform: `translateY(${(1 - b) * 24}px)` }}>How much of the graphic is clutter?</div>
    </AbsoluteFill>
  );
};

// Leaderboard: bars grow under the raw prompt, then morph to the simple prompt
const Board = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const morph = interpolate(frame, [96, 126], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const W = 940;
  return (
    <AbsoluteFill style={{ ...base, padding: '100px 150px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Wordmark size={54} />
        <div style={{ fontSize: 46, fontWeight: 600, color: C.soft }}>{morph < 0.5 ? 'Raw prompt' : 'Simple prompt'}</div>
      </div>
      <div style={{ marginTop: data.board.length > 4 ? 64 : 90, display: 'flex', flexDirection: 'column', gap: data.board.length > 4 ? 50 : 78 }}>
        {data.board.map((row, i) => {
          const g0 = spring({ frame: frame - 8 - i * 7, fps, config: { damping: 200 } });
          const grow = g0 > 0.995 ? 1 : g0;
          const mix = (key) => interpolate(morph, [0, 1], [row.raw[key], row.simple[key]]);
          const blue = mix('blue'), orange = mix('orange'), red = mix('red');
          const total = blue + orange + red || 1;
          return (
            <div key={row.model} style={{ display: 'flex', alignItems: 'center', gap: 40, opacity: Math.min(1, grow * 1.5) }}>
              <div style={{ width: 470, fontSize: 50, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.name}</div>
              <div style={{ width: W, height: 72, borderRadius: 14, overflow: 'hidden', background: C.wash, display: 'flex' }}>
                {[['blue', blue], ['orange', orange], ['red', red]].map(([c, v]) => (
                  <div key={c} style={{ width: (W * grow * v) / total, height: '100%', background: C[c] }} />
                ))}
              </div>
              <div style={{ width: 170, textAlign: 'right', fontSize: 76, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(mix('clutter') * grow)}%</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 150, bottom: 84, display: 'flex', gap: 44, fontSize: 32, fontWeight: 500, color: C.soft }}>
        {[['blue', 'Keep'], ['orange', 'Shrink'], ['red', 'Remove']].map(([c, t]) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 22, height: 22, borderRadius: 11, background: C[c] }} />{t}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// End card: every graphic drifting behind the wordmark and URL
const tiles = data.runs.filter((r) => !(data.showcase || []).includes(r.task));
const End = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const T = 300, G = 18, cols = 8;
  return (
    <AbsoluteFill style={base}>
      <div style={{ position: 'absolute', left: -120, top: -80, width: cols * (T + G), display: 'flex', flexWrap: 'wrap', gap: G, transform: `translateY(${-frame * 0.9}px)`, opacity: 0.55 }}>
        {tiles.map((r) => <Img key={r.id} src={staticFile(r.img)} style={{ width: T, height: T, borderRadius: 6, boxShadow: `0 0 0 2px ${C.line}` }} />)}
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: '#fff', padding: '70px 110px', borderRadius: 28, boxShadow: '0 30px 80px rgba(16,24,40,.22)', textAlign: 'center', opacity: a, transform: `scale(${0.94 + 0.06 * a})` }}>
          <Wordmark size={130} />
          <div style={{ fontSize: 46, fontWeight: 500, color: C.soft, marginTop: 28 }}>clutterbench.adamholter.chatgpt.site</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Fade = ({ children, dur }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, dur - 10, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const Launch = () => (
  <AbsoluteFill style={{ backgroundColor: '#fff' }}>
    <Sequence durationInFrames={280}><Fade dur={280}><Compare /></Fade></Sequence>
    <Sequence from={275} durationInFrames={85}><Fade dur={85}><Title /></Fade></Sequence>
    <Sequence from={355} durationInFrames={190}><Fade dur={190}><Board /></Fade></Sequence>
    <Sequence from={540} durationInFrames={120}><Fade dur={120}><End /></Fade></Sequence>
  </AbsoluteFill>
);
