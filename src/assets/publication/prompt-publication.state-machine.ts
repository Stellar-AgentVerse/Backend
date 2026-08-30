import { ConflictException } from '@nestjs/common';
import { PromptPublicationState } from '../../database/entities';

/**
 * Allowed publication transitions.
 *
 * `PUBLISHED` is terminal. That is what makes the issue's idempotency
 * requirement enforceable: once a prompt is registered on-chain, no later call
 * can move the row again, so the price/commitment binding recorded at that
 * moment can never be rewritten.
 *
 * `FAILED -> PUBLISHING` is the retry edge. It replays the same row with the
 * same binding rather than creating a second publication, which matters because
 * `register_private_prompt` panics when a commitment is registered twice.
 */
export const PROMPT_PUBLICATION_TRANSITIONS: Readonly<
  Record<PromptPublicationState, readonly PromptPublicationState[]>
> = Object.freeze({
  [PromptPublicationState.DRAFT]: [PromptPublicationState.PENDING_REVIEW],
  [PromptPublicationState.PENDING_REVIEW]: [
    PromptPublicationState.DRAFT,
    PromptPublicationState.PUBLISHING,
  ],
  [PromptPublicationState.PUBLISHING]: [
    PromptPublicationState.PUBLISHED,
    PromptPublicationState.FAILED,
  ],
  [PromptPublicationState.FAILED]: [PromptPublicationState.PUBLISHING],
  [PromptPublicationState.PUBLISHED]: [],
});

export function canTransition(
  from: PromptPublicationState,
  to: PromptPublicationState,
): boolean {
  return PROMPT_PUBLICATION_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: PromptPublicationState,
  to: PromptPublicationState,
): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Invalid transition ${from} -> ${to}`);
  }
}

/** Fields frozen once the row leaves `DRAFT`. */
export const IMMUTABLE_BINDING_FIELDS = Object.freeze([
  'assetId',
  'priceAtomic',
  'commitment',
  'commitmentVersion',
] as const);
