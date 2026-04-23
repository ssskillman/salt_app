import React from "react";
import { Slider } from "rsuite";
import {
  AE_STAGE4_COV_ORDER,
  aeStage4CovSliderIndex,
  formatAeStage4CovMult,
} from "../../ceo/aeStage4CovThreshold.js";

function renderThresholdMark(mark) {
  const i = Math.round(Number(mark));
  const m = AE_STAGE4_COV_ORDER[i];
  return m != null ? formatAeStage4CovMult(m) : "";
}

/**
 * Compact rsuite Slider for CEO AE Stage 4+ coverage threshold; custom handle shows active mult (.5x–3x).
 */
export default function AeStage4CovThresholdSlider({ mult, onMultChange }) {
  const idx = aeStage4CovSliderIndex(mult);
  const handleLabel = formatAeStage4CovMult(AE_STAGE4_COV_ORDER[idx]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .salt-ae-stage4-slider.rs-slider {
              margin-top: 0;
              padding-top: 2px;
            }
            .salt-ae-stage4-slider .rs-slider-bar {
              height: 3px;
            }
            .salt-ae-stage4-slider .rs-slider-progress-bar {
              height: 3px;
            }
            .salt-ae-stage4-slider .rs-slider-handle::before {
              display: none;
            }
            .salt-ae-stage4-slider-handle.rs-slider-handle {
              background: linear-gradient(135deg, #399d89, #2c8798);
              transition: box-shadow 0.2s ease, transform 0.2s ease;
              text-align: center;
              border-radius: 5px;
              padding-inline: 5px;
              padding-block: 1px;
              min-width: 28px;
              width: auto;
              height: auto;
              top: -6px;
              margin-left: -14px;
              color: #fffaf6;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.02em;
              line-height: 1.25;
              cursor: pointer;
              border: 1px solid rgba(0, 90, 114, 0.35);
              box-shadow: 0 2px 6px rgba(22, 15, 41, 0.12);
            }
            .salt-ae-stage4-slider-handle.rs-slider-handle:hover {
              box-shadow: 0 4px 10px rgba(0, 90, 114, 0.22);
            }
            .salt-ae-stage4-slider .rs-slider-graduator > span {
              width: 4px;
              height: 4px;
              margin-left: -2px;
              bottom: -1px;
            }
          `,
        }}
      />
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          flex: "0 0 auto",
          width: "min(128px, 32vw)",
          minWidth: 96,
          maxWidth: 140,
        }}
      >
        <Slider
          aria-label="Stage 4 plus coverage threshold multiplier"
          min={0}
          max={AE_STAGE4_COV_ORDER.length - 1}
          step={1}
          value={idx}
          className="salt-ae-stage4-slider"
          handleClassName="salt-ae-stage4-slider-handle"
          graduated
          progress
          tooltip={false}
          handleTitle={handleLabel}
          renderMark={renderThresholdMark}
          onChange={(nextIdx) => onMultChange?.(AE_STAGE4_COV_ORDER[nextIdx])}
        />
      </div>
    </>
  );
}
