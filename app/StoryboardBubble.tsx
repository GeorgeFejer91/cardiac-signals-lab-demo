import type { StoryboardBubble as StoryboardBubbleData } from './scenarioCatalog';

type StoryboardBubbleProps = {
  player: 'a' | 'b';
  bubble: StoryboardBubbleData;
};

const paths = {
  speech: {
    // Player A sits at the far-right side of the table, below this bubble.
    a: 'M28 9 H280 Q300 9 300 29 V96 Q300 116 280 116 H255 L292 146 L226 116 H28 Q8 116 8 96 V29 Q8 9 28 9 Z',
    // Player B sits above and to the right of this lower-left bubble.
    b: 'M28 30 H226 L281 5 L260 30 H282 Q302 30 302 50 V118 Q302 138 282 138 H28 Q8 138 8 118 V50 Q8 30 28 30 Z',
  },
  thought: {
    a: 'M48 15 C64 1 88 3 102 15 C120 0 146 3 157 18 C177 4 203 9 210 27 C234 22 254 36 251 56 C273 65 268 91 247 99 C244 118 221 126 202 116 C187 132 161 131 148 116 C129 132 104 130 91 114 C69 125 45 113 45 94 C20 90 13 69 27 54 C13 37 27 18 48 15 Z',
    b: 'M48 32 C64 18 88 20 102 32 C120 17 146 20 157 35 C177 21 203 26 210 44 C234 39 254 53 251 73 C273 82 268 108 247 116 C244 135 221 143 202 133 C187 149 161 148 148 133 C129 149 104 147 91 131 C69 142 45 130 45 111 C20 107 13 86 27 71 C13 54 27 35 48 32 Z',
  },
} as const;

export default function StoryboardBubble({ player, bubble }: StoryboardBubbleProps) {
  const isThought = bubble.kind === 'thought';
  const copySize = bubble.text.length > 32 ? 'long' : bubble.text.length > 22 ? 'medium' : 'short';
  const box = isThought
    ? player === 'a'
      ? { x: 39, y: 24, width: 224, height: 88 }
      : { x: 39, y: 43, width: 224, height: 88 }
    : player === 'a'
      ? { x: 31, y: 23, width: 236, height: 84 }
      : { x: 31, y: 45, width: 236, height: 84 };

  return (
    <div className={`storyboard-bubble player-${player} ${bubble.kind}`}>
      <svg viewBox="0 0 310 155" role="img" aria-label={`${bubble.label}: ${bubble.text}`} preserveAspectRatio="xMidYMid meet">
        <title>{bubble.label}</title>
        <path className="bubble-silhouette" d={paths[bubble.kind][player]} />
        {isThought ? player === 'a' ? (
          <g className="thought-trail"><circle cx="260" cy="124" r="9" /><circle cx="286" cy="145" r="5" /></g>
        ) : (
          <g className="thought-trail"><circle cx="260" cy="23" r="9" /><circle cx="286" cy="7" r="5" /></g>
        ) : null}
        <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
          <div className={`bubble-copy ${copySize}`}>
            <span>{bubble.label}</span>
            <strong>{bubble.text}</strong>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
