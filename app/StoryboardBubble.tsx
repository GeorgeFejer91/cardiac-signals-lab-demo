import type { StoryboardBubble as StoryboardBubbleData } from './scenarioCatalog';

type StoryboardBubbleProps = {
  player: 'a' | 'b';
  bubble: StoryboardBubbleData;
};

const paths = {
  speech: {
    a: 'M28 8 H272 Q292 8 292 28 V94 Q292 114 272 114 H88 L42 142 L70 114 H28 Q8 114 8 94 V28 Q8 8 28 8 Z',
    b: 'M54 8 H282 Q302 8 302 28 V112 Q302 132 282 132 H54 Q34 132 34 112 V93 L8 85 L34 67 V28 Q34 8 54 8 Z',
  },
  thought: {
    a: 'M53 18 C64 4 88 4 102 15 C118 1 145 4 155 18 C177 4 202 10 208 27 C233 22 250 36 247 54 C268 64 263 88 243 95 C241 112 220 122 201 113 C188 128 161 127 149 113 C131 127 104 126 93 111 C72 122 48 111 48 94 C23 91 14 71 27 55 C13 39 29 20 53 18 Z M55 114 A10 10 0 1 0 75 114 A10 10 0 1 0 55 114 Z M29 135 A6 6 0 1 0 41 135 A6 6 0 1 0 29 135 Z',
    b: 'M53 18 C64 4 88 4 102 15 C118 1 145 4 155 18 C177 4 202 10 208 27 C233 22 250 36 247 54 C268 64 263 88 243 95 C241 112 220 122 201 113 C188 128 161 127 149 113 C131 127 104 126 93 111 C72 122 48 111 48 94 C23 91 14 71 27 55 C13 39 29 20 53 18 Z M55 114 A10 10 0 1 0 75 114 A10 10 0 1 0 55 114 Z M29 135 A6 6 0 1 0 41 135 A6 6 0 1 0 29 135 Z',
  },
} as const;

export default function StoryboardBubble({ player, bubble }: StoryboardBubbleProps) {
  const isThought = bubble.kind === 'thought';
  const box = player === 'a'
    ? { x: 24, y: 18, width: 250, height: 82 }
    : { x: 45, y: 19, width: 238, height: 96 };

  return (
    <div className={`storyboard-bubble player-${player} ${bubble.kind}`}>
      <svg viewBox="0 0 310 150" role="img" aria-label={`${bubble.label}: ${bubble.text}`} preserveAspectRatio="none">
        <title>{bubble.label}</title>
        <path className="bubble-silhouette" d={paths[bubble.kind][player]} fillRule={isThought ? 'evenodd' : undefined} />
        <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
          <div className="bubble-copy">
            <span>{bubble.label}</span>
            <strong>{bubble.text}</strong>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
