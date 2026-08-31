import { useEffect, useRef } from 'react';
import type { StoryboardBubble as StoryboardBubbleData } from './scenarioCatalog';

type StoryboardBubbleProps = {
  player: 'a' | 'b';
  bubble: StoryboardBubbleData;
};

const cloudPath = 'M48 15 C64 1 88 3 102 15 C120 0 146 3 157 18 C177 4 203 9 210 27 C234 22 254 36 251 56 C273 65 268 91 247 99 C244 118 221 126 202 116 C187 132 161 131 148 116 C129 132 104 130 91 114 C69 125 45 113 45 94 C20 90 13 69 27 54 C13 37 27 18 48 15 Z';

export default function StoryboardBubble({ player, bubble }: StoryboardBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGSVGElement>(null);
  const copySize = bubble.text.length > 32 ? 'long' : bubble.text.length > 22 ? 'medium' : 'short';

  useEffect(() => {
    let animationFrame = 0;

    const updateConnector = () => {
      const bubbleElement = bubbleRef.current;
      const connector = connectorRef.current;
      const scene = bubbleElement?.closest<HTMLElement>('.storyboard-scene');
      const silhouette = bubbleElement?.querySelector<SVGPathElement>('.bubble-silhouette');

      if (!bubbleElement || !connector || !scene || !silhouette) {
        animationFrame = window.requestAnimationFrame(updateConnector);
        return;
      }

      const styles = window.getComputedStyle(scene);
      const headX = Number.parseFloat(styles.getPropertyValue(`--head-${player}-x`));
      const headY = Number.parseFloat(styles.getPropertyValue(`--head-${player}-y`));
      if (!Number.isFinite(headX) || !Number.isFinite(headY)) {
        connector.style.opacity = '0';
        animationFrame = window.requestAnimationFrame(updateConnector);
        return;
      }

      const sceneRect = scene.getBoundingClientRect();
      const cloudRect = silhouette.getBoundingClientRect();
      const cloudCenterX = cloudRect.left - sceneRect.left + cloudRect.width / 2;
      const cloudCenterY = cloudRect.top - sceneRect.top + cloudRect.height / 2;
      const deltaX = headX - cloudCenterX;
      const deltaY = headY - cloudCenterY;
      const radiusX = Math.max(1, cloudRect.width * 0.46);
      const radiusY = Math.max(1, cloudRect.height * 0.42);
      const divisor = Math.sqrt((deltaX * deltaX) / (radiusX * radiusX) + (deltaY * deltaY) / (radiusY * radiusY));
      const boundaryScale = divisor > 1 ? 1 / divisor : 0;
      const startX = cloudCenterX + deltaX * boundaryScale;
      const startY = cloudCenterY + deltaY * boundaryScale;
      const circles = Array.from(connector.querySelectorAll<SVGCircleElement>('circle'));
      const stops = [0.08, 0.39, 0.7, 1];

      connector.setAttribute('viewBox', `0 0 ${sceneRect.width} ${sceneRect.height}`);
      circles.forEach((circle, index) => {
        const progress = stops[index];
        circle.setAttribute('cx', String(startX + (headX - startX) * progress));
        circle.setAttribute('cy', String(startY + (headY - startY) * progress));
      });
      connector.style.opacity = '1';
      animationFrame = window.requestAnimationFrame(updateConnector);
    };

    updateConnector();
    return () => window.cancelAnimationFrame(animationFrame);
  }, [player]);

  return (
    <>
      <svg ref={connectorRef} className={`thought-connector player-${player}`} aria-hidden="true">
        <circle r="8.5" />
        <circle r="6" />
        <circle r="4" />
        <circle r="2.5" />
      </svg>
      <div ref={bubbleRef} className={`storyboard-bubble player-${player} thought`}>
        <svg viewBox="0 0 280 135" role="img" aria-label={`${bubble.label}: ${bubble.text}`} preserveAspectRatio="xMidYMid meet">
          <title>{bubble.label}</title>
          <path className="bubble-silhouette" d={cloudPath} />
          <foreignObject x="39" y="24" width="224" height="88">
            <div className={`bubble-copy ${copySize}`}>
              <span>{bubble.label}</span>
              <strong>{bubble.text}</strong>
            </div>
          </foreignObject>
        </svg>
      </div>
    </>
  );
}
