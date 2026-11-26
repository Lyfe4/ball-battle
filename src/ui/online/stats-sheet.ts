// "Your stats" (ADR 0089): the record card opens it, the shared sheet (one ×, tap outside, Escape;
// Profile closes it on leaving) listing the record's breakdowns from what Profile already read, so
// it asks the server nothing.
import type { RecordResponse } from '../../api/record.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import { STATS_NOTE, STATS_TITLE, statRows } from '../../screens/record-text.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { createSheet } from '../sheet.ts';

const ICON_PX = 24;

export interface StatsSheet {
  open(record: RecordResponse): void;
  close(): void;
}

export function createStatsSheet(lookup: DefinitionLookup): StatsSheet {
  const sheet = createSheet({ id: 'stats-sheet-title', title: STATS_TITLE, name: 'stats-sheet' });
  const list = element('dl', 'stats-list');
  sheet.content.append(list, element('p', 'stats-note', STATS_NOTE));

  return {
    open(record) {
      list.replaceChildren(
        ...statRows(record, (id) => lookup.get(id)?.name).map((row) => {
          const item = element('div', 'stats-row');
          const value = element('dd', 'stats-value');
          const ball = row.ball === undefined ? undefined : lookup.get(row.ball);
          if (ball !== undefined) {
            const icon = element('canvas', 'stats-icon');
            icon.setAttribute('aria-hidden', 'true');
            drawBallIcon(icon, ball, ICON_PX);
            value.append(icon);
          }
          value.append(element('span', '', row.value));
          item.append(element('dt', 'stats-label', row.label), value);
          return item;
        }),
      );
      // Put on the page when first opened (and again if the page was redrawn without it).
      if (!sheet.element.isConnected) document.body.append(sheet.element);
      sheet.open();
    },
    close() {
      sheet.close();
    },
  };
}
