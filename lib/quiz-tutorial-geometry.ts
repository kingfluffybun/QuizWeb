import type { TutorialPlacement } from "@/lib/quiz-ui-hints";

export interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PopoverLayout {
  left: number;
  top: number;
  width: number;
  placement: TutorialPlacement;
}

export interface ArrowGeometry {
  path: string;
  start: Point;
  end: Point;
}

function clamp(value: number, min: number, max: number): number {
  if (min >= max) return min;
  return Math.min(max, Math.max(min, value));
}

export function computeSpotlightRect(
  rawRect: RectBox,
  viewportWidth: number,
  viewportHeight: number,
  padding = 8,
): RectBox {
  const edge = 4;
  const maxRight = Math.max(edge + 4, viewportWidth - edge);
  const maxBottom = Math.max(edge + 4, viewportHeight - edge);

  const left = clamp(rawRect.left - padding, edge, maxRight - 4);
  const top = clamp(rawRect.top - padding, edge, maxBottom - 4);
  const right = clamp(rawRect.left + rawRect.width + padding, left + 4, maxRight);
  const bottom = clamp(
    rawRect.top + rawRect.height + padding,
    top + 4,
    maxBottom,
  );

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

export function computePopoverLayout(
  spotlight: RectBox,
  cardWidth: number,
  cardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  preferredPlacement: TutorialPlacement = "bottom",
): PopoverLayout {
  const margin = 12;
  const width = Math.min(cardWidth, Math.max(240, viewportWidth - margin * 2));
  const effectiveHeight = Math.min(
    cardHeight,
    Math.max(180, viewportHeight - margin * 2),
  );
  const gap = viewportWidth < 640 ? 32 : 44;

  const centerX = spotlight.left + spotlight.width / 2;
  const centerY = spotlight.top + spotlight.height / 2;
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - effectiveHeight - margin);

  const rawCandidates: TutorialPlacement[] = [
    preferredPlacement,
    "bottom",
    "top",
    "right",
    "left",
  ];
  const candidatesOrder = rawCandidates.filter(
    (item, idx, arr) => arr.indexOf(item) === idx,
  );

  for (const placement of candidatesOrder) {
    if (placement === "bottom") {
      const top = spotlight.top + spotlight.height + gap;
      if (top + effectiveHeight <= viewportHeight - margin) {
        return {
          placement,
          width,
          left: Math.round(clamp(centerX - width / 2, margin, maxLeft)),
          top: Math.round(clamp(top, margin, maxTop)),
        };
      }
    } else if (placement === "top") {
      const top = spotlight.top - gap - effectiveHeight;
      if (top >= margin) {
        return {
          placement,
          width,
          left: Math.round(clamp(centerX - width / 2, margin, maxLeft)),
          top: Math.round(clamp(top, margin, maxTop)),
        };
      }
    } else if (placement === "right") {
      const left = spotlight.left + spotlight.width + gap;
      if (left + width <= viewportWidth - margin) {
        return {
          placement,
          width,
          left: Math.round(clamp(left, margin, maxLeft)),
          top: Math.round(
            clamp(centerY - effectiveHeight / 2, margin, maxTop),
          ),
        };
      }
    } else if (placement === "left") {
      const left = spotlight.left - gap - width;
      if (left >= margin) {
        return {
          placement,
          width,
          left: Math.round(clamp(left, margin, maxLeft)),
          top: Math.round(
            clamp(centerY - effectiveHeight / 2, margin, maxTop),
          ),
        };
      }
    }
  }

  // Fallback when viewport is too tight for an unoccluded gap: place opposite the target midpoint
  const spaceAbove = spotlight.top - margin;
  const spaceBelow = viewportHeight - margin - (spotlight.top + spotlight.height);
  const useBottom = spaceBelow >= spaceAbove;
  const fallbackPlacement: TutorialPlacement = useBottom ? "bottom" : "top";
  const fallbackTop = useBottom
    ? clamp(
        Math.max(spotlight.top + spotlight.height + 16, maxTop),
        margin,
        maxTop,
      )
    : margin;

  return {
    placement: fallbackPlacement,
    width,
    left: Math.round(clamp(centerX - width / 2, margin, maxLeft)),
    top: Math.round(fallbackTop),
  };
}

function resolveFacingSide(
  cardRect: RectBox,
  spotlight: RectBox,
  fallbackPlacement: TutorialPlacement,
): TutorialPlacement {
  if (cardRect.top >= spotlight.top + spotlight.height - 6) return "bottom";
  if (cardRect.top + cardRect.height <= spotlight.top + 6) return "top";
  if (cardRect.left >= spotlight.left + spotlight.width - 6) return "right";
  if (cardRect.left + cardRect.width <= spotlight.left + 6) return "left";
  return fallbackPlacement;
}

export function computeArrowPath(
  cardRect: RectBox,
  spotlight: RectBox,
  placement: TutorialPlacement,
): ArrowGeometry {
  const actualSide = resolveFacingSide(cardRect, spotlight, placement);
  const cardCenterX = cardRect.left + cardRect.width / 2;
  const cardCenterY = cardRect.top + cardRect.height / 2;
  const spotCenterX = spotlight.left + spotlight.width / 2;
  const spotCenterY = spotlight.top + spotlight.height / 2;
  const padX = Math.min(28, cardRect.width * 0.2);
  const padY = Math.min(24, cardRect.height * 0.2);
  const tipOffset = 6;

  let start: Point;
  let end: Point;

  switch (actualSide) {
    case "bottom":
      // Card sits below spotlight -> arrow points up from top of card to bottom edge of spotlight
      start = {
        x: clamp(spotCenterX, cardRect.left + padX, cardRect.left + cardRect.width - padX),
        y: cardRect.top,
      };
      end = {
        x: clamp(cardCenterX, spotlight.left + 12, spotlight.left + Math.max(12, spotlight.width - 12)),
        y: spotlight.top + spotlight.height + tipOffset,
      };
      break;
    case "top":
      // Card sits above spotlight -> arrow points down from bottom of card to top edge of spotlight
      start = {
        x: clamp(spotCenterX, cardRect.left + padX, cardRect.left + cardRect.width - padX),
        y: cardRect.top + cardRect.height,
      };
      end = {
        x: clamp(cardCenterX, spotlight.left + 12, spotlight.left + Math.max(12, spotlight.width - 12)),
        y: spotlight.top - tipOffset,
      };
      break;
    case "right":
      // Card sits right of spotlight -> arrow points left from left of card to right edge of spotlight
      start = {
        x: cardRect.left,
        y: clamp(spotCenterY, cardRect.top + padY, cardRect.top + cardRect.height - padY),
      };
      end = {
        x: spotlight.left + spotlight.width + tipOffset,
        y: clamp(cardCenterY, spotlight.top + 12, spotlight.top + Math.max(12, spotlight.height - 12)),
      };
      break;
    case "left":
      // Card sits left of spotlight -> arrow points right from right of card to left edge of spotlight
      start = {
        x: cardRect.left + cardRect.width,
        y: clamp(spotCenterY, cardRect.top + padY, cardRect.top + cardRect.height - padY),
      };
      end = {
        x: spotlight.left - tipOffset,
        y: clamp(cardCenterY, spotlight.top + 12, spotlight.top + Math.max(12, spotlight.height - 12)),
      };
      break;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 12) {
    return {
      start,
      end,
      path: `M ${Math.round(start.x)} ${Math.round(start.y)} L ${Math.round(end.x)} ${Math.round(end.y)}`,
    };
  }

  const curveOffset = clamp(distance * 0.18, 10, 28);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  // Consistent perpendicular normal for a graceful curved pointer
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const sign = normalX + normalY >= 0 ? 1 : -1;
  const controlX = midX + normalX * curveOffset * sign;
  const controlY = midY + normalY * curveOffset * sign;

  return {
    start,
    end,
    path: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
  };
}

export function buildBackdropCutoutPath(
  viewportWidth: number,
  viewportHeight: number,
  spotlight: RectBox | null,
  radius = 14,
): string {
  const outer = `M 0 0 H ${viewportWidth} V ${viewportHeight} H 0 Z`;
  if (!spotlight || spotlight.width <= 0 || spotlight.height <= 0) {
    return outer;
  }

  const r = clamp(
    radius,
    0,
    Math.min(spotlight.width / 2, spotlight.height / 2),
  );
  const x = spotlight.left;
  const y = spotlight.top;
  const w = spotlight.width;
  const h = spotlight.height;

  const cutout = [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");

  return `${outer} ${cutout}`;
}
