import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Label, Mono, Rule} from '../components/Type';
import {COLOR, FONT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {SCENE} from '../lib/timing';
import {voiceSmooth} from '../lib/voice';

const LEN = SCENE.editing.to - SCENE.editing.from;

type Clip = {x: number; w: number; color: string; label: string};

const TRACKS: {name: string; h: number; clips: Clip[]}[] = [
  {
    name: 'V3  GRAPHICS',
    h: 62,
    clips: [
      {x: 120, w: 260, color: COLOR.accent2, label: 'TITLE'},
      {x: 430, w: 190, color: COLOR.accent2, label: 'LOWER 3RD'},
      {x: 700, w: 320, color: COLOR.accent2, label: 'CALLOUT'},
    ],
  },
  {
    name: 'V2  B-ROLL',
    h: 74,
    clips: [
      {x: 60, w: 300, color: COLOR.accent, label: 'CAM_B 04'},
      {x: 400, w: 240, color: COLOR.accent, label: 'CAM_B 07'},
      {x: 680, w: 380, color: COLOR.accent, label: 'DRONE 02'},
    ],
  },
  {
    name: 'V1  MASTER',
    h: 92,
    clips: [
      {x: 0, w: 420, color: '#2C6E8E', label: 'A001_0132'},
      {x: 440, w: 300, color: '#2C6E8E', label: 'A001_0148'},
      {x: 760, w: 340, color: '#2C6E8E', label: 'A001_0155'},
    ],
  },
  {
    name: 'FX  EFFECTS',
    h: 54,
    clips: [
      {x: 180, w: 220, color: COLOR.warm, label: 'GRADE'},
      {x: 520, w: 180, color: COLOR.warm, label: 'BLUR'},
      {x: 800, w: 240, color: COLOR.warm, label: 'GLOW'},
    ],
  },
];

const Waveform: React.FC<{width: number}> = ({width}) => {
  const bars = Math.floor(width / 7);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        height: 66,
        padding: '0 10px',
        borderRadius: 8,
        border: `1px solid ${COLOR.line}`,
        background: 'rgba(91,242,168,0.06)',
      }}
    >
      {new Array(bars).fill(0).map((_, i) => {
        const h = 6 + Math.abs(Math.sin(i * 0.42) * Math.cos(i * 0.13)) * 46 * (0.4 + rand(i) * 0.8);
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: Math.min(54, h),
              borderRadius: 2,
              background: COLOR.good,
              opacity: 0.55,
            }}
          />
        );
      })}
    </div>
  );
};

export const Editing: React.FC = () => {
  const frame = useCurrentFrame();

  // Virtual camera: starts low and raked, rises and levels off.
  const fly = ramp(frame, 0, LEN, EASE.outSoft);
  const rotX = 58 - fly * 44;
  const z = -520 + fly * 480;
  const y = 240 - fly * 320;
  const scale = 0.92 + fly * 0.16;

  // Tracks slide into place, then lock together.
  const assemble = ramp(frame, 14, 60, EASE.out);
  const playhead = tween(frame, [10, LEN - 6], [40, 1040], EASE.inOut);
  const vox = voiceSmooth(frame + SCENE.editing.from);

  return (
    <Stage aurora={0.55} grid={0.7} grain={0.05} vignette={0.82} seed={4}>
      <AbsoluteFill style={{perspective: 1500, perspectiveOrigin: '50% 40%'}}>
        <AbsoluteFill
          style={{
            transform: `translate3d(0, ${y}px, ${z}px) rotateX(${rotX}deg) scale(${scale})`,
            transformStyle: 'preserve-3d',
            justifyContent: 'center',
            padding: `0 ${SAFE / 2}px`,
          }}
        >
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, position: 'relative'}}>
            {TRACKS.map((tr, ti) => {
              const t = ramp(frame, 14 + ti * 5, 34, EASE.out);
              return (
                <div key={ti} style={{opacity: t}}>
                  <div
                    style={{
                      ...TYPE.mono,
                      fontSize: 16,
                      color: COLOR.dim,
                      marginBottom: 6,
                      transform: `translateX(${(1 - t) * -60}px)`,
                    }}
                  >
                    {tr.name}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: tr.h,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.025)',
                      border: `1px solid ${COLOR.lineSoft}`,
                    }}
                  >
                    {tr.clips.map((c, ci) => {
                      const gap = (1 - assemble) * (ci - 1) * 90;
                      return (
                        <div
                          key={ci}
                          style={{
                            position: 'absolute',
                            left: c.x + gap,
                            top: 4,
                            width: c.w,
                            height: tr.h - 8,
                            borderRadius: 6,
                            background: `linear-gradient(180deg, ${c.color}dd, ${c.color}88)`,
                            border: `1px solid ${c.color}`,
                            boxShadow: `0 6px 22px ${c.color}33`,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span
                            style={{
                              ...TYPE.mono,
                              fontSize: 14,
                              color: 'rgba(255,255,255,0.92)',
                              padding: '6px 8px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{opacity: ramp(frame, 34, 30), marginTop: 6}}>
              <div style={{...TYPE.mono, fontSize: 16, color: COLOR.dim, marginBottom: 6}}>
                A1  DIALOGUE / MUSIC
              </div>
              <Waveform width={1080 - SAFE} />
            </div>

            {/* Playhead spans the track stack only, so it reads as an editor
                cursor rather than a line drawn across the frame. */}
            <div
              style={{
                position: 'absolute',
                left: playhead,
                top: -10,
                height: 560,
                width: 2,
                background: COLOR.text,
                boxShadow: `0 0 18px 3px ${COLOR.accent}88`,
                opacity: 0.9,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -7,
                  top: -12,
                  width: 16,
                  height: 14,
                  background: COLOR.text,
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                }}
              />
            </div>
          </div>

        </AbsoluteFill>
      </AbsoluteFill>

      {/* Section marker */}
      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end'}}>
        <Rule start={20} width={200} color={COLOR.accent} thickness={2} />
        <div
          style={{
            ...TYPE.display,
            fontSize: 88,
            marginTop: 22,
            opacity: ramp(frame, 24, 20, EASE.out),
            transform: `translate3d(0, ${(1 - ramp(frame, 24, 20)) * 40}px, 0) scale(${1 + vox * 0.012})`,
          }}
        >
          VIDEO EDITING
        </div>
        <Label start={40} style={{marginTop: 16}}>
          Слои · Кейфреймы · Маски · Эффекты
        </Label>
        <Mono style={{marginTop: 26, fontFamily: FONT.mono}}>
          TIMELINE 00:00:{String(Math.floor(frame / 3)).padStart(2, '0')}:
          {String(frame % 30).padStart(2, '0')}
        </Mono>
      </AbsoluteFill>
    </Stage>
  );
};
