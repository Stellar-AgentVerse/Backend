import { ConflictException } from '@nestjs/common';
import { PromptPublicationState } from '../../database/entities';
import {
  assertTransition,
  canTransition,
  PROMPT_PUBLICATION_TRANSITIONS,
} from './prompt-publication.state-machine';

describe('prompt publication state machine', () => {
  const states = Object.values(PromptPublicationState);

  const allowed = new Set([
    'DRAFT->PENDING_REVIEW',
    'PENDING_REVIEW->DRAFT',
    'PENDING_REVIEW->PUBLISHING',
    'PUBLISHING->PUBLISHED',
    'PUBLISHING->FAILED',
    'FAILED->PUBLISHING',
  ]);

  it('covers every state in the transition table', () => {
    expect(Object.keys(PROMPT_PUBLICATION_TRANSITIONS).sort()).toEqual(
      [...states].sort(),
    );
  });

  it('accepts exactly the six documented transitions', () => {
    const accepted = states.flatMap((from) =>
      states
        .filter((to) => canTransition(from, to))
        .map((to) => `${from}->${to}`),
    );
    expect(accepted.sort()).toEqual([...allowed].sort());
  });

  it.each(states.flatMap((from) => states.map((to) => [from, to] as const)))(
    'rejects or accepts %s -> %s consistently',
    (from, to) => {
      const expected = allowed.has(`${from}->${to}`);
      expect(canTransition(from, to)).toBe(expected);

      if (expected) {
        expect(() => assertTransition(from, to)).not.toThrow();
      } else {
        expect(() => assertTransition(from, to)).toThrow(ConflictException);
      }
    },
  );

  it('treats PUBLISHED as terminal', () => {
    expect(
      PROMPT_PUBLICATION_TRANSITIONS[PromptPublicationState.PUBLISHED],
    ).toHaveLength(0);
    for (const to of states) {
      expect(canTransition(PromptPublicationState.PUBLISHED, to)).toBe(false);
    }
  });

  it('allows a failed publication to be retried without leaving the row', () => {
    expect(
      canTransition(
        PromptPublicationState.FAILED,
        PromptPublicationState.PUBLISHING,
      ),
    ).toBe(true);
    expect(
      canTransition(
        PromptPublicationState.FAILED,
        PromptPublicationState.PUBLISHED,
      ),
    ).toBe(false);
  });

  it('never allows a draft to skip review', () => {
    expect(
      canTransition(
        PromptPublicationState.DRAFT,
        PromptPublicationState.PUBLISHING,
      ),
    ).toBe(false);
    expect(
      canTransition(
        PromptPublicationState.DRAFT,
        PromptPublicationState.PUBLISHED,
      ),
    ).toBe(false);
  });
});
