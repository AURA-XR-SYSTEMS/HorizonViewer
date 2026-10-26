import React from 'react';
import BottomSheet from './BottomSheet';
import type { AuraLocation } from './types';

/**
 * A location pin's details on a phone.
 *
 * The desktop viewer floats a 280-360px panel beside the pin; on a 390px
 * screen that runs off the edge and its 12px text is unreadable. This shows the
 * same fields in a bottom sheet at body size.
 */

interface LocationSheetProps {
  location: AuraLocation | null;
  onClose: () => void;
}

const LocationSheet: React.FC<LocationSheetProps> = ({ location, onClose }) => (
  <BottomSheet
    open={location !== null}
    onClose={onClose}
    title={location?.Name}
    testId="location-sheet"
  >
    {location && (
      <div className="flex flex-col gap-3" data-testid="location-sheet-body">
        {location.Description?.Type && (
          <span
            className="uppercase tracking-wider"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}
          >
            {location.Description.Type}
          </span>
        )}
        {location.Description?.Short && (
          <p style={{ fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.88)' }}>
            {location.Description.Short}
          </p>
        )}
        {location.Address && (
          <div className="flex items-start gap-3">
            <span
              className="w-20 flex-shrink-0 uppercase tracking-wider"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 3 }}
            >
              Address
            </span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>
              {location.Address}
            </span>
          </div>
        )}
        {location.Region && (
          <div className="flex items-start gap-3">
            <span
              className="w-20 flex-shrink-0 uppercase tracking-wider"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 3 }}
            >
              Region
            </span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>
              {location.Region}
            </span>
          </div>
        )}
        {location.Attributes && Object.keys(location.Attributes).length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <span
              className="mb-2 block uppercase tracking-wider"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
            >
              Details
            </span>
            <dl className="flex flex-col gap-1.5">
              {Object.entries(location.Attributes).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3">
                  <dt
                    className="w-28 flex-shrink-0"
                    style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}
                  >
                    {key}
                  </dt>
                  <dd
                    className="font-medium"
                    style={{ fontSize: 15, color: 'rgba(255,255,255,0.88)' }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    )}
  </BottomSheet>
);

export default LocationSheet;
